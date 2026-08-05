const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function resolveSecureOrigin(value: string | undefined, fallback: string): string {
  const origin = value ?? fallback;
  const url = new URL(origin);
  const localDevelopmentOrigin = typeof __DEV__ !== "undefined" && __DEV__
    && url.protocol === "http:"
    && LOOPBACK_HOSTS.has(url.hostname);

  if (url.protocol !== "https:" && !localDevelopmentOrigin) {
    throw new Error(`Insecure mobile origin is not allowed: ${url.origin}`);
  }

  return url.origin;
}
