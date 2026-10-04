import { NextResponse } from 'next/server';
import path from 'node:path';
import { db } from '@/lib/db';
import { requireUser, checkOrigin, HttpError } from '@/lib/security';
import { apiError, readBytes } from '@/lib/http';
import { storeReceipt, loadReceipt, removeReceipt } from '@/lib/storage';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await requireUser();
    const bytes = await readBytes(req, 6_000_000);
    const form = await new Response(bytes, {
      headers: { 'Content-Type': req.headers.get('content-type') || '' },
    }).formData();
    const file = form.get('file');
    const transactionId = String(form.get('transactionId'));
    if (!(file instanceof File) || file.size > 5_000_000) throw new HttpError(413, 'fileTooLarge');
    const stored = await storeReceipt(Buffer.from(await file.arrayBuffer()));
    try {
      const row = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id}))`;
        if (
          !(await tx.transaction.findFirst({
            where: { id: transactionId, userId: u.id },
          }))
        )
          throw new HttpError(404, 'notFound');
        if ((await tx.attachment.count({ where: { transactionId } })) >= 10)
          throw new HttpError(413, 'fileTooLarge');
        const r = await tx.attachment.create({
          data: {
            transactionId,
            filename: path.basename(file.name).slice(0, 150),
            ...stored,
          },
        });
        await tx.activity.create({
          data: {
            userId: u.id,
            action: 'created',
            entity: 'attachment',
            label: r.filename,
          },
        });
        return r;
      });
      return NextResponse.json({ id: row.id });
    } catch (e) {
      await removeReceipt(stored.storageKey);
      throw e;
    }
  } catch (e) {
    return apiError(e);
  }
}
export async function GET(req: Request) {
  try {
    const u = await requireUser();
    const id = new URL(req.url).searchParams.get('id') || '';
    const row = await db.attachment.findFirst({
      where: { id, transaction: { userId: u.id } },
    });
    if (!row) throw new HttpError(404, 'notFound');
    return new Response(await loadReceipt(row.storageKey), {
      headers: {
        'Content-Type': row.mime,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request) {
  try {
    checkOrigin(req);
    const u = await requireUser();
    const id = new URL(req.url).searchParams.get('id') || '';
    const row = await db.attachment.findFirst({
      where: { id, transaction: { userId: u.id } },
    });
    if (!row) throw new HttpError(404, 'notFound');
    await db.attachment.delete({ where: { id } });
    await removeReceipt(row.storageKey);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
