export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
const REQUEST_TIMEOUT_MS = 30_000;

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    cache: "no-store",
    ...options,
    signal: options.signal
      ? AbortSignal.any([
          options.signal,
          AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        ])
      : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      typeof body?.detail === "string"
        ? body.detail
        : `请求失败 (${response.status})`,
      response.status,
    );
  }
  return response.json();
}
export const write = <T>(path: string, body: unknown, method = "POST") =>
  api<T>(path, { method, body: JSON.stringify(body) });
