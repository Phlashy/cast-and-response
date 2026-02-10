import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import type { VercelRequest } from '@vercel/node';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface JWTPayload {
  userId: number;
  email: string;
}

export function hashPassword(password: string): Promise<string> {
  return (bcrypt as any).hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (bcrypt as any).compare(password, hash);
}

export function createToken(payload: JWTPayload): string {
  return (jwt as any).sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return (jwt as any).verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function getUserFromRequest(req: VercelRequest): JWTPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  return verifyToken(token);
}
