export function safeReturnPath(value: unknown, fallback = "/my-recipes") {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      /[\r\n]/.test(decoded)
    )
      return fallback;
    const url = new URL(value, "https://savor.local");
    if (
      url.origin !== "https://savor.local" ||
      /^\/sign-(in|up)(\/|$)/.test(url.pathname)
    )
      return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
