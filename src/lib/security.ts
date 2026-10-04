import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { db } from './db';
const derive = promisify(scrypt);
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(':');
  const actual = (await derive(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function currentUser() {
  const token = (await cookies()).get('fincore_session')?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: digest(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}
export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new HttpError(401, 'unauthorized');
  return u;
}
export function checkOrigin(request: Request) {
  const expected = new URL(process.env.APP_URL || 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== expected) throw new HttpError(403, 'originRejected');
}
export async function newSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db.session.create({ data: { id: digest(token), userId, expiresAt } });
  (await cookies()).set('fincore_session', token, {
    httpOnly: true,
    secure: process.env.APP_URL?.startsWith('https://') ?? false,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get('fincore_session')?.value;
  if (token) await db.session.deleteMany({ where: { id: digest(token) } });
  jar.delete('fincore_session');
}
// Persisted limiter survives process restarts. No spoofable forwarded-IP trust.
export async function limitAuth(email: string) {
  const id = digest(email.toLowerCase());
  const now = new Date();
  const row = await db.authAttempt.upsert({
    where: { id },
    create: { id, count: 1, resetAt: new Date(Date.now() + 900000) },
    update: { count: { increment: 1 } },
  });
  if (row.resetAt < now) {
    await db.authAttempt.updateMany({
      where: { id, resetAt: { lt: now } },
      data: { count: 1, resetAt: new Date(Date.now() + 900000) },
    });
    return;
  }
  if (row.count > 10) throw new HttpError(429, 'rateLimited');
}
export const publicUser = (u: {
  id: string;
  name: string;
  email: string;
  currency: string;
  locale: string;
  theme: string;
  style: string;
  accent: string;
}) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  currency: u.currency,
  locale: u.locale,
  theme: u.theme,
  style: u.style,
  accent: u.accent,
});
