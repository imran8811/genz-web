import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { ApiService } from './api.service';

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role?: string;
}

interface AuthApiResponse {
  message: string;
  token?: string;
  user?: User;
}

export interface AuthActionResult {
  success: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private api = inject(ApiService);
  private isBrowser = isPlatformBrowser(this.platformId);

  private currentUser = signal<User | null>(null);

  isAuthenticated = computed(() => !!this.currentUser());
  user = computed(() => this.currentUser());

  constructor() {
    this.loadFromStorage();
    this.syncCurrentUser();
  }

  signup(name: string, email: string, password: string, phone = ''): Observable<AuthActionResult> {
    return this.api
      .post<AuthApiResponse>('/auth/register', {
        name,
        email,
        phone,
        password,
        password_confirmation: password,
      })
      .pipe(
        tap(response => this.storeAuth(response)),
        map(response => ({
          success: true,
          message: response.message || 'Account created successfully!',
        })),
        catchError(error =>
          of({
            success: false,
            message: this.api.getErrorMessage(error, 'Signup failed. Please try again.'),
          })
        )
      );
  }

  login(email: string, password: string): Observable<AuthActionResult> {
    return this.api
      .post<AuthApiResponse>('/auth/login', {
        email,
        password,
      })
      .pipe(
        tap(response => this.storeAuth(response)),
        map(response => ({
          success: true,
          message: response.message || 'Login successful!',
        })),
        catchError(error =>
          of({
            success: false,
            message: this.api.getErrorMessage(error, 'Invalid email or password.'),
          })
        )
      );
  }

  logout(): void {
    if (!this.isAuthenticated()) {
      this.clearAuth();
      this.router.navigate(['/']);
      return;
    }

    this.api.post<{ message: string }>('/auth/logout', {}, true).subscribe({
      next: () => {
        this.clearAuth();
        this.router.navigate(['/']);
      },
      error: () => {
        this.clearAuth();
        this.router.navigate(['/']);
      },
    });
  }

  requestPasswordReset(email: string): Observable<AuthActionResult> {
    return this.api
      .post<{ message: string }>('/auth/forgot-password', { email })
      .pipe(
        map(response => ({
          success: true,
          message: response.message || 'Password reset link sent! Check your email.',
        })),
        catchError(error =>
          of({
            success: false,
            message: this.api.getErrorMessage(error, 'Unable to send reset link.'),
          })
        )
      );
  }

  resetPassword(
    token: string,
    email: string,
    password: string,
    confirmation: string
  ): Observable<AuthActionResult> {
    return this.api
      .post<{ message: string }>('/auth/reset-password', {
        token,
        email,
        password,
        password_confirmation: confirmation,
      })
      .pipe(
        map(response => ({
          success: true,
          message: response.message || 'Password reset successful! You can now login.',
        })),
        catchError(error =>
          of({
            success: false,
            message: this.api.getErrorMessage(error, 'Unable to reset password.'),
          })
        )
      );
  }

  private syncCurrentUser(): void {
    if (!this.isAuthenticated()) {
      return;
    }

    this.api.get<{ user: User }>('/auth/me', true).subscribe({
      next: response => {
        this.currentUser.set(response.user);
        if (this.isBrowser) {
          localStorage.setItem('genz_current_user', JSON.stringify(response.user));
        }
      },
      error: () => {
        this.clearAuth();
      },
    });
  }

  private loadFromStorage(): void {
    if (!this.isBrowser) {
      return;
    }

    const storedUser = localStorage.getItem('genz_current_user');
    if (!storedUser) {
      return;
    }

    try {
      this.currentUser.set(JSON.parse(storedUser));
    } catch {
      this.clearAuth();
    }
  }

  private storeAuth(response: AuthApiResponse): void {
    if (!response.user || !response.token) {
      return;
    }

    this.currentUser.set(response.user);

    if (this.isBrowser) {
      localStorage.setItem('genz_current_user', JSON.stringify(response.user));
      localStorage.setItem('genz_api_token', response.token);
    }
  }

  private clearAuth(): void {
    this.currentUser.set(null);

    if (this.isBrowser) {
      localStorage.removeItem('genz_current_user');
      localStorage.removeItem('genz_api_token');
    }
  }
}
