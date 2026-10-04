import { NextResponse } from 'next/server';
import { authSchema } from '@/lib/validation';
import {
  checkOrigin,
  hashPassword,
  verifyPassword,
  newSession,
  limitAuth,
  HttpError,
  publicUser,
} from '@/lib/security';
import { db } from '@/lib/db';
import { apiError, readJson } from '@/lib/http';
import { createDefaults } from '@/lib/sample';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const data = authSchema.parse(await readJson(req));
    await limitAuth(data.email);
    let user = await db.user.findUnique({ where: { email: data.email } });
    if (data.mode === 'register') {
      if (!data.name) throw new HttpError(400, 'invalidInput');
      if (user) throw new HttpError(409, 'emailExists');
      const passwordHash = await hashPassword(data.password);
      user = await db.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { email: data.email, name: data.name!, passwordHash, locale: data.locale },
        });
        await createDefaults(tx, u.id, false);
        return u;
      });
    } else {
      const dummy = '0123456789abcdef0123456789abcdef:' + '0'.repeat(128);
      const valid = await verifyPassword(data.password, user?.passwordHash || dummy);
      if (!user || !valid) throw new HttpError(401, 'invalidCredentials');
      if (data.locale && data.locale !== user.locale) {
        user = await db.user.update({ where: { id: user.id }, data: { locale: data.locale } });
      }
    }
    await newSession(user!.id);
    await db.activity.create({
      data: { userId: user!.id, action: data.mode, entity: 'auth', label: '' },
    });
    return NextResponse.json({ user: publicUser(user!) });
  } catch (e) {
    return apiError(e);
  }
}
