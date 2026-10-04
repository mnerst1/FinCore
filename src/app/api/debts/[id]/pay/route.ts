import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, checkOrigin, HttpError } from '@/lib/security';
import { apiError, readJson } from '@/lib/http';
import { owned } from '@/lib/service';
import { money, date } from '@/lib/validation';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { today } from '@/lib/finance';
export async function POST(req: Request, c: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(req);
    const u = await requireUser();
    const { id } = await c.params;
    const data = z
      .object({
        accountId: z.string(),
        amount: money,
        date: date.refine((v) => v <= today()),
      })
      .parse(await readJson(req));
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.id}))`;
      await owned(tx, 'debts', id, u.id);
      await owned(tx, 'accounts', data.accountId, u.id);
      const debt = await tx.debt.findUniqueOrThrow({ where: { id } });
      const amount = new Prisma.Decimal(data.amount);
      if (amount.greaterThan(debt.remaining)) throw new HttpError(400, 'invalidInput');
      await tx.debt.update({
        where: { id },
        data: { remaining: { decrement: amount } },
      });
      await tx.transaction.create({
        data: {
          userId: u.id,
          accountId: data.accountId,
          kind: debt.direction === 'owe' ? 'expense' : 'income',
          amount,
          description: debt.name,
          date: new Date(data.date),
          debtId: id,
        },
      });
      await tx.activity.create({
        data: {
          userId: u.id,
          action: 'paid',
          entity: 'debts',
          label: debt.name,
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
