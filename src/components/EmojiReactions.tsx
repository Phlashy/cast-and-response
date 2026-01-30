import { useState } from 'react';
import { Reaction } from '../types/podcast';

const EMOJI_OPTIONS = ['👍', '😂', '🤔', '💡', '❤️', '😠'];

interface EmojiReactionsProps {
  currentTime: number;
  onAddReaction: (emoji: string, timestamp: number, comment?: string) => void;
  onUpdateReaction: (id: string, comment: string) => void;
  reactions: Reaction[];
  onSeekToReaction: (timestamp: number) => void;
}

function formatTimestamp(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function EmojiReactions({
  currentTime,
  onAddReaction,
  onUpdateReaction,
  reactions,
  onSeekToReaction,
}: EmojiReactionsProps) {
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState('');

  const handleEmojiClick = (emoji: string) => {
    onAddReaction(emoji, currentTime, comment.trim() || undefined);
    setLastAdded(emoji);
    setComment(''); // Clear comment after adding
    setTimeout(() => setLastAdded(null), 600);
  };

  const handleStartEdit = (reaction: Reaction, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger seek
    setEditingId(reaction.id);
    setEditComment(reaction.comment || '');
  };

  const handleSaveEdit = (id: string) => {
    onUpdateReaction(id, editComment.trim());
    setEditingId(null);
    setEditComment('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditComment('');
  };

  const sortedReactions = [...reactions].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="space-y-4">
      {/* Emoji buttons and comment input */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              className={`w-10 h-10 text-xl rounded-lg bg-zinc-800 border border-zinc-700
                         hover:bg-zinc-700 hover:border-zinc-600 hover:scale-110
                         active:scale-95 transition-all duration-150 flex-shrink-0
                         ${lastAdded === emoji ? 'ring-2 ring-emerald-500 scale-110' : ''}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment (optional)"
          className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg
                     text-zinc-100 placeholder-zinc-500 text-sm
                     focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600
                     transition-colors"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && comment.trim()) {
              // If they press Enter with a comment, add with first emoji
              handleEmojiClick(EMOJI_OPTIONS[0]);
            }
          }}
        />
      </div>

      {/* Visual confirmation */}
      {lastAdded && (
        <div className="text-center text-sm text-emerald-400 animate-pulse">
          {lastAdded} added at {formatTimestamp(currentTime)}
        </div>
      )}

      {/* Reactions list */}
      {reactions.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-400 mb-3">
            Your reactions ({reactions.length})
          </h4>
          <div className="space-y-2">
            {sortedReactions.map((reaction) => (
              <div
                key={reaction.id}
                className="flex items-start gap-3 w-full px-3 py-2 bg-zinc-800
                         border border-zinc-700 rounded-lg text-sm"
              >
                <span className="text-xl flex-shrink-0">{reaction.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSeekToReaction(reaction.timestamp)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      at {formatTimestamp(reaction.timestamp)}
                    </button>
                    {editingId !== reaction.id && (
                      <button
                        onClick={(e) => handleStartEdit(reaction, e)}
                        className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                      >
                        {reaction.comment ? 'edit' : '+ add comment'}
                      </button>
                    )}
                  </div>

                  {editingId === reaction.id ? (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        placeholder="Add your comment..."
                        className="flex-1 px-2 py-1 bg-zinc-700 border border-zinc-600 rounded
                                   text-zinc-100 placeholder-zinc-500 text-sm
                                   focus:outline-none focus:border-zinc-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit(reaction.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                      />
                      <button
                        onClick={() => handleSaveEdit(reaction.id)}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-2 py-1 bg-zinc-600 hover:bg-zinc-500 text-white text-xs rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    reaction.comment && (
                      <p className="text-zinc-300 mt-1 break-words">{reaction.comment}</p>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
