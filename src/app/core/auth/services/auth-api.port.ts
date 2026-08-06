import { Observable } from 'rxjs';
import { AuthResponse, LoginCredentials } from '../models/auth.models';

export abstract class AuthApiPort {
  abstract login(credentials: LoginCredentials): Observable<AuthResponse>;
  abstract logout(): Observable<void>;
  abstract refresh(refreshToken: string): Observable<AuthResponse>;
}
