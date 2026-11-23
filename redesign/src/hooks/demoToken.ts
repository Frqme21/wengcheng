const STORAGE_KEY = 'wengcheng-demo-token';

let memoryToken = '';

export function readDemoToken(): string {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) return stored.trim();
  } catch {
    // Session storage can be blocked in kiosk or privacy modes.
  }
  return memoryToken;
}

export function saveDemoToken(token: string): void {
  const value = token.trim();
  memoryToken = value;
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, value);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // The in-memory fallback keeps protected actions working for this tab.
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
