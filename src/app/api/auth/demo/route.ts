import { POST as authenticate } from '../route';
import { apiError, readJson } from '@/lib/http';
import { checkOrigin } from '@/lib/security';
import { z } from 'zod';
import { locales } from '@/lib/i18n';

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { locale } = z
      .object({
        locale: z.string().refine((v) => Object.hasOwn(locales, v)),
      })
      .parse(await readJson(req));
    return authenticate(
      new Request(req.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: req.headers.get('origin')! },
        body: JSON.stringify({
          mode: 'login',
          email: 'demo@fincore.local',
          password: process.env.DEMO_PASSWORD || 'FinCore-Demo-2026!',
          locale,
        }),
      }),
    );
  } catch (e) {
    return apiError(e);
  }
}
