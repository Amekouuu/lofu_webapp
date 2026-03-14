import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Claim } from '../models/claim.model';

export interface CreateClaimPayload {
  postId: string;
  message: string;
  proofDetails: string;
  contactInfo?: string;
}

@Injectable({ providedIn: 'root' })
export class ClaimService {
  private readonly http = inject(HttpClient);

  createClaim(payload: CreateClaimPayload): Observable<{ success: boolean; message: string; claim: Claim }> {
    return this.http.post<{ success: boolean; message: string; claim: Claim }>(`${API_BASE_URL}/claims`, payload);
  }

  getIncomingClaims(): Observable<{ success: boolean; claims: Claim[] }> {
    return this.http.get<{ success: boolean; claims: Claim[] }>(`${API_BASE_URL}/claims/incoming`);
  }

  getMyClaims(): Observable<{ success: boolean; claims: Claim[] }> {
    return this.http.get<{ success: boolean; claims: Claim[] }>(`${API_BASE_URL}/claims/my`);
  }

  approveClaim(claimId: string): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(`${API_BASE_URL}/claims/${claimId}/approve`, {});
  }

  rejectClaim(claimId: string): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(`${API_BASE_URL}/claims/${claimId}/reject`, {});
  }
}