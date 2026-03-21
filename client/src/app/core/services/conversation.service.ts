import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { API_BASE_URL } from '../config/api.config';
import { Conversation, ChatMessage } from '../models/conversation.model';

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly http = inject(HttpClient);
  private pollSub: Subscription | null = null;

  readonly conversations = signal<Conversation[]>([]);
  readonly unreadCount = signal(0);
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

  connect() {}
  disconnect() { this.stopPolling(); }

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
      switchMap(() => this.http.get<{ success: boolean; messages: ChatMessage[] }>(
        `${API_BASE_URL}/conversations/${conversationId}/messages`
      ))
    ).subscribe({ next: (res) => { this.messages.set(res.messages); } });
  }

  private stopPolling() {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  sendMessage(conversationId: string, content: string, _sender: { _id: string; fullName: string; avatar?: string; }) {
    this.sendMessageHttp(conversationId, content).subscribe({
      next: () => {
        this.getMessages(conversationId).subscribe({
          next: (res) => this.messages.set(res.messages),
        });
      },
    });
  }

  getOtherParticipant(conversation: Conversation, myId: string) {
    return conversation.participants.find(p => p._id !== myId) ?? conversation.participants[0];
  }
}