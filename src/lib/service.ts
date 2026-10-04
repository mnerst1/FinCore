import { Prisma } from '@prisma/client';
import { db } from './db';
import { schemas } from './validation';
import { HttpError } from './security';
import { removeReceipt } from './storage';
export type Entity = keyof typeof schemas;
const delegates = (tx: Prisma.TransactionClient) => ({
  accounts: tx.account,
  categories: tx.category,
  transactions: tx.transaction,
  budgets: tx.budget,
  goals: tx.goal,
  debts: tx.debt,
  recurring: tx.recurring,
});
// Narrowing is kept at this boundary; each payload has already passed its domain schema.
type Delegate = {
  findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
};
export async function owned(
  tx: Prisma.TransactionClient,
  entity: Entity,
  id: string,
  userId: string,
) {
  const model = delegates(tx)[entity] as unknown as Delegate;
  const row = await model.findFirst({ where: { id, userId } });
  if (!row) throw new HttpError(404, 'notFound');
  return row;
}
export async function mutate(
  userId: string,
  entity: Entity,
  raw: unknown,
  id?: string,
  remove = false,
) {
  const removedFiles: string[] = [];
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const delegate = delegates(tx)[entity] as unknown as Delegate;
    const old = id ? await owned(tx, entity, id, userId) : null;
    if (remove) {
      if (!id) throw new HttpError(400, 'invalidInput');
      if (entity === 'transactions') {
        const files = await tx.attachment.findMany({
          where: { transactionId: id },
          select: { storageKey: true },
        });
        removedFiles.push(...files.map((f) => f.storageKey));
      }
      if (entity === 'transactions' && old?.debtId) {
        await tx.debt.update({
          where: { id: String(old.debtId) },
          data: {
            remaining: { increment: new Prisma.Decimal(String(old.amount)) },
          },
        });
      }
      await delegate.delete({ where: { id } });
      await tx.activity.create({
        data: {
          userId,
          action: 'deleted',
          entity,
          label: String(old?.name || old?.description || ''),
        },
      });
      return { ok: true };
    }
    const data = schemas[entity].parse(raw) as Record<string, unknown>;
    if (old?.debtId) throw new HttpError(409, 'debtPaymentLocked');
    if (data.accountId) await owned(tx, 'accounts', String(data.accountId), userId);
    if (data.toAccountId) await owned(tx, 'accounts', String(data.toAccountId), userId);
    if (data.categoryId) {
      const cat = await owned(tx, 'categories', String(data.categoryId), userId);
      if (data.kind && cat.kind !== data.kind) throw new HttpError(400, 'categoryMismatch');
      if (entity === 'budgets' && cat.kind !== 'expense')
        throw new HttpError(400, 'categoryMismatch');
    }
    if (entity === 'transactions') {
      if (data.kind === 'transfer') {
        if (!data.toAccountId || data.toAccountId === data.accountId)
          throw new HttpError(400, 'invalidTransfer');
        data.categoryId = null;
      } else data.toAccountId = null;
      data.date = new Date(String(data.date));
    }
    if (entity === 'recurring') {
      data.anchorDay = new Date(String(data.nextDate)).getUTCDate();
      data.nextDate = new Date(String(data.nextDate));
    }
    if (entity === 'goals') data.deadline = data.deadline ? new Date(String(data.deadline)) : null;
    if (entity === 'debts') {
      data.dueDate = data.dueDate ? new Date(String(data.dueDate)) : null;
      if (old && (await tx.transaction.count({ where: { debtId: id } }))) {
        if (
          String(data.remaining) !== String(old.remaining) ||
          String(data.principal) !== String(old.principal) ||
          data.direction !== old.direction
        )
          throw new HttpError(409, 'debtPaymentLocked');
      }
    }
    if (entity === 'categories' && data.parentId) {
      const parent = await owned(tx, 'categories', String(data.parentId), userId);
      if (parent.kind !== data.kind) throw new HttpError(400, 'categoryMismatch');
      const visited = new Set<string>(id ? [id] : []);
      let cursor: Record<string, unknown> | null = parent;
      while (cursor) {
        if (visited.has(String(cursor.id))) throw new HttpError(400, 'invalidInput');
        visited.add(String(cursor.id));
        cursor = cursor.parentId
          ? await owned(tx, 'categories', String(cursor.parentId), userId)
          : null;
      }
    }
    if (entity === 'categories' && old && old.kind !== data.kind) {
      const links =
        (await tx.transaction.count({ where: { categoryId: id } })) +
        (await tx.recurring.count({ where: { categoryId: id } })) +
        (await tx.budget.count({ where: { categoryId: id } })) +
        (await tx.category.count({ where: { parentId: id } }));
      if (links) throw new HttpError(409, 'inUse');
    }
    const result = id
      ? await delegate.update({ where: { id }, data })
      : await delegate.create({ data: { ...data, userId } });
    await tx.activity.create({
      data: {
        userId,
        action: id ? 'updated' : 'created',
        entity,
        label: String(data.name || data.description || data.month || ''),
      },
    });
    return result;
  });
  await Promise.all(removedFiles.map(removeReceipt));
  return result;
}
