import { Episode } from '../types/podcast';

interface EpisodeListProps {
  episodes: Episode[];
  selectedEpisode: Episode | null;
  onSelectEpisode: (episode: Episode) => void;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function EpisodeList({ episodes, selectedEpisode, onSelectEpisode }: EpisodeListProps) {
  if (episodes.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        No episodes found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {episodes.map((episode, index) => {
        const isSelected = selectedEpisode?.audioUrl === episode.audioUrl;
        return (
          <button
            key={`${episode.audioUrl}-${index}`}
            onClick={() => onSelectEpisode(episode)}
            className={`w-full text-left p-4 rounded-lg transition-colors
                       ${isSelected
                         ? 'bg-zinc-800 border border-zinc-700'
                         : 'bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700'}`}
          >
            <h3 className="font-medium text-zinc-100 line-clamp-2">
              {episode.title}
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              {formatDate(episode.pubDate)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
