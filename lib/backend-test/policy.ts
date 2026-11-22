export class BackendTestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function checkBackendTestRequest(request: Request, environment: string | undefined) {
  if (environment !== "development") throw new BackendTestError(404, "Not found.");
  const url = new URL(request.url);
  // Next's local server may normalize request.url to localhost while Host remains 127.0.0.1.
  const origin = new URL(`${url.protocol}//${request.headers.get("host") ?? url.host}`);
  const loopback = ["localhost", "127.0.0.1", "[::1]"];
  if (!loopback.includes(url.hostname) || !loopback.includes(origin.hostname)) {
    throw new BackendTestError(404, "Not found.");
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new BackendTestError(403, "Use the local test page.");
  if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== origin.origin) {
    throw new BackendTestError(403, "Use the local test page.");
  }
}
