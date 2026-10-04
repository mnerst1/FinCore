import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from './security';
export async function readBytes(req: Request, max = 2_000_000) {
  const reader = req.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  let size = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, 'fileTooLarge');
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}
export async function readJson(req: Request, max = 2_000_000) {
  const text = (await readBytes(req, max)).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalidInput');
  }
}
export function apiError(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.code }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: 'invalidInput' }, { status: 400 });
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'alreadyExists' }, { status: 409 });
    if (e.code === 'P2003') return NextResponse.json({ error: 'inUse' }, { status: 409 });
    if (e.code === 'P2025') return NextResponse.json({ error: 'notFound' }, { status: 404 });
  }
  console.error('FinCore request failed', e instanceof Error ? e.name : 'Unknown');
  return NextResponse.json({ error: 'serverError' }, { status: 500 });
}
