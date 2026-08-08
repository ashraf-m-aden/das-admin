import { Injectable } from '@angular/core';
import { AuthResponse } from '../models/auth.models';

const STORAGE_KEY = 'das-auth-session';

interface StoredSession {
  user: AuthResponse['user'];
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthStorageService {
  save(response: AuthResponse): void {
    const payload: StoredSession = {
      user: response.user,
      accessToken: response.tokens.accessToken,
      refreshToken: response.tokens.refreshToken,
      expiresAt: response.tokens.expiresAt,
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
