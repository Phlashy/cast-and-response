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
  // Our own Vercel proxy (no size limits)
  (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`,
  // Fallback public proxies
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];
const MAX_EPISODES = 10;
const DEFAULT_FEED_URL = 'https://feed.articlesofinterest.club/';

const SAMPLE_FEEDS = [
  { name: 'This American Life', url: 'https://www.thisamericanlife.org/podcast/rss.xml' },
  { name: 'The Rest Is Politics', url: 'https://feeds.megaphone.fm/GLT9190936013' },
  { name: 'The Daily', url: 'https://feeds.simplecast.com/Sl5CSM3S' },
  { name: 'Science Vs', url: 'https://feeds.megaphone.fm/sciencevs' },
  { name: 'The Memory Palace', url: 'http://feeds.thememorypalace.us/thememorypalace' },
];

async function fetchWithParallelProxies(
  url: string,
  signal?: AbortSignal,
  onStatus?: (status: string) => void
): Promise<string> {
  if (signal?.aborted) {
    throw new Error('Cancelled');
  }

  onStatus?.('Connecting to feed...');

  // Create an AbortController for each proxy so we can cancel losers
  const proxyControllers = CORS_PROXIES.map(() => new AbortController());
  let winningIndex = -1;

  // If parent signal aborts, abort all proxies
  const abortAll = () => proxyControllers.forEach((c) => c.abort());
  const abortLosers = () => proxyControllers.forEach((c, i) => {
    if (i !== winningIndex) c.abort();
  });
  signal?.addEventListener('abort', abortAll);

  try {
    // Race all proxies in parallel with a 45s overall timeout
    const fetchPromises = CORS_PROXIES.map(async (proxyFn, index) => {
      const proxyUrl = proxyFn(url);
      const response = await fetch(proxyUrl, { signal: proxyControllers[index].signal });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // This proxy won the race - mark it and cancel others
      winningIndex = index;
      abortLosers();

      onStatus?.('Downloading feed data...');
      const text = await response.text();
      return text;
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 45000);
    });

    // Use Promise.any to get the first successful response
    const result = await Promise.race([
      Promise.any(fetchPromises),
      timeoutPromise,
    ]);

    onStatus?.('Parsing episodes...');
    return result;
  } catch (err) {
    if (signal?.aborted) {
      throw new Error('Cancelled');
    }
    // Promise.any throws AggregateError if all promises reject
    throw new Error('Failed to load feed. The podcast server may be slow or unavailable.');
  } finally {
    signal?.removeEventListener('abort', abortAll);
  }
}

async function parseFeed(
  url: string,
  signal?: AbortSignal,
  onStatus?: (status: string) => void
): Promise<PodcastFeed> {
  const text = await fetchWithParallelProxies(url, signal, onStatus);
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
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(true);

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
    setLoadingStatus('Connecting to feed...');
    setError(null);
    setSelectedEpisode(null);

    try {
      const parsedFeed = await parseFeed(url, abortController.signal, setLoadingStatus);
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
        setLoadingStatus('');
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

  // Auto-load default feed on mount
  useEffect(() => {
    handleLoadFeed(DEFAULT_FEED_URL);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          <FeedInput onLoadFeed={handleLoadFeed} onCancel={handleCancelLoad} isLoading={isLoading} loadingStatus={loadingStatus} />
        </div>

        <SavedFeeds
          savedFeeds={savedFeeds}
          currentFeedUrl={feed?.feedUrl || null}
          onSelectFeed={handleSelectSavedFeed}
          onRemoveFeed={removeFeed}
        />

        <div className="mb-6">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showHelp ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showHelp ? 'Hide help' : 'Show help & sample podcasts'}
          </button>

          {showHelp && (
            <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-lg font-medium text-zinc-100 mb-3">How it works</h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                We've pre-loaded <span className="text-zinc-200">Articles of Interest</span> for you to try.
                Select an episode below, then add emoji reactions and comments as you listen - they'll be
                timestamped and saved. Click any reaction to jump back to that moment.
              </p>
              <div className="mb-4">
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Or try another podcast:</h3>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_FEEDS.map((sampleFeed) => (
                    <button
                      key={sampleFeed.url}
                      onClick={() => handleLoadFeed(sampleFeed.url)}
                      className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg
                               text-sm text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600
                               transition-colors"
                    >
                      {sampleFeed.name}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-zinc-500 text-xs">
                Note: Loading feeds can take 15-45 seconds. Podcasts with large archives may load slowly or fail.
                We show the 10 most recent episodes. Want to add your own? Find RSS feeds at{' '}
                <a
                  href="https://castos.com/tools/find-podcast-rss-feed/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-500 hover:text-emerald-400 underline"
                >
                  Castos RSS Finder
                </a>.
              </p>
            </div>
          )}
        </div>

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
      </div>
    </div>
  );
}

export default App;
