import { useState } from 'react';
import { PodcastSearch } from './PodcastSearch';

interface FeedInputProps {
  onLoadFeed: (url: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  loadingStatus: string;
}

type InputMode = 'search' | 'url';

export function FeedInput({ onLoadFeed, onCancel, isLoading, loadingStatus }: FeedInputProps) {
  const [mode, setMode] = useState<InputMode>('search');
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onLoadFeed(url.trim());
    }
  };

  return (
    <div className="space-y-3">
      {/* Tab buttons */}
      <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg w-fit">
        <button
          onClick={() => setMode('search')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'search'
              ? 'bg-zinc-700 text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-300'
          }`}
        >
          Search
        </button>
        <button
          onClick={() => setMode('url')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'url'
              ? 'bg-zinc-700 text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-300'
          }`}
        >
          RSS URL
        </button>
      </div>

      {/* Search mode */}
      {mode === 'search' && (
        <PodcastSearch onSelectPodcast={onLoadFeed} isLoading={isLoading} />
      )}

      {/* URL mode */}
      {mode === 'url' && (
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste podcast RSS feed URL..."
            className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg
                       text-zinc-100 placeholder-zinc-500
                       focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600
                       transition-colors"
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }}
              className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg
                         hover:bg-red-500 transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              type="submit"
              disabled={!url.trim()}
              className="px-6 py-3 bg-zinc-100 text-zinc-900 font-medium rounded-lg
                         hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              Load
            </button>
          )}
        </form>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-zinc-400 text-sm">{loadingStatus || 'Loading...'}</span>
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg
                       hover:bg-red-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
