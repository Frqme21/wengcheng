const STORAGE_KEY = 'wengcheng-demo-token';

export function readDemoToken(): string {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveDemoToken(token: string): void {
  const value = token.trim();
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, value);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Session storage is optional. The server still guards every protected action.
  }
}

export function clearDemoToken(): void {
  saveDemoToken('');
}

export function captureDemoTokenFromUrl(): string {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (!token) return '';
    saveDemoToken(token);
    url.searchParams.delete('token');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    return token.trim();
  } catch {
    return '';
  }
}

captureDemoTokenFromUrl();
