'use client';

import { useCallback, useState, useEffect } from 'react';

const STORAGE_PREFIX = process.env.NEXT_PUBLIC_STORAGE_PREFIX || 'mdviewer';
const COLLAPSED_KEY = `${STORAGE_PREFIX}-collapsed-folders`;

function readCollapsed(): Set<string> {
  try {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

export function useExpandedFolders() {
  // null = not yet mounted; default to all-collapsed so folders saved as
  // closed are never briefly shown expanded during SSR/hydration.
  const [collapsed, setCollapsed] = useState<Set<string> | null>(null);

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  const isExpanded = useCallback(
    (path: string) => {
      if (collapsed === null) return false;
      return !collapsed.has(path);
    },
    [collapsed]
  );

  const toggleFolder = useCallback((path: string) => {
    setCollapsed((prev) => {
      const current = prev ?? new Set<string>();
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { isExpanded, toggleFolder };
}
