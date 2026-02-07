'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_PREFIX = process.env.NEXT_PUBLIC_STORAGE_PREFIX || 'mdviewer';
const FAVORITES_KEY = `${STORAGE_PREFIX}-favorites`;
const FILTER_MODE_KEY = `${STORAGE_PREFIX}-filter-mode`;

export type FilterMode = 'all' | 'favorites';

// Cached snapshots to avoid infinite loops
const emptyFavoritesSet = new Set<string>();
let cachedFavorites: Set<string> = emptyFavoritesSet;
let cachedFavoritesJson = '';

// Favorites store
let favoritesListeners: Array<() => void> = [];

function subscribeFavorites(callback: () => void) {
  favoritesListeners.push(callback);
  return () => {
    favoritesListeners = favoritesListeners.filter(l => l !== callback);
  };
}

function getFavoritesSnapshot(): Set<string> {
  if (typeof window === 'undefined') return emptyFavoritesSet;
  const stored = localStorage.getItem(FAVORITES_KEY) ?? '';
  // Only create new Set if data changed
  if (stored !== cachedFavoritesJson) {
    cachedFavoritesJson = stored;
    if (stored) {
      try {
        cachedFavorites = new Set(JSON.parse(stored));
      } catch {
        cachedFavorites = emptyFavoritesSet;
      }
    } else {
      cachedFavorites = emptyFavoritesSet;
    }
  }
  return cachedFavorites;
}

function getServerFavoritesSnapshot(): Set<string> {
  return emptyFavoritesSet;
}

function setFavoritesStorage(favorites: Set<string>) {
  const json = JSON.stringify([...favorites]);
  localStorage.setItem(FAVORITES_KEY, json);
  // Update cache immediately
  cachedFavoritesJson = json;
  cachedFavorites = favorites;
  favoritesListeners.forEach(l => l());
}

// Filter mode store
let filterModeListeners: Array<() => void> = [];
let cachedFilterMode: FilterMode = 'all';
let filterModeInitialized = false;

function subscribeFilterMode(callback: () => void) {
  filterModeListeners.push(callback);
  return () => {
    filterModeListeners = filterModeListeners.filter(l => l !== callback);
  };
}

function getFilterModeSnapshot(): FilterMode {
  if (typeof window === 'undefined') return 'all';
  if (!filterModeInitialized) {
    const stored = localStorage.getItem(FILTER_MODE_KEY);
    cachedFilterMode = stored === 'favorites' ? 'favorites' : 'all';
    filterModeInitialized = true;
  }
  return cachedFilterMode;
}

function getServerFilterModeSnapshot(): FilterMode {
  return 'all';
}

function setFilterModeStorage(mode: FilterMode) {
  localStorage.setItem(FILTER_MODE_KEY, mode);
  cachedFilterMode = mode;
  filterModeListeners.forEach(l => l());
}

export function useFavorites() {
  const favorites = useSyncExternalStore(
    subscribeFavorites,
    getFavoritesSnapshot,
    getServerFavoritesSnapshot
  );

  const filterMode = useSyncExternalStore(
    subscribeFilterMode,
    getFilterModeSnapshot,
    getServerFilterModeSnapshot
  );

  const setFilterMode = useCallback((mode: FilterMode) => {
    setFilterModeStorage(mode);
  }, []);

  const toggleFavorite = useCallback((slug: string) => {
    const current = getFavoritesSnapshot();
    const next = new Set(current);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    setFavoritesStorage(next);
  }, []);

  const isFavorite = useCallback((slug: string) => favorites.has(slug), [favorites]);

  return {
    favorites,
    filterMode,
    setFilterMode,
    toggleFavorite,
    isFavorite,
    favoritesCount: favorites.size,
  };
}
