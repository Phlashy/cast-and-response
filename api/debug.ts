import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const results: any = {
    step: 'start',
    errors: []
  };

  // Test bcryptjs import
  try {
    results.step = 'importing bcryptjs';
    const bcrypt = (await import('bcryptjs')).default;
    results.bcryptLoaded = !!bcrypt;
    results.bcryptHash = typeof bcrypt.hash;

    // Try hashing
    results.step = 'hashing password';
    const hash = await bcrypt.hash('test', 10);
    results.hashResult = hash.substring(0, 20) + '...';
  } catch (e: any) {
    results.errors.push({ step: results.step, error: e.message });
  }

  // Test jsonwebtoken import
  try {
    results.step = 'importing jsonwebtoken';
    const jwt = (await import('jsonwebtoken')).default;
    results.jwtLoaded = !!jwt;
    results.jwtSign = typeof jwt.sign;

    // Try signing
    results.step = 'signing token';
    const token = jwt.sign({ test: true }, 'secret', { expiresIn: '1h' });
    results.tokenResult = token.substring(0, 20) + '...';
  } catch (e: any) {
    results.errors.push({ step: results.step, error: e.message });
  }

  // Test neon import
  try {
    results.step = 'importing neon';
    const { neon } = await import('@neondatabase/serverless');
    results.neonLoaded = !!neon;

    if (process.env.DATABASE_URL) {
      results.step = 'connecting to database';
      const sql = neon(process.env.DATABASE_URL);
      const result = await sql`SELECT 1 as test`;
      results.dbConnected = true;
      results.dbResult = result;
    } else {
      results.dbConnected = false;
      results.dbError = 'DATABASE_URL not set';
    }
  } catch (e: any) {
    results.errors.push({ step: results.step, error: e.message });
  }

  results.step = 'complete';
  return res.status(200).json(results);
}
