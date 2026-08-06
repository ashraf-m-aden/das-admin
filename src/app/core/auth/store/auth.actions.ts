import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { AuthResponse, LoginCredentials } from '../models/auth.models';

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    Login: props<{ credentials: LoginCredentials }>(),
    'Login Success': props<{ response: AuthResponse }>(),
    'Login Failure': props<{ errorMessageKey: string }>(),

    'Restore Session': emptyProps(),
    'Restore Session Success': props<{ response: AuthResponse }>(),
    'Restore Session Failure': emptyProps(),

    Logout: emptyProps(),
    'Logout Complete': emptyProps(),
  },
});
