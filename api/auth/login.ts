import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDb } from '../lib/db';

// Use dynamic imports for CommonJS modules
let bcrypt: any;
let jwt: any;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

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
    // Dynamic imports for CommonJS modules
    if (!bcrypt) {
      bcrypt = (await import('bcryptjs')).default;
    }
    if (!jwt) {
      jwt = (await import('jsonwebtoken')).default;
    }

    await initDb();

    // Find user
    const users = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    const message = error?.message || 'Failed to log in';
    return res.status(500).json({ error: message });
  }
}
