import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Post, PostsResponse } from '../models/post.model';

export interface GetPostsParams {
  type?: 'Lost' | 'Found';
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreatePostPayload {
  type: 'Lost' | 'Found';
  itemName: string;
  category: string;
  description: string;
  color?: string;
  brand?: string;
  landmark: string;
  locationDetails?: string;
  dateLostOrFound: string;
  incidentTimeApprox?: string;
  images?: string[];
}

@Injectable({ providedIn: 'root' })
export class PostService {
  private readonly http = inject(HttpClient);

  getPosts(params: GetPostsParams = {}): Observable<PostsResponse> {
    let httpParams = new HttpParams();
    if (params.type)   httpParams = httpParams.set('type',   params.type);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.page)   httpParams = httpParams.set('page',   String(params.page));
    if (params.limit)  httpParams = httpParams.set('limit',  String(params.limit));
    return this.http.get<PostsResponse>(`${API_BASE_URL}/posts`, { params: httpParams });
  }

  getPostById(id: string): Observable<{ success: boolean; post: Post }> {
    return this.http.get<{ success: boolean; post: Post }>(`${API_BASE_URL}/posts/${id}`);
  }

  createPost(payload: CreatePostPayload): Observable<{ success: boolean; message: string; post: Post }> {
    return this.http.post<{ success: boolean; message: string; post: Post }>(`${API_BASE_URL}/posts`, payload);
  }
}