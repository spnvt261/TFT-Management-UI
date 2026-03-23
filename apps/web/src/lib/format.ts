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

export const formatVnd = (value: number): string => {
  return `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
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
