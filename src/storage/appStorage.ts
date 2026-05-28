import { defaultAppData } from "../data/defaultData";
import type { AppData } from "../types";

export const STORAGE_KEY = "ninja-finance-v1";

export function loadAppData(storage: Storage = window.localStorage): AppData {
  const rawData = storage.getItem(STORAGE_KEY);
  if (!rawData) return defaultAppData;

  try {
    return normalizeAppData(JSON.parse(rawData));
  } catch {
    return defaultAppData;
  }
}

export function saveAppData(
  data: AppData,
  storage: Storage = window.localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function normalizeAppData(data: unknown): AppData {
  if (!data || typeof data !== "object") return defaultAppData;
  const candidate = data as Partial<AppData>;

  return {
    transactions: Array.isArray(candidate.transactions)
      ? candidate.transactions
      : [],
    categories: Array.isArray(candidate.categories)
      ? candidate.categories
      : defaultAppData.categories,
    settings: {
      ...defaultAppData.settings,
      ...(candidate.settings ?? {}),
      currency: "THB",
      dateLocale: "th-TH",
      schemaVersion: 1,
    },
  };
}
