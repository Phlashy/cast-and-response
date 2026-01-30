import { useState, useCallback, useEffect, useRef } from 'react';
import { FeedInput } from './components/FeedInput';
import { EpisodeList } from './components/EpisodeList';
import { AudioPlayer } from './components/AudioPlayer';
import { EmojiReactions } from './components/EmojiReactions';
import { SavedFeeds } from './components/SavedFeeds';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useSavedFeeds } from './hooks/useSavedFeeds';
import { useReactions } from './hooks/useReactions';
import { Episode, PodcastFeed } from './types/podcast';

const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://cors-anywhere.herokuapp.com/${url}`,
];
const MAX_EPISODES = 10;

async function fetchWithFallback(url: string, signal?: AbortSignal): Promise<string> {
  let lastError: Error | null = null;

  for (const proxyFn of CORS_PROXIES) {
    // Only check user cancellation (not timeout)
    if (signal?.aborted) {
      throw new Error('Cancelled');
    }

    try {
      const proxyUrl = proxyFn(url);

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 8000);
      });

      // Create the fetch promise
      const fetchPromise = fetch(proxyUrl, { signal });

      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (response.ok) {
        return await response.text();
      }
    } catch (err) {
      // Check if user cancelled
      if (signal?.aborted) {
        throw new Error('Cancelled');
      }
      // Timeout or network error - continue to next proxy
      const message = err instanceof Error ? err.message : 'Fetch failed';
      lastError = new Error(message === 'Timeout' ? 'Timeout' : message);
    }
  }

  throw lastError || new Error('All CORS proxies failed. Please try again.');
}

async function parseFeed(url: string, signal?: AbortSignal): Promise<PodcastFeed> {
  const text = await fetchWithFallback(url, signal);
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'application/xml');

  const parseError = xml.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid RSS feed');
  }

  const channel = xml.querySelector('channel');
  if (!channel) {
    throw new Error('Invalid podcast feed: no channel found');
  }

  const title = channel.querySelector(':scope > title')?.textContent || 'Unknown Podcast';
  const description = channel.querySelector(':scope > description')?.textContent || undefined;
  const imageUrl = channel.querySelector(':scope > image > url')?.textContent ||
                   channel.querySelector(':scope > itunes\\:image, :scope > image')?.getAttribute('href') ||
                   undefined;

  const items = channel.querySelectorAll('item');
  const episodes: Episode[] = [];

  // Only process the first MAX_EPISODES items (RSS feeds are typically sorted newest first)
  const itemsArray = Array.from(items).slice(0, MAX_EPISODES);

  for (const item of itemsArray) {
    const enclosure = item.querySelector('enclosure');
    const audioUrl = enclosure?.getAttribute('url');

    if (audioUrl) {
      episodes.push({
        title: item.querySelector('title')?.textContent || 'Untitled Episode',
        pubDate: item.querySelector('pubDate')?.textContent || '',
        audioUrl,
        description: item.querySelector('description')?.textContent || undefined,
        duration: item.querySelector('itunes\\:duration')?.textContent || undefined,
      });
    }
  }

  return { feedUrl: url, title, description, imageUrl, episodes };
}

function App() {
  const [feed, setFeed] = useState<PodcastFeed | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isPlaying, currentTime, duration, isLoaded, playbackRate, togglePlay, seek, setSpeed, loadAudio } = useAudioPlayer();
  const { savedFeeds, saveFeed, removeFeed, isFeedSaved } = useSavedFeeds();
  const { reactions, addReaction, updateReaction } = useReactions(selectedEpisode?.audioUrl || null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleLoadFeed = useCallback(async (url: string) => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);
    setSelectedEpisode(null);

    try {
      const parsedFeed = await parseFeed(url, abortController.signal);
      if (!abortController.signal.aborted) {
        setFeed(parsedFeed);
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        const message = err instanceof Error ? err.message : 'Failed to load feed';
        if (message !== 'Cancelled') {
          setError(message);
        }
      }
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  const handleCancelLoad = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setError(null);
  }, []);

  const handleSaveFeed = useCallback(() => {
    if (feed) {
      saveFeed({
        feedUrl: feed.feedUrl,
        title: feed.title,
        imageUrl: feed.imageUrl,
        savedAt: new Date().toISOString(),
      });
    }
  }, [feed, saveFeed]);

  const handleSelectSavedFeed = useCallback((feedUrl: string) => {
    handleLoadFeed(feedUrl);
  }, [handleLoadFeed]);

  const handleSelectEpisode = useCallback((episode: Episode) => {
    setSelectedEpisode(episode);
    loadAudio(episode.audioUrl);
  }, [loadAudio]);

  useEffect(() => {
    if (selectedEpisode) {
      loadAudio(selectedEpisode.audioUrl);
    }
  }, [selectedEpisode, loadAudio]);

  const isCurrentFeedSaved = feed ? isFeedSaved(feed.feedUrl) : false;

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">
            Cast & Response
          </h1>
          <p className="text-zinc-500">
            Listen to podcasts and react with timestamped comments
          </p>
        </header>

        <div className="mb-6">
          <FeedInput onLoadFeed={handleLoadFeed} onCancel={handleCancelLoad} isLoading={isLoading} />
        </div>

        <SavedFeeds
          savedFeeds={savedFeeds}
          currentFeedUrl={feed?.feedUrl || null}
          onSelectFeed={handleSelectSavedFeed}
          onRemoveFeed={removeFeed}
        />

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {feed && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {feed.imageUrl && (
                <img
                  src={feed.imageUrl}
                  alt={feed.title}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-zinc-100">{feed.title}</h2>
                <p className="text-sm text-zinc-500">{feed.episodes.length} episodes</p>
              </div>
              {!isCurrentFeedSaved && (
                <button
                  onClick={handleSaveFeed}
                  className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg
                           text-sm text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600
                           transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Save
                </button>
              )}
              {isCurrentFeedSaved && (
                <span className="px-4 py-2 text-sm text-zinc-500 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  Saved
                </span>
              )}
            </div>

            {selectedEpisode && (
              <>
                <AudioPlayer
                  episode={selectedEpisode}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={duration}
                  isLoaded={isLoaded}
                  playbackRate={playbackRate}
                  reactions={reactions}
                  onTogglePlay={togglePlay}
                  onSeek={seek}
                  onSetSpeed={setSpeed}
                />
                <EmojiReactions
                  currentTime={currentTime}
                  onAddReaction={addReaction}
                  onUpdateReaction={updateReaction}
                  reactions={reactions}
                  onSeekToReaction={seek}
                />
              </>
            )}

            <div>
              <h3 className="text-lg font-medium text-zinc-100 mb-4">Episodes</h3>
              <EpisodeList
                episodes={feed.episodes}
                selectedEpisode={selectedEpisode}
                onSelectEpisode={handleSelectEpisode}
              />
            </div>
          </div>
        )}

        {!feed && !isLoading && !error && (
          <div className="text-center py-16 text-zinc-600">
            <p className="text-lg">Paste a podcast RSS feed URL to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
