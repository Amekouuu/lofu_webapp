import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Post } from '../models/post.model';

export interface UpdateProfilePayload {
  fullName?: string;
  username?: string;
  email?: string;
  avatar?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface UpdatePrivacyPayload {
  profileVisible: boolean;
  showEmail: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  getMyPosts(): Observable<{ success: boolean; posts: Post[] }> {
    return this.http.get<{ success: boolean; posts: Post[] }>(`${API_BASE_URL}/users/me/posts`);
  }

  updateProfile(payload: UpdateProfilePayload): Observable<{ success: boolean; message: string; user: any }> {
    return this.http.patch<{ success: boolean; message: string; user: any }>(`${API_BASE_URL}/users/me`, payload);
  }

  updatePrivacy(payload: UpdatePrivacyPayload): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(`${API_BASE_URL}/users/me/privacy`, payload);
  }

  changePassword(payload: ChangePasswordPayload): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(`${API_BASE_URL}/users/me/password`, payload);
  }

  deletePost(postId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${API_BASE_URL}/users/me/posts/${postId}`);
  }

  deleteAccount(): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${API_BASE_URL}/users/me`);
  }
}