import { useState, useEffect, useCallback, useRef } from 'react';
import { Reaction } from '../types/podcast';

const STORAGE_KEY = 'cast-and-response-reactions';
const API_BASE = '';

interface StoredReaction {
  id: string;
  emoji: string;
  timestamp: number;
  comment?: string;
  createdAt: string;
}

interface ReactionsStore {
  [episodeKey: string]: StoredReaction[];
}

interface EpisodeInfo {
  podcastTitle?: string;
  episodeTitle?: string;
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
    id: String(reaction.id),
    createdAt: reaction.createdAt instanceof Date
      ? reaction.createdAt.toISOString()
      : reaction.createdAt,
  };
}

function fromStoredReaction(stored: StoredReaction): Reaction {
  return {
    ...stored,
    id: String(stored.id),
    createdAt: new Date(stored.createdAt),
  };
}

export function useReactions(
  episodeKey: string | null,
  token: string | null = null,
  episodeInfo: EpisodeInfo = {}
) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const storeRef = useRef<ReactionsStore>(loadFromStorage());
  const currentKeyRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(token);

  // Keep token ref updated
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Load reactions when episode changes
  useEffect(() => {
    if (episodeKey !== currentKeyRef.current) {
      currentKeyRef.current = episodeKey;

      if (episodeKey) {
        // First load from local storage
        const storedReactions = storeRef.current[episodeKey] || [];
        setReactions(storedReactions.map(fromStoredReaction));

        // If logged in, also fetch from server
        if (token) {
          setIsSyncing(true);
          fetch(`${API_BASE}/api/reactions?episode=${encodeURIComponent(episodeKey)}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.reactions) {
                // Server returns created_at, we need createdAt
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const serverReactions = data.reactions.map((r: any) => ({
                  id: String(r.id),
                  emoji: r.emoji,
                  timestamp: r.timestamp,
                  comment: r.comment,
                  createdAt: new Date(r.created_at || r.createdAt),
                }));
                setReactions(serverReactions);
                // Update local storage with server data
                storeRef.current = {
                  ...storeRef.current,
                  [episodeKey]: serverReactions.map(toStoredReaction),
                };
                saveToStorage(storeRef.current);
              }
            })
            .catch((err) => console.error('Failed to fetch reactions:', err))
            .finally(() => setIsSyncing(false));
        }
      } else {
        setReactions([]);
      }
    }
  }, [episodeKey, token]);

  const addReaction = useCallback((emoji: string, timestamp: number, comment?: string) => {
    if (!currentKeyRef.current) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newReaction: Reaction = {
      id: tempId,
      emoji,
      timestamp,
      comment,
      createdAt: new Date(),
    };

    // Optimistically add to state
    setReactions((prev) => {
      const updated = [...prev, newReaction];
      storeRef.current = {
        ...storeRef.current,
        [currentKeyRef.current!]: updated.map(toStoredReaction),
      };
      saveToStorage(storeRef.current);
      return updated;
    });

    // If logged in, sync to server
    if (tokenRef.current && currentKeyRef.current) {
      fetch(`${API_BASE}/api/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({
          episodeUrl: currentKeyRef.current,
          podcastTitle: episodeInfo.podcastTitle,
          episodeTitle: episodeInfo.episodeTitle,
          emoji,
          timestamp,
          comment,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.reaction) {
            // Update with server-assigned ID
            setReactions((prev) => {
              const updated = prev.map((r) =>
                r.id === tempId
                  ? { ...r, id: String(data.reaction.id) }
                  : r
              );
              storeRef.current = {
                ...storeRef.current,
                [currentKeyRef.current!]: updated.map(toStoredReaction),
              };
              saveToStorage(storeRef.current);
              return updated;
            });
          }
        })
        .catch((err) => console.error('Failed to save reaction:', err));
    }
  }, [episodeInfo.podcastTitle, episodeInfo.episodeTitle]);

  const updateReaction = useCallback((id: string, comment: string) => {
    if (!currentKeyRef.current) return;

    setReactions((prev) => {
      const updated = prev.map((r) =>
        r.id === id ? { ...r, comment: comment || undefined } : r
      );
      storeRef.current = {
        ...storeRef.current,
        [currentKeyRef.current!]: updated.map(toStoredReaction),
      };
      saveToStorage(storeRef.current);
      return updated;
    });

    // Note: For simplicity, we're not syncing comment updates to server in demo
    // Could add a PUT endpoint if needed
  }, []);

  return {
    reactions,
    addReaction,
    updateReaction,
    isSyncing,
  };
}
