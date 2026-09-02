import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private readonly baseUrl = environment.apiBaseUrl;

  get<T>(path: string, authenticated = false): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, {
      headers: this.buildHeaders(authenticated),
    });
  }

  post<T>(path: string, body: unknown, authenticated = false): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, {
      headers: this.buildHeaders(authenticated),
    });
  }

  patch<T>(path: string, body: unknown, authenticated = false): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, {
      headers: this.buildHeaders(authenticated),
    });
  }

  put<T>(path: string, body: unknown, authenticated = false): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, {
      headers: this.buildHeaders(authenticated),
    });
  }

  delete<T>(path: string, authenticated = false): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`, {
      headers: this.buildHeaders(authenticated),
    });
  }

  getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }

    const response = error.error as unknown;

    if (typeof response === 'string' && response.trim()) {
      return response;
    }

    if (typeof response === 'object' && response !== null && 'errors' in response) {
      const errors = (response as { errors?: Record<string, string[]> }).errors;
      const firstField = errors ? Object.keys(errors)[0] : null;
      const firstFieldErrors = firstField && errors ? errors[firstField] : null;
      if (firstFieldErrors?.length) {
        return firstFieldErrors[0];
      }
    }

    if (typeof response === 'object' && response !== null && 'message' in response) {
      const message = (response as { message?: string }).message;
      if (message) {
        return message;
      }
    }

    if (error.status === 0) {
      return 'Unable to connect to API server. Check backend is running and CORS is enabled.';
    }

    return fallback;
  }

  private buildHeaders(authenticated: boolean): HttpHeaders {
    let headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });

    if (!authenticated || !this.isBrowser) {
      return headers;
    }

    const token = localStorage.getItem('genz_api_token');
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }
}