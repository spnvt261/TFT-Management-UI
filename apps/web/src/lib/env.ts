export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://192.168.0.101:3000",
  appTimeZone: import.meta.env.VITE_APP_TIMEZONE as string | undefined
};
