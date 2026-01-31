import { useState, useCallback, useRef } from 'react';

interface SearchResult {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl100: string;
  feedUrl: string;
}

interface PodcastSearchProps {
  onSelectPodcast: (feedUrl: string) => void;
  isLoading: boolean;
}

export function PodcastSearch({ onSelectPodcast, isLoading }: PodcastSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchPodcasts = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=podcast&limit=10`
      );
      const data = await response.json();

      // Filter to only podcasts with feed URLs
      const podcasts = data.results.filter(
        (result: SearchResult) => result.feedUrl
      );
      setResults(podcasts);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchPodcasts(value);
    }, 300);
  };

  const handleSelectPodcast = (feedUrl: string) => {
    onSelectPodcast(feedUrl);
    setQuery('');
    setResults([]);
    setHasSearched(false);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search for a podcast..."
          className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg
                     text-zinc-100 placeholder-zinc-500
                     focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600
                     transition-colors"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-5 h-5 text-zinc-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          {results.map((podcast) => (
            <button
              key={podcast.collectionId}
              onClick={() => handleSelectPodcast(podcast.feedUrl)}
              disabled={isLoading}
              className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800
                       transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed
                       border-b border-zinc-800 last:border-b-0"
            >
              <img
                src={podcast.artworkUrl100}
                alt={podcast.collectionName}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-zinc-100 font-medium truncate">
                  {podcast.collectionName}
                </p>
                <p className="text-zinc-500 text-sm truncate">
                  {podcast.artistName}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {hasSearched && !isSearching && results.length === 0 && query.trim() && (
        <p className="text-zinc-500 text-sm text-center py-4">
          No podcasts found for "{query}"
        </p>
      )}
    </div>
  );
}
