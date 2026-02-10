import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDb } from '../lib/db';
import { verifyPassword, createToken } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    await initDb();

    // Find user
    const result = await sql`
      SELECT id, email, password_hash FROM users WHERE email = ${email}
    `;

    if (result.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result[0];
    const validPassword = await verifyPassword(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = createToken({ userId: user.id, email: user.email });

    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to login' });
  }
}
