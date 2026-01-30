import { useState, useEffect, useCallback, useRef } from 'react';
import { SavedFeed } from '../types/podcast';

const STORAGE_KEY = 'cast-and-response-saved-feeds';

function loadFromStorage(): SavedFeed[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Failed to load saved feeds:', err);
  }
  return [];
}

export function useSavedFeeds() {
  // Initialize from localStorage immediately (not in useEffect)
  const [savedFeeds, setSavedFeeds] = useState<SavedFeed[]>(loadFromStorage);
  const isInitialized = useRef(false);

  // Save to localStorage whenever savedFeeds changes (but not on initial mount)
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedFeeds));
    } catch (err) {
      console.error('Failed to save feeds:', err);
    }
  }, [savedFeeds]);

  const saveFeed = useCallback((feed: SavedFeed) => {
    setSavedFeeds((prev) => {
      // Don't add duplicates
      if (prev.some((f) => f.feedUrl === feed.feedUrl)) {
        return prev;
      }
      return [...prev, feed];
    });
  }, []);

  const removeFeed = useCallback((feedUrl: string) => {
    setSavedFeeds((prev) => prev.filter((f) => f.feedUrl !== feedUrl));
  }, []);

  const isFeedSaved = useCallback(
    (feedUrl: string) => savedFeeds.some((f) => f.feedUrl === feedUrl),
    [savedFeeds]
  );

  return {
    savedFeeds,
    saveFeed,
    removeFeed,
    isFeedSaved,
  };
}
