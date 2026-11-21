import {Capacitor} from '@capacitor/core';

export const DEFAULT_REMOTE_API_BASE =
  'https://ais-pre-z4bsfhyxrhu6b3basuglxm-185855289746.europe-west2.run.app';

const STORAGE_API_BASE_KEY = 'frenchtype_api_base_url_v1';

export function isNativeAppRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    // ignore
  }
  return (
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    (window.location.hostname === 'localhost' && window.location.port === '')
  );
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = localStorage.getItem(STORAGE_API_BASE_KEY)?.trim();
    if (saved) return saved.replace(/\/+$/, '');
  } catch {
    // ignore
  }
  const envBase = (import.meta as unknown as {env?: Record<string, string>}).env?.VITE_API_BASE_URL;
  if (envBase && envBase.trim()) {
    return envBase.trim().replace(/\/+$/, '');
  }
  if (isNativeAppRuntime()) {
    return DEFAULT_REMOTE_API_BASE;
  }
  return '';
}

export function setApiBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (trimmed) {
      localStorage.setItem(STORAGE_API_BASE_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_API_BASE_KEY);
    }
  } catch {
    // ignore
  }
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
