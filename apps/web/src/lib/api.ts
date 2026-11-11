export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1';

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, '') || 'http://localhost:4000';

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

let inMemoryCsrfToken: string | null = null;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1] ?? '') : null;
}

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Client-Platform', 'web');
  const method = (init.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = inMemoryCsrfToken || readCookie('sis_csrf_token');
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include', // Uses HttpOnly, SameSite cookies; never localStorage
  });
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await rawFetch('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const body = (await res.clone().json().catch(() => null)) as { csrfToken?: string } | null;
        if (body?.csrfToken) inMemoryCsrfToken = body.csrfToken;
      }
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  retryOnAuth = true,
): Promise<T> {
  let response = await rawFetch(path, init);

  if (response.status === 401 && retryOnAuth && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      response = await rawFetch(path, init);
    }
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let payload: unknown;
    try {
      payload = await response.json();
      if (payload && typeof payload === 'object' && 'message' in payload) {
        const rawMsg = (payload as { message: unknown }).message;
        message = Array.isArray(rawMsg) ? rawMsg.join(', ') : String(rawMsg);
      }
    } catch {
      // ignore non-json error body
    }
    throw new ApiError(message, response.status, payload);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = (await response.json()) as T;
    if (json && typeof json === 'object' && 'csrfToken' in json) {
      const token = (json as { csrfToken?: unknown }).csrfToken;
      if (typeof token === 'string' && token.length > 0) {
        inMemoryCsrfToken = token;
      }
    }
    return json;
  }
  return (await response.text()) as unknown as T;
}
