import { requireUser, checkOrigin, HttpError } from '@/lib/security';
import { apiError, readBytes } from '@/lib/http';
import { exportData, importCsv, restoreBackup } from '@/lib/portability';
import { NextResponse } from 'next/server';
export async function GET(req: Request) {
  try {
    const u = await requireUser();
    const csv = new URL(req.url).searchParams.get('format') === 'csv';
    return new Response(await exportData(u.id, csv), {
      headers: {
        'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json',
        'Content-Disposition': `attachment; filename="fincore-${new Date().toISOString().slice(0, 10)}.${csv ? 'csv' : 'json'}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await requireUser();
    const json = req.headers.get('content-type')?.includes('application/json');
    const text = (await readBytes(req, json ? 64_000_000 : 2_000_000)).toString('utf8');
    let raw;
    try {
      raw = json ? JSON.parse(text) : null;
    } catch {
      throw new HttpError(400, 'invalidInput');
    }
    const count = json ? await restoreBackup(u.id, raw) : await importCsv(u.id, text);
    return NextResponse.json({ count });
  } catch (e) {
    return apiError(e);
  }
}
