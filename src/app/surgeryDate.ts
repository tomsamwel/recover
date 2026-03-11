import { SURGERY_DATE_OVERRIDE_KEY } from "./storage/keys";

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad2 = (n: number) => String(n).padStart(2, "0");

export type SurgeryDateSource = "manual" | "schedule" | "today";

export type ResolvedSurgeryDate = {
  value: string;
  source: SurgeryDateSource;
  date: Date;
};

type ResolveSurgeryDateParams = {
  manualSelection?: string | null;
  scheduleAnchorAt?: string | null;
  scheduleSurgeryStart?: string | null;
  now?: Date;
};

function localDateToDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

export function formatDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDateOnly(value?: string | null): Date | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  const match = DATE_ONLY_RE.exec(s);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

export function normalizeDateOnly(value?: string | null): string | null {
  const parsed = parseDateOnly(value);
  return parsed ? formatDateOnly(parsed) : null;
}

export function dateOnlyFromDateTime(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const dateOnly = normalizeDateOnly(value);
  if (dateOnly) return dateOnly;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return formatDateOnly(d);
}

export function surgeryDateSourceHint(source: SurgeryDateSource): string {
  if (source === "manual") return "Manual override";
  if (source === "schedule") return "Using schedule";
  return "Using today";
}

export function formatSurgeryDateLabel(value?: string | null, locales?: string | string[]): string {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return "Unknown";
  const d = parseDateOnly(normalized);
  if (!d) return normalized;
  return d.toLocaleDateString(locales, { year: "numeric", month: "short", day: "numeric" });
}

export function canResetSurgeryDate(source: SurgeryDateSource): boolean {
  return source === "manual";
}

export function resolveSurgeryDate({
  manualSelection,
  scheduleAnchorAt,
  scheduleSurgeryStart,
  now = new Date(),
}: ResolveSurgeryDateParams): ResolvedSurgeryDate {
  const manual = normalizeDateOnly(manualSelection);
  if (manual) {
    return {
      value: manual,
      source: "manual",
      date: parseDateOnly(manual) as Date,
    };
  }

  const fromSchedule = dateOnlyFromDateTime(scheduleAnchorAt) ?? dateOnlyFromDateTime(scheduleSurgeryStart);
  if (fromSchedule) {
    return {
      value: fromSchedule,
      source: "schedule",
      date: parseDateOnly(fromSchedule) as Date,
    };
  }

  const today = formatDateOnly(now);
  return {
    value: today,
    source: "today",
    date: parseDateOnly(today) as Date,
  };
}

export function calendarDayDiff(now: Date, anchor: Date): number {
  return localDateToDayNumber(now) - localDateToDayNumber(anchor);
}

export function loadManualSurgeryDateOverride(): string | null {
  try {
    return normalizeDateOnly(localStorage.getItem(SURGERY_DATE_OVERRIDE_KEY));
  } catch {
    return null;
  }
}

export function saveManualSurgeryDateOverride(value: string | null): void {
  try {
    const normalized = normalizeDateOnly(value);
    if (!normalized) {
      localStorage.removeItem(SURGERY_DATE_OVERRIDE_KEY);
      return;
    }
    localStorage.setItem(SURGERY_DATE_OVERRIDE_KEY, normalized);
  } catch {
    // No-op by design.
  }
}
