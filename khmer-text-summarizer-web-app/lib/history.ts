"use client";

import { useCallback, useEffect, useState } from "react";

export type HistoryItem = {
  id: string;
  createdAt: number;
  sourceText: string;
  summary: string;
  format: "paragraph" | "bullets";
  model: string;
  sourceWordCount: number;
  summaryWordCount: number;
  compressionRatio: number;
  durationMs: number;
};

const STORAGE_KEY = "distill.history";
const MAX_ITEMS = 50;

function read(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* quota or unavailable - ignore */
  }
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setItems(read());
    const handler = () => setItems(read());
    listeners.add(handler);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) handler();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
    }
    return () => {
      listeners.delete(handler);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    };
  }, []);

  const add = useCallback((item: Omit<HistoryItem, "id" | "createdAt">) => {
    const next: HistoryItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    const merged = [next, ...read()].slice(0, MAX_ITEMS);
    write(merged);
    emit();
    return next;
  }, []);

  const remove = useCallback((id: string) => {
    const next = read().filter((i) => i.id !== id);
    write(next);
    emit();
  }, []);

  const clear = useCallback(() => {
    write([]);
    emit();
  }, []);

  return { items, add, remove, clear };
}
