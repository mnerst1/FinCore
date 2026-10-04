import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, publicUser, checkOrigin } from '@/lib/security';
import { apiError } from '@/lib/http';
import { settleRecurring, refreshReminders } from '@/lib/recurring';
export async function GET() {
  try {
    const user = await requireUser();
    const userId = user.id;
    const where = { userId };
    const [
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      debts,
      recurring,
      activities,
      notifications,
    ] = await Promise.all([
      db.account.findMany({ where, orderBy: { createdAt: 'asc' } }),
      db.category.findMany({ where }),
      db.transaction.findMany({
        where,
        include: {
          attachments: {
            select: { id: true, filename: true, mime: true, size: true },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      db.budget.findMany({ where }),
      db.goal.findMany({ where }),
      db.debt.findMany({ where }),
      db.recurring.findMany({ where, orderBy: { nextDate: 'asc' } }),
      db.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return NextResponse.json(
      {
        user: publicUser(user),
        accounts,
        categories,
        transactions,
        budgets,
        goals,
        debts,
        recurring,
        activities,
        notifications,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await requireUser();
    const created = await settleRecurring(u.id);
    await refreshReminders(u.id);
    return NextResponse.json({ created });
  } catch (e) {
    return apiError(e);
  }
}
