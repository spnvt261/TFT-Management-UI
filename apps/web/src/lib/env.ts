export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
  appTimeZone: import.meta.env.VITE_APP_TIMEZONE as string | undefined
};
