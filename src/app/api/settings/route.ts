import { NextResponse } from 'next/server';
import { settingsSchema } from '@/lib/validation';
import {
  requireUser,
  checkOrigin,
  publicUser,
  HttpError,
  hashPassword,
  verifyPassword,
} from '@/lib/security';
import { apiError, readJson } from '@/lib/http';
import { db } from '@/lib/db';
import { z } from 'zod';
export async function PATCH(req: Request) {
  try {
    checkOrigin(req);
    const u = await requireUser();
    const data = settingsSchema.parse(await readJson(req));
    const user = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id}))`;
      if (data.currency !== u.currency && (await tx.account.count({ where: { userId: u.id } })))
        throw new HttpError(409, 'currencyLocked');
      const result = await tx.user.update({ where: { id: u.id }, data });
      await tx.activity.create({
        data: {
          userId: u.id,
          action: 'updated',
          entity: 'settings',
          label: '',
        },
      });
      return result;
    });
    return NextResponse.json(publicUser(user));
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await requireUser();
    const data = z
      .object({
        current: z.string().max(128),
        password: z.string().min(12).max(128),
      })
      .parse(await readJson(req));
    if (!(await verifyPassword(data.current, u.passwordHash)))
      throw new HttpError(401, 'invalidCredentials');
    await db.$transaction([
      db.user.update({
        where: { id: u.id },
        data: { passwordHash: await hashPassword(data.password) },
      }),
      db.session.deleteMany({ where: { userId: u.id } }),
      db.activity.create({
        data: {
          userId: u.id,
          action: 'updated',
          entity: 'password',
          label: '',
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
