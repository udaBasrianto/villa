import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFavoritesStorageKey(userId?: string | null) {
  return `favorites_${userId || "guest"}`;
}

export function readFavoriteIds(userId?: string | null) {
  const key = getFavoritesStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => String(v)).filter(Boolean);
  } catch {
    return [];
  }
}

export function writeFavoriteIds(userId: string | null | undefined, ids: string[]) {
  const key = getFavoritesStorageKey(userId);
  localStorage.setItem(key, JSON.stringify(ids));
}

export function isFavoriteId(userId: string | null | undefined, id: string) {
  return readFavoriteIds(userId).includes(id);
}

export function toggleFavoriteId(userId: string | null | undefined, id: string) {
  const ids = readFavoriteIds(userId);
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  writeFavoriteIds(userId, next);
  window.dispatchEvent(new CustomEvent("favorites:updated"));
  return { ids: next, isFavorite: next.includes(id) };
}
