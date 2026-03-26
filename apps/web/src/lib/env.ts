const resolveDefaultApiBaseUrl = () => {
  if (typeof window !== "undefined" && import.meta.env.PROD) {
    return window.location.origin;
  }

  return "http://localhost:3000";
};

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? resolveDefaultApiBaseUrl(),
  appTimeZone: import.meta.env.VITE_APP_TIMEZONE as string | undefined
};
