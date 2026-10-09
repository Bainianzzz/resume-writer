/**
 * GM API 测试替身。vitest 通过 alias 把 `$` 指向本文件。
 * 提供内存存储与可编程的 GM_xmlhttpRequest，便于单测 storage / jev。
 */
const store = new Map<string, unknown>();

export function GM_getValue<T = unknown>(key: string, defaultValue?: T): T {
  return (store.has(key) ? store.get(key) : defaultValue) as T;
}

export function GM_setValue(key: string, value: unknown): void {
  store.set(key, value);
}

export function GM_addStyle(_css: string): HTMLStyleElement {
  return document.createElement('style');
}

export function GM_registerMenuCommand(_caption: string, _onClick: () => void): string {
  return 'mock-id';
}

export interface MockResponse {
  status?: number;
  ok?: boolean;
  text: string;
  responseHeaders?: string;
}

/** 测试可设置下一次 GM_xmlhttpRequest 的响应或错误 */
export const gmMock = {
  nextResponse: null as MockResponse | null,
  nextError: null as Error | null,
  /** 持续失败（用于重试路径），优先级高于 nextError */
  alwaysError: null as Error | null,
  lastRequest: null as { method: string; url: string; headers: Record<string, string>; data: string } | null,
};

export function GM_xmlhttpRequest(options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  data?: string;
  responseType?: string;
  timeout?: number;
  onload?: (res: {
    status: number;
    responseText: string;
    responseHeaders: string;
  }) => void;
  onerror?: () => void;
  ontimeout?: () => void;
}): { abort: () => void } {
  gmMock.lastRequest = {
    method: options.method,
    url: options.url,
    headers: options.headers ?? {},
    data: options.data ?? '',
  };
  const respond = () => {
    if (gmMock.alwaysError) {
      options.onerror?.();
      return;
    }
    if (gmMock.nextError) {
      gmMock.nextError = null;
      options.onerror?.();
      return;
    }
    const r = gmMock.nextResponse ?? { text: '{}' };
    gmMock.nextResponse = null;
    const status = r.status ?? 200;
    options.onload?.({
      status,
      responseText: r.text,
      responseHeaders: r.responseHeaders ?? '',
    });
  };
  queueMicrotask(respond);
  return { abort: () => {} };
}

/** 供测试重置存储与 mock 状态 */
export function __resetGm(): void {
  store.clear();
  gmMock.nextResponse = null;
  gmMock.nextError = null;
  gmMock.alwaysError = null;
  gmMock.lastRequest = null;
}
