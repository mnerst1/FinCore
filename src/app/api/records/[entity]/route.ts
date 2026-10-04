import { NextResponse } from 'next/server';
import { requireUser, checkOrigin, HttpError } from '@/lib/security';
import { apiError, readJson } from '@/lib/http';
import { schemas } from '@/lib/validation';
import { mutate, Entity } from '@/lib/service';
async function run(req: Request, context: { params: Promise<{ entity: string }> }) {
  try {
    checkOrigin(req);
    const user = await requireUser();
    const { entity } = await context.params;
    if (!Object.hasOwn(schemas, entity)) throw new HttpError(404, 'notFound');
    const id = new URL(req.url).searchParams.get('id') || undefined;
    if (req.method !== 'POST' && !id) throw new HttpError(400, 'invalidInput');
    return NextResponse.json(
      await mutate(
        user.id,
        entity as Entity,
        req.method === 'DELETE' ? null : await readJson(req),
        id,
        req.method === 'DELETE',
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
export const POST = run;
export const PATCH = run;
export const DELETE = run;
