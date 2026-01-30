import { SavedFeed } from '../types/podcast';

interface SavedFeedsProps {
  savedFeeds: SavedFeed[];
  currentFeedUrl: string | null;
  onSelectFeed: (feedUrl: string) => void;
  onRemoveFeed: (feedUrl: string) => void;
}

export function SavedFeeds({
  savedFeeds,
  currentFeedUrl,
  onSelectFeed,
  onRemoveFeed,
}: SavedFeedsProps) {
  if (savedFeeds.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-zinc-400 mb-3">Your Podcasts</h3>
      <div className="flex flex-wrap gap-2">
        {savedFeeds.map((feed) => {
          const isActive = feed.feedUrl === currentFeedUrl;
          return (
            <div
              key={feed.feedUrl}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
                         ${isActive
                           ? 'bg-zinc-800 border-zinc-600'
                           : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700'}`}
            >
              <button
                onClick={() => onSelectFeed(feed.feedUrl)}
                className="flex items-center gap-2"
              >
                {feed.imageUrl ? (
                  <img
                    src={feed.imageUrl}
                    alt={feed.title}
                    className="w-6 h-6 rounded object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-zinc-700 flex items-center justify-center text-xs">
                    🎙️
                  </div>
                )}
                <span className="text-sm text-zinc-200 max-w-[150px] truncate">
                  {feed.title}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFeed(feed.feedUrl);
                }}
                className="text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove from saved"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
