import { parseSchedule } from "./parse";
import type { Schedule } from "./model";

export type DefaultScheduleEntry = {
  id: string;
  label: string;
  description?: string;
  path: string;
};

export const DEFAULT_SCHEDULES_DIR = "/schedules/defaults/";
export const PREFERRED_DEFAULT_SCHEDULE_ID = "latarjet_schedule.json";

const KNOWN_DEFAULT_SCHEDULE_FILES = [
  "latarjet_schedule.json",
  "demo-small-plan-v1.json",
  "template-v1.json",
] as const;

function knownDefaultEntries(): DefaultScheduleEntry[] {
  return KNOWN_DEFAULT_SCHEDULE_FILES.map((id) => ({
    id,
    label: labelFromFilename(id),
    path: `${DEFAULT_SCHEDULES_DIR}${id}`,
  }));
}

function labelFromFilename(name: string) {
  return name
    .replace(/\.json$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueByPath(entries: DefaultScheduleEntry[]) {
  const seen = new Set<string>();
  return entries.filter((x) => {
    if (seen.has(x.path)) return false;
    seen.add(x.path);
    return true;
  });
}

function parseJsonLinksFromDirectoryHtml(html: string): string[] {
  const out = new Set<string>();
  const hrefRegex = /href\s*=\s*(["'])(.*?)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRegex.exec(html))) {
    const raw = m[2] || "";
    if (!raw.toLowerCase().endsWith(".json")) continue;
    out.add(raw);
  }
  return [...out];
}

function normalizeToDefaultsPath(href: string): string | null {
  if (!href) return null;
  if (href.startsWith("http://") || href.startsWith("https://")) return null;

  const base = DEFAULT_SCHEDULES_DIR;
  if (href.startsWith(base)) return href;
  if (href.startsWith("/")) return null;

  const normalized = `${base}${href.replace(/^\.\//, "")}`;
  return normalized;
}

export async function loadDefaultScheduleManifest(dir = DEFAULT_SCHEDULES_DIR): Promise<DefaultScheduleEntry[]> {
  let hrefs: string[] = [];

  try {
    const res = await fetch(dir, { cache: "no-store" });
    if (res.ok) {
      const html = await res.text();
      hrefs = parseJsonLinksFromDirectoryHtml(html);
    }
  } catch {
    hrefs = [];
  }

  const entriesFromDirectory = hrefs
    .map(normalizeToDefaultsPath)
    .filter((x): x is string => Boolean(x))
    .map((path) => {
      const file = path.split("/").pop() ?? path;
      return {
        id: file,
        label: labelFromFilename(file),
        path,
      } as DefaultScheduleEntry;
    });

  const entries = uniqueByPath([...entriesFromDirectory, ...knownDefaultEntries()]).sort((a, b) => {
    if (a.id === PREFERRED_DEFAULT_SCHEDULE_ID && b.id !== PREFERRED_DEFAULT_SCHEDULE_ID) return -1;
    if (b.id === PREFERRED_DEFAULT_SCHEDULE_ID && a.id !== PREFERRED_DEFAULT_SCHEDULE_ID) return 1;
    return a.label.localeCompare(b.label);
  });

  return entries;
}

export async function loadDefaultSchedule(entry: DefaultScheduleEntry): Promise<Schedule> {
  const res = await fetch(entry.path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load default schedule '${entry.id}' (${res.status}).`);
  const raw = await res.json();
  const parsed = parseSchedule(raw);
  if (!parsed.ok) throw new Error(parsed.errors.join(" "));
  return parsed.value;
}
