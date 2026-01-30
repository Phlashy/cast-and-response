export interface Episode {
  title: string;
  pubDate: string;
  audioUrl: string;
  description?: string;
  duration?: string;
}

export interface PodcastFeed {
  feedUrl: string;
  title: string;
  description?: string;
  imageUrl?: string;
  episodes: Episode[];
}

export interface SavedFeed {
  feedUrl: string;
  title: string;
  imageUrl?: string;
  savedAt: string;
}

export interface Reaction {
  id: string;
  emoji: string;
  timestamp: number;
  comment?: string;
  createdAt: Date;
}
