import { NextResponse } from 'next/server';
import { checkOrigin, logout } from '@/lib/security';
import { apiError } from '@/lib/http';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await logout();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
