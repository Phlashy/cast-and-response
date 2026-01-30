import { Episode, Reaction } from '../types/podcast';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

interface AudioPlayerProps {
  episode: Episode;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoaded: boolean;
  playbackRate: number;
  reactions: Reaction[];
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSetSpeed: (rate: number) => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds === 0) return '--:--';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatCurrentTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayer({
  episode,
  isPlaying,
  currentTime,
  duration,
  isLoaded,
  playbackRate,
  reactions,
  onTogglePlay,
  onSeek,
  onSetSpeed,
}: AudioPlayerProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remaining = duration > 0 ? duration - currentTime : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isLoaded || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;
    onSeek(newTime);
  };

  const cycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    onSetSpeed(SPEED_OPTIONS[nextIndex]);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h2 className="font-semibold text-lg text-zinc-100 mb-4 line-clamp-2">
        {episode.title}
      </h2>

      <div className="flex items-center gap-4">
        <button
          onClick={onTogglePlay}
          className="w-12 h-12 flex items-center justify-center bg-zinc-100 text-zinc-900
                     rounded-full hover:bg-zinc-200 transition-colors flex-shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        <div className="flex-1 space-y-2">
          {/* Progress bar */}
          <div
            className={`h-2 bg-zinc-700 rounded-full group relative ${isLoaded ? 'cursor-pointer' : 'cursor-wait'}`}
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-emerald-500 rounded-full relative group-hover:bg-emerald-400 transition-colors"
              style={{ width: `${progress}%` }}
            >
              {isLoaded && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-400
                                rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
              )}
            </div>
            {/* Reaction markers */}
            {duration > 0 && reactions.map((reaction) => (
              <div
                key={reaction.id}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-amber-400 rounded-full
                           pointer-events-none shadow-sm"
                style={{ left: `${(reaction.timestamp / duration) * 100}%` }}
                title={`${reaction.emoji} at ${formatTime(reaction.timestamp)}`}
              />
            ))}
          </div>

          {/* Time display */}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-300 font-medium">{formatCurrentTime(currentTime)}</span>
            {isLoaded ? (
              <span className="text-zinc-500">-{formatTime(remaining)}</span>
            ) : (
              <span className="text-zinc-600">Loading...</span>
            )}
          </div>
        </div>

        {/* Speed control */}
        <button
          onClick={cycleSpeed}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg
                     text-sm font-medium text-zinc-300 hover:bg-zinc-700
                     hover:border-zinc-600 transition-colors flex-shrink-0"
          title="Playback speed"
        >
          {playbackRate}x
        </button>
      </div>
    </div>
  );
}
