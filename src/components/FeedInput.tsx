import { useState } from 'react';

interface FeedInputProps {
  onLoadFeed: (url: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function FeedInput({ onLoadFeed, onCancel, isLoading }: FeedInputProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onLoadFeed(url.trim());
    }
  };

  return (
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
          Load Feed
        </button>
      )}
    </form>
  );
}
