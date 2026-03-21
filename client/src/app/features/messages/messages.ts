import { Component, OnInit, OnDestroy, AfterViewChecked, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ConversationService } from '../../core/services/conversation.service';
import { Conversation, ChatMessage } from '../../core/models/conversation.model';

@Component({
  selector: 'app-messages',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './messages.html',
  styleUrl: './messages.css',
})
export class Messages implements OnInit, OnDestroy, AfterViewChecked {

  @ViewChild('messageEnd') messageEnd!: ElementRef;

  readonly currentUser;

  selectedConversation = signal<Conversation | null>(null);
  messagesLoading = signal(false);
  convoLoading = signal(true);
  messageInput = '';
  private shouldScroll = false;

  constructor(
    private authService: AuthService,
    public convoService: ConversationService,
  ) {
    this.currentUser = this.authService.currentUser;
  }

  ngOnInit() {
    this.convoService.connect();
    this.convoService.loadConversations();
    this.convoLoading.set(false);
  }

  ngOnDestroy() {
    const convo = this.selectedConversation();
    if (convo) this.convoService.leaveConversation(convo._id);
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  selectConversation(convo: Conversation) {
    const prev = this.selectedConversation();
    if (prev) this.convoService.leaveConversation(prev._id);

    this.selectedConversation.set(convo);
    this.convoService.messages.set([]);
    this.messagesLoading.set(true);

    this.convoService.joinConversation(convo._id);
    this.convoService.getMessages(convo._id).subscribe({
      next: (res) => {
        this.convoService.messages.set(res.messages);
        this.messagesLoading.set(false);
        this.shouldScroll = true;
      },
      error: () => this.messagesLoading.set(false),
    });
  }

  sendMessage() {
    const content = this.messageInput.trim();
    const convo = this.selectedConversation();
    const user = this.currentUser();
    if (!content || !convo || !user) return;

    this.messageInput = '';
    this.convoService.sendMessage(convo._id, content, {
      _id: user._id,
      fullName: user.fullName,
      avatar: user.avatar,
    });
    this.shouldScroll = true;
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  scrollToBottom() {
    try {
      this.messageEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }

  getOtherParticipant(convo: Conversation) {
    const myId = this.currentUser()?._id || '';
    return this.convoService.getOtherParticipant(convo, myId);
  }

  getInitial(name: string): string {
    return (name || 'U')[0].toUpperCase();
  }

  isMyMessage(msg: ChatMessage): boolean {
    return msg.sender._id === this.currentUser()?._id;
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}