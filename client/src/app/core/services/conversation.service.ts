import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, interval, Subscription } from 'rxjs';
import { catchError, filter, switchMap, tap } from 'rxjs/operators';
import { API_BASE_URL } from '../config/api.config';
import { Conversation, ChatMessage } from '../models/conversation.model';
import { AuthService } from './auth.service';

const SEEN_KEY = 'lofu-chat-seen';

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private pollSub: Subscription | null = null;

  readonly conversations = signal<Conversation[]>([]);
  // When the user last looked at each conversation (epoch ms), remembered in this browser.
  private readonly seen = signal<Record<string, number>>(this.loadSeen());

  // Conversations whose newest message is from the other person and newer than the last time this
  // user opened the conversation. Drives the badge in the navigation bar.
  readonly unreadCount = computed(() => this.conversations().filter((c) => this.isUnread(c)).length);
  readonly activeConversationId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);

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

  private badgeSub: Subscription | null = null;

  // Refreshes the conversation list every 30 seconds so the unread badge stays current.
  connect() {
    if (this.badgeSub) return;

    this.badgeSub = interval(30_000).pipe(
      filter(() => !document.hidden && this.auth.isLoggedIn()),
      switchMap(() => this.getConversations().pipe(catchError(() => EMPTY)))
    ).subscribe({ next: (res) => this.conversations.set(res.conversations) });
  }

  disconnect() {
    this.stopPolling();
    this.badgeSub?.unsubscribe();
    this.badgeSub = null;
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
    this.startPolling(conversationId);
  }

  leaveConversation(conversationId: string) {
    this.activeConversationId.set(null);
    this.stopPolling();
  }

  private startPolling(conversationId: string) {
    this.stopPolling();
    this.pollSub = interval(3000).pipe(
      // Skip while the tab is in the background, and never let one failed poll end the polling.
      filter(() => !document.hidden),
      switchMap(() => this.getMessages(conversationId).pipe(catchError(() => EMPTY)))
    ).subscribe({
      next: (res) => {
        this.messages.set(res.messages);
        const latest = res.messages[res.messages.length - 1];
        if (latest) this.markSeen(conversationId, latest.createdAt);
      },
    });
  }

  private stopPolling() {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  // Sends one message. Returns the request so the caller can react to success or failure.
  sendMessage(conversationId: string, content: string): Observable<unknown> {
    return this.sendMessageHttp(conversationId, content).pipe(
      tap((res) => {
        this.markSeen(conversationId, res.message.createdAt);
        // The 3-second poll may already have fetched it; don't show it twice.
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