import { Prisma } from '@prisma/client';
import { db } from './db';
import { nextOccurrence, today, categoryIds, cents } from './finance';
export async function settleRecurring(userId: string) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const end = new Date(today());
      let created = 0;
      const rules = await tx.recurring.findMany({
        where: { userId, active: true, nextDate: { lte: end } },
      });
      for (const r of rules) {
        let date = r.nextDate;
        let loops = 0;
        while (date <= end && loops++ < 400) {
          const existing = await tx.transaction.findUnique({
            where: { recurringId_date: { recurringId: r.id, date } },
          });
          if (!existing) {
            await tx.transaction.create({
              data: {
                userId,
                accountId: r.accountId,
                categoryId: r.categoryId,
                kind: r.kind,
                amount: r.amount,
                description: r.description,
                date,
                recurringId: r.id,
              },
            });
            created++;
          }
          date = nextOccurrence(date, r.frequency, r.anchorDay);
        }
        await tx.recurring.update({
          where: { id: r.id },
          data: { nextDate: date },
        });
      }
      if (created)
        await tx.activity.create({
          data: {
            userId,
            action: 'processed',
            entity: 'recurring',
            label: String(created),
          },
        });
      return created;
    },
    { timeout: 30000 },
  );
}
export async function refreshReminders(userId: string) {
  const [rules, debts, goals, budgets, categories, transactions] = await Promise.all([
    db.recurring.findMany({ where: { userId, active: true } }),
    db.debt.findMany({ where: { userId, remaining: { gt: 0 } } }),
    db.goal.findMany({ where: { userId } }),
    db.budget.findMany({ where: { userId, month: today().slice(0, 7) } }),
    db.category.findMany({ where: { userId } }),
    db.transaction.findMany({
      where: {
        userId,
        kind: 'expense',
        date: {
          gte: new Date(today().slice(0, 7) + '-01'),
          lte: new Date(today()),
        },
      },
    }),
  ]);
  const deadline = new Date(Date.now() + 7 * 86400000);
  const items: { key: string; type: string; label: string }[] = [];
  for (const r of rules)
    if (r.nextDate <= deadline)
      items.push({
        key: `recurring:${r.id}:${r.nextDate.toISOString()}`,
        type: 'paymentDue',
        label: r.description,
      });
  for (const d of debts)
    if (d.dueDate && d.dueDate <= deadline)
      items.push({
        key: `debt:${d.id}:${d.dueDate.toISOString()}`,
        type: 'debtDue',
        label: d.name,
      });
  for (const g of goals)
    if (g.deadline && g.deadline <= deadline && g.saved.lessThan(g.target))
      items.push({
        key: `goal:${g.id}:${g.deadline.toISOString()}`,
        type: 'goalDue',
        label: g.name,
      });
  for (const b of budgets) {
    const ids = categoryIds(categories, b.categoryId);
    const spent = transactions
      .filter((t) => t.categoryId && ids.includes(t.categoryId))
      .reduce((s, t) => s + cents(t.amount), 0);
    if (spent >= cents(b.amount) * 0.8)
      items.push({
        key: `budget:${b.id}`,
        type: spent >= cents(b.amount) ? 'overBudget' : 'budgetNear',
        label: categories.find((c) => c.id === b.categoryId)?.name || '',
      });
  }
  if (items.length)
    await db.notification.createMany({
      data: items.map((i) => ({ ...i, userId })),
      skipDuplicates: true,
    });
}
export const serializable = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value, (_, v) => (v instanceof Prisma.Decimal ? v.toString() : v)));
