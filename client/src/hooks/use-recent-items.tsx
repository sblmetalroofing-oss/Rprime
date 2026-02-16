import { useState, useEffect, useCallback } from "react";

export interface RecentItem {
  id: string;
  type: "job" | "customer" | "quote" | "invoice" | "report";
  title: string;
  subtitle?: string;
  href: string;
  timestamp: number;
}

const STORAGE_KEY = "rprime_recent_items";
const MAX_ITEMS = 10;

export function useRecentItems() {
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const items = JSON.parse(stored) as RecentItem[];
        setRecentItems(items);
      }
    } catch (e) {
      console.error("Failed to load recent items:", e);
    }
  }, []);

  const addRecentItem = useCallback((item: Omit<RecentItem, "timestamp">) => {
    setRecentItems((prev) => {
      const filtered = prev.filter((i) => !(i.id === item.id && i.type === item.type));
      const newItem: RecentItem = { ...item, timestamp: Date.now() };
      const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save recent items:", e);
      }
      return updated;
    });
  }, []);

  const clearRecentItems = useCallback(() => {
    setRecentItems([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { recentItems, addRecentItem, clearRecentItems };
}
