import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDb } from './lib/db';

// Dynamic import for jwt
let jwt: any;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function getUserFromRequest(req: VercelRequest): { userId: number; email: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Dynamic import for jwt
    if (!jwt) {
      jwt = (await import('jsonwebtoken')).default;
    }

    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await initDb();

    // GET - fetch user's reactions for an episode
    if (req.method === 'GET') {
      const { episode } = req.query;

      if (!episode || typeof episode !== 'string') {
        return res.status(400).json({ error: 'Episode URL is required' });
      }

      const reactions = await sql`
        SELECT id, emoji, timestamp, comment, created_at
        FROM reactions
        WHERE user_id = ${user.userId} AND episode_url = ${episode}
        ORDER BY timestamp ASC
      `;

      return res.status(200).json({ reactions });
    }

    // POST - save a new reaction
    if (req.method === 'POST') {
      const { episodeUrl, podcastTitle, episodeTitle, emoji, timestamp, comment } = req.body;

      if (!episodeUrl || !emoji || timestamp === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await sql`
        INSERT INTO reactions (user_id, episode_url, podcast_title, episode_title, emoji, timestamp, comment)
        VALUES (${user.userId}, ${episodeUrl}, ${podcastTitle || null}, ${episodeTitle || null}, ${emoji}, ${timestamp}, ${comment || null})
        RETURNING id, emoji, timestamp, comment, created_at
      `;

      return res.status(201).json({ reaction: result[0] });
    }

    // DELETE - remove a reaction
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Reaction ID is required' });
      }

      await sql`
        DELETE FROM reactions
        WHERE id = ${parseInt(id)} AND user_id = ${user.userId}
      `;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Reactions error:', error);
    const message = error?.message || 'Server error';
    return res.status(500).json({ error: message });
  }
}
