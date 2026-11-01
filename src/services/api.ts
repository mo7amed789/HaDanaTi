/**
 * Client API service for Hadanaty
 */

let authToken = localStorage.getItem('hadanaty_jwt') || '';

export function setApiToken(token: string) {
  authToken = token;
  if (token) {
    localStorage.setItem('hadanaty_jwt', token);
  } else {
    localStorage.removeItem('hadanaty_jwt');
  }
}

export function getApiToken(): string {
  return authToken;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `خطأ في الخادم (${response.status})`);
  }

  return data as T;
}
