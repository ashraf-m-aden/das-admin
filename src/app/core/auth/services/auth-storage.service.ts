import { Injectable } from '@angular/core';
import { AuthResponse } from '../models/auth.models';

const STORAGE_KEY = 'das-auth-session';

interface StoredSession {
  user: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  fullName: string;
  userId: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthStorageService {
  save(response: AuthResponse): void {
    const payload: StoredSession = {
      user: response.fullName,
      accessToken: response.token,
      refreshToken: response.refreshToken,
      expiresAt: response.refreshTokenExpiresAtUtc,
      fullName:response.fullName,
      roles:response.roles,
      userId:response.userId

    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  load(): StoredSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as StoredSession;
      if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
        this.clear();
        return null;
      }
      return parsed;
    } catch {
      this.clear();
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
