import { useState, useEffect, useCallback, useRef } from 'react';
import { Reaction } from '../types/podcast';

const STORAGE_KEY = 'cast-and-response-reactions';

interface StoredReaction {
  id: string;
  emoji: string;
  timestamp: number;
  comment?: string;
  createdAt: string; // ISO string for JSON serialization
}

interface ReactionsStore {
  [episodeKey: string]: StoredReaction[];
}

function loadFromStorage(): ReactionsStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Failed to load reactions:', err);
  }
  return {};
}

function saveToStorage(store: ReactionsStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.error('Failed to save reactions:', err);
  }
}

function toStoredReaction(reaction: Reaction): StoredReaction {
  return {
    ...reaction,
    createdAt: reaction.createdAt instanceof Date
      ? reaction.createdAt.toISOString()
      : reaction.createdAt,
  };
}

function fromStoredReaction(stored: StoredReaction): Reaction {
  return {
    ...stored,
    createdAt: new Date(stored.createdAt),
  };
}

export function useReactions(episodeKey: string | null) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const storeRef = useRef<ReactionsStore>(loadFromStorage());
  const currentKeyRef = useRef<string | null>(null);

  // Load reactions when episode changes
  useEffect(() => {
    if (episodeKey !== currentKeyRef.current) {
      currentKeyRef.current = episodeKey;

      if (episodeKey) {
        const storedReactions = storeRef.current[episodeKey] || [];
        setReactions(storedReactions.map(fromStoredReaction));
      } else {
        setReactions([]);
      }
    }
  }, [episodeKey]);

  const addReaction = useCallback((emoji: string, timestamp: number, comment?: string) => {
    if (!currentKeyRef.current) return;

    const newReaction: Reaction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      emoji,
      timestamp,
      comment,
      createdAt: new Date(),
    };

    setReactions((prev) => {
      const updated = [...prev, newReaction];

      // Update store and persist
      storeRef.current = {
        ...storeRef.current,
        [currentKeyRef.current!]: updated.map(toStoredReaction),
      };
      saveToStorage(storeRef.current);

      return updated;
    });
  }, []);

  const updateReaction = useCallback((id: string, comment: string) => {
    if (!currentKeyRef.current) return;

    setReactions((prev) => {
      const updated = prev.map((r) =>
        r.id === id ? { ...r, comment: comment || undefined } : r
      );

      // Update store and persist
      storeRef.current = {
        ...storeRef.current,
        [currentKeyRef.current!]: updated.map(toStoredReaction),
      };
      saveToStorage(storeRef.current);

      return updated;
    });
  }, []);

  return {
    reactions,
    addReaction,
    updateReaction,
  };
}
