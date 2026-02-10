import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

// Simple secret key protection for demo - in production, use proper podcaster auth
const ANALYTICS_SECRET = process.env.ANALYTICS_SECRET || 'demo-secret';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { episode, secret } = req.query;

  // Verify secret for demo access
  if (secret !== ANALYTICS_SECRET) {
    return res.status(401).json({ error: 'Invalid access key' });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    const sql = neon(process.env.DATABASE_URL);

    // Ensure reactions table exists
    await sql`
      CREATE TABLE IF NOT EXISTS reactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        episode_url TEXT NOT NULL,
        podcast_title TEXT,
        episode_title TEXT,
        emoji VARCHAR(10) NOT NULL,
        timestamp REAL NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // If episode is provided, get detailed analytics for that episode
    if (episode && typeof episode === 'string') {
      // Get all reactions for this episode (aggregated from all users)
      const reactions = await sql`
        SELECT
          emoji,
          timestamp,
          comment,
          created_at
        FROM reactions
        WHERE episode_url = ${episode}
        ORDER BY timestamp ASC
      `;

      // Get emoji counts
      const emojiCounts = await sql`
        SELECT emoji, COUNT(*) as count
        FROM reactions
        WHERE episode_url = ${episode}
        GROUP BY emoji
        ORDER BY count DESC
      `;

      // Get reaction count per time bucket (30-second intervals for heat map)
      const heatmap = await sql`
        SELECT
          FLOOR(timestamp / 30) * 30 as time_bucket,
          COUNT(*) as count
        FROM reactions
        WHERE episode_url = ${episode}
        GROUP BY time_bucket
        ORDER BY time_bucket ASC
      `;

      // Get total unique listeners who reacted
      const listeners = await sql`
        SELECT COUNT(DISTINCT user_id) as count
        FROM reactions
        WHERE episode_url = ${episode}
      `;

      return res.status(200).json({
        episode,
        totalReactions: reactions.length,
        uniqueListeners: listeners[0]?.count || 0,
        emojiBreakdown: emojiCounts,
        heatmap,
        reactions,
      });
    }

    // No episode specified - return overview of all episodes with reactions
    const episodes = await sql`
      SELECT
        episode_url,
        podcast_title,
        episode_title,
        COUNT(*) as reaction_count,
        COUNT(DISTINCT user_id) as listener_count,
        MAX(created_at) as last_reaction
      FROM reactions
      GROUP BY episode_url, podcast_title, episode_title
      ORDER BY reaction_count DESC
      LIMIT 50
    `;

    return res.status(200).json({ episodes });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Server error', details: error?.message });
  }
}
