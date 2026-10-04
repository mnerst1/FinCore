import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, checkOrigin } from '@/lib/security';
import { apiError } from '@/lib/http';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await requireUser();
    await db.notification.updateMany({
      where: { userId: u.id },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
