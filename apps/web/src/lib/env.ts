const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const isLocalHostName = (hostname: string) => LOCALHOST_NAMES.has(hostname.toLowerCase());

const resolveDefaultApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    if (import.meta.env.PROD) {
      return window.location.origin;
    }

    const protocol = window.location.protocol || "http:";
    const hostname = window.location.hostname || "localhost";
    return `${protocol}//${hostname}:3000`;
  }

  return "http://localhost:3000";
};

const resolveApiBaseUrl = () => {
  const configuredValue = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!configuredValue || configuredValue.trim().length === 0) {
    return resolveDefaultApiBaseUrl();
  }

  if (typeof window === "undefined") {
    return configuredValue;
  }

  try {
    const configuredUrl = new URL(configuredValue);
    const currentHost = window.location.hostname;
    const shouldRewriteLocalhost =
      !isLocalHostName(currentHost) && isLocalHostName(configuredUrl.hostname);

    if (!shouldRewriteLocalhost) {
      return configuredValue;
    }

    configuredUrl.hostname = currentHost;
    return configuredUrl.toString().replace(/\/+$/, "");
  } catch {
    return configuredValue;
  }
};

export const env = {
  apiBaseUrl: resolveApiBaseUrl(),
  appTimeZone: import.meta.env.VITE_APP_TIMEZONE as string | undefined
};
