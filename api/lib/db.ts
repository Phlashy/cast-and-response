import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL!);

// Initialize database tables
export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      episode_url TEXT NOT NULL,
      podcast_title TEXT,
      episode_title TEXT,
      emoji VARCHAR(10) NOT NULL,
      timestamp REAL NOT NULL,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_reactions_user_episode
    ON reactions(user_id, episode_url)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_reactions_episode
    ON reactions(episode_url)
  `;
}
