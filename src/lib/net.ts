/** fetch with timeout + exponential backoff — survives spotty networks. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface NetOptions {
  timeoutMs?: number;
  retries?: number;
  retryOn429?: boolean;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: NetOptions = {}
): Promise<Response> {
  const { timeoutMs = 15_000, retries = 2, retryOn429 = true } = opts;
  let lastErr: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if ((res.status >= 500 || res.status === 429) && attempt < retries && !(res.status === 429 && !retryOn429)) {
        lastErr = new Error(`HTTP ${res.status}`);
        await sleep(400 * 2 ** attempt);
        continue;
      }
      return res;
    } catch (e: any) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
    }
  }
  throw lastErr || new Error("network error");
}

export async function fetchJSON<T = any>(
  url: string,
  init: RequestInit = {},
  opts: NetOptions = {}
): Promise<T> {
  const res = await fetchWithRetry(url, init, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
