import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, interval, Subscription } from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';
import { Socket, io } from 'socket.io-client';
import { API_BASE_URL } from '../config/api.config';
import { Conversation, ChatMessage } from '../models/conversation.model';
import { AuthService } from './auth.service';

const SEEN_KEY = 'lofu-chat-seen';
// How often to check for news while the live connection is down.
const FALLBACK_POLL_MS = 10_000;
// The socket lives on the same server as the API, minus the "/api" path.
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;
  private fallbackSub: Subscription | null = null;

  readonly conversations = signal<Conversation[]>([]);
  // When the user last looked at each conversation (epoch ms), remembered in this browser.
  private readonly seen = signal<Record<string, number>>(this.loadSeen());

  // Conversations whose newest message is from the other person and newer than the last time this
  // user opened the conversation. Drives the badge in the navigation bar.
  readonly unreadCount = computed(() => this.conversations().filter((c) => this.isUnread(c)).length);
  readonly activeConversationId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);

  // True while the socket is connected, and (separately) while it is listening to the open chat.
  private readonly connected = signal(false);
  private readonly joined = signal(false);

  getConversations(): Observable<{ success: boolean; conversations: Conversation[] }> {
    return this.http.get<{ success: boolean; conversations: Conversation[] }>(
      `${API_BASE_URL}/conversations`
    );
  }

  getMessages(conversationId: string): Observable<{ success: boolean; messages: ChatMessage[] }> {
    return this.http.get<{ success: boolean; messages: ChatMessage[] }>(
      `${API_BASE_URL}/conversations/${conversationId}/messages`
    );
  }

  sendMessageHttp(conversationId: string, content: string): Observable<{ success: boolean; message: ChatMessage }> {
    return this.http.post<{ success: boolean; message: ChatMessage }>(
      `${API_BASE_URL}/conversations/${conversationId}/messages`,
      { content }
    );
  }

  loadConversations() {
    this.getConversations().subscribe({
      next: (res) => { this.conversations.set(res.conversations); },
    });
  }

  // Opens the live connection (once) and the slow fallback that covers it going down.
  connect() {
    if (this.socket) return;

    const socket = io(SOCKET_URL, {
      // Read on every (re)connect, so a reconnect after login uses the current token.
      auth: (cb) => cb({ token: this.auth.getToken() ?? '' }),
    });
    this.socket = socket;

    socket.on('connect', () => {
      this.connected.set(true);
      this.joinActiveRoom();
      // Anything sent while we were offline: catch up.
      this.refreshConversations();
      this.refreshActiveMessages();
    });
    socket.on('disconnect', () => {
      this.connected.set(false);
      this.joined.set(false);
    });
    socket.on('connect_error', (error) => {
      // A rejected login is not worth retrying; the normal API calls already log the user out.
      if (error.message === 'invalid_session' && this.socket === socket) {
        socket.disconnect();
        this.socket = null;
      }
    });
    socket.on('new_message', (payload: { conversationId: string; message: ChatMessage }) =>
      this.onNewMessage(payload)
    );
    socket.on('conversations_changed', () => this.refreshConversations());

    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.fallbackSub = interval(FALLBACK_POLL_MS).pipe(
      filter(() => !document.hidden && this.auth.isLoggedIn() && !this.liveForCurrentView())
    ).subscribe(() => {
      this.refreshConversations();
      this.refreshActiveMessages();
    });
  }

  disconnect() {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.fallbackSub?.unsubscribe();
    this.fallbackSub = null;
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
    this.joined.set(false);
    this.conversations.set([]);
  }

  isUnread(conversation: Conversation): boolean {
    const me = this.auth.currentUser()?._id;
    const senderId = conversation.lastMessageSenderId;

    if (!me || !senderId || senderId === me || !conversation.lastMessageAt) return false;

    return Date.parse(conversation.lastMessageAt) > (this.seen()[conversation._id] ?? 0);
  }

  markSeen(conversationId: string, at: string): void {
    const time = Date.parse(at);
    if (Number.isNaN(time) || (this.seen()[conversationId] ?? 0) >= time) return;

    const next = { ...this.seen(), [conversationId]: time };
    this.seen.set(next);

    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable (private mode): the badge just resets on reload */
    }
  }

  private loadSeen(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  joinConversation(conversationId: string) {
    this.activeConversationId.set(conversationId);
    this.joined.set(false);
    this.joinActiveRoom();
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit('leave_conversation', conversationId);
    this.activeConversationId.set(null);
    this.joined.set(false);
  }

  // Asks the server to send us this chat's messages. The server only agrees for chats the logged-in
  // user belongs to; if it says no, `joined` stays false and the fallback poll keeps the chat fresh.
  private joinActiveRoom() {
    const id = this.activeConversationId();
    if (!id || !this.socket?.connected) return;

    this.socket.emit('join_conversation', id, (ok: boolean) => {
      if (this.activeConversationId() === id) this.joined.set(ok);
    });
  }

  // Live updates are trustworthy only when connected and (if a chat is open) listening to it.
  private liveForCurrentView(): boolean {
    return this.connected() && (this.activeConversationId() === null || this.joined());
  }

  private onNewMessage(payload: { conversationId: string; message: ChatMessage }) {
    const { conversationId, message } = payload;

    if (conversationId === this.activeConversationId()) {
      this.messages.update((list) =>
        list.some((m) => m._id === message._id) ? list : [...list, message]
      );
      if (!document.hidden) this.markSeen(conversationId, message.createdAt);
    }

    this.refreshConversations();
  }

  private readonly onVisibilityChange = () => {
    if (document.hidden || !this.auth.isLoggedIn()) return;
    this.refreshConversations();
    this.refreshActiveMessages();
  };

  // Background refreshes never show an error: the next one simply tries again.
  private refreshConversations() {
    if (!this.auth.isLoggedIn()) return;
    this.getConversations().pipe(catchError(() => EMPTY)).subscribe({
      next: (res) => this.conversations.set(res.conversations),
    });
  }

  private refreshActiveMessages() {
    const id = this.activeConversationId();
    if (!id) return;

    this.getMessages(id).pipe(catchError(() => EMPTY)).subscribe({
      next: (res) => {
        if (this.activeConversationId() !== id) return;

        const current = this.messages();
        const sameTail = current.length === res.messages.length
          && current[current.length - 1]?._id === res.messages[res.messages.length - 1]?._id;
        // Replacing the list with an identical one would make the chat jump to the bottom.
        if (!sameTail) this.messages.set(res.messages);

        const latest = res.messages[res.messages.length - 1];
        if (latest && !document.hidden) this.markSeen(id, latest.createdAt);
      },
    });
  }

  // Sends one message. Returns the request so the caller can react to success or failure.
  sendMessage(conversationId: string, content: string): Observable<unknown> {
    return this.sendMessageHttp(conversationId, content).pipe(
      tap((res) => {
        this.markSeen(conversationId, res.message.createdAt);
        // The live update may already have delivered it; don't show it twice.
        this.messages.update((list) =>
          list.some((m) => m._id === res.message._id) ? list : [...list, res.message]
        );
      })
    );
  }

  getOtherParticipant(conversation: Conversation, myId: string) {
    return conversation.participants.find(p => p._id !== myId) ?? conversation.participants[0];
  }
}
