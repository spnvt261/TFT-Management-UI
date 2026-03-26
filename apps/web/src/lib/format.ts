import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { env } from "@/lib/env";

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const resolveTimezone = (override?: string) => override ?? env.appTimeZone ?? browserZone;

export type MoneyDisplayMode = "vnd" | "dong" | "basic";

export const MONEY_DISPLAY_MODE_STORAGE_KEY = "tft2.settings.money.display-mode";
export const DEFAULT_MONEY_DISPLAY_MODE: MoneyDisplayMode = "vnd";

const isMoneyDisplayMode = (value: string | null): value is MoneyDisplayMode =>
  value === "vnd" || value === "dong" || value === "basic";

export const getMoneyDisplayMode = (): MoneyDisplayMode => {
  if (typeof window === "undefined") {
    return DEFAULT_MONEY_DISPLAY_MODE;
  }

  const raw = window.localStorage.getItem(MONEY_DISPLAY_MODE_STORAGE_KEY);
  return isMoneyDisplayMode(raw) ? raw : DEFAULT_MONEY_DISPLAY_MODE;
};

export const setMoneyDisplayMode = (mode: MoneyDisplayMode) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(MONEY_DISPLAY_MODE_STORAGE_KEY, mode);
};

export const formatVnd = (value: number, modeOverride?: MoneyDisplayMode): string => {
  const mode = modeOverride ?? getMoneyDisplayMode();
  const formatter = new Intl.NumberFormat("vi-VN");

  if (mode === "dong") {
    return `${formatter.format(value)}đ`;
  }

  if (mode === "basic") {
    const normalized = value / 1000;
    const compactFormatter = new Intl.NumberFormat("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: Number.isInteger(normalized) ? 0 : 1
    });
    return compactFormatter.format(normalized);
  }

  return `${formatter.format(value)} VND`;
};

export const formatDateTime = (iso: string | null | undefined, overrideTz?: string): string => {
  if (!iso) {
    return "-";
  }

  const tz = resolveTimezone(overrideTz);
  return dayjs.utc(iso).tz(tz).format("DD/MM/YYYY HH:mm");
};

export const formatDate = (iso: string | null | undefined, overrideTz?: string): string => {
  if (!iso) {
    return "-";
  }

  const tz = resolveTimezone(overrideTz);
  return dayjs.utc(iso).tz(tz).format("DD/MM/YYYY");
};

export const formatRelativeTime = (iso: string | null | undefined): string => {
  if (!iso) {
    return "-";
  }

  return dayjs(iso).fromNow();
};

export const nowIso = () => dayjs().toISOString();
