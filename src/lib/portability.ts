import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

import { db } from './db';
import { schemas } from './validation';
import { HttpError } from './security';
import { z } from 'zod';
import { loadReceipt, storeReceipt, removeReceipt } from './storage';
const item = <T extends z.ZodType>(schema: T) =>
  z.object({ id: z.string().min(1).max(100) }).and(schema);
const backupSchema = z.object({
  format: z.literal('fincore-v1'),
  currency: z.string(),
  accounts: z.array(item(schemas.accounts)).max(1000),
  categories: z.array(item(schemas.categories)).max(1000),
  transactions: z
    .array(
      item(schemas.transactions).and(
        z.object({
          debtId: z.string().nullable().optional(),
          attachments: z
            .array(
              z.object({
                filename: z.string().min(1).max(150),
                content: z.string().max(6_666_668),
              }),
            )
            .max(10)
            .default([]),
        }),
      ),
    )
    .max(10000),
  budgets: z.array(item(schemas.budgets)).max(1000),
  goals: z.array(item(schemas.goals)).max(1000),
  debts: z.array(item(schemas.debts)).max(1000),
  recurring: z
    .array(
      item(schemas.recurring).and(
        z.object({ anchorDay: z.number().int().min(1).max(31).optional() }),
      ),
    )
    .max(1000),
});
const iso = (v: Date | null) => v?.toISOString().slice(0, 10) || null;
export async function exportData(userId: string, csv = false) {
  const where = { userId };
  const [u, accounts, categories, transactions, budgets, goals, debts, recurring] =
    await db.$transaction([
      db.user.findUniqueOrThrow({ where: { id: userId } }),
      db.account.findMany({ where }),
      db.category.findMany({ where }),
      db.transaction.findMany({
        where,
        include: { attachments: true },
        orderBy: { date: 'asc' },
      }),
      db.budget.findMany({ where }),
      db.goal.findMany({ where }),
      db.debt.findMany({ where }),
      db.recurring.findMany({ where }),
    ]);
  if (csv)
    return stringify(
      transactions.map((t) => ({
        date: iso(t.date),
        kind: t.kind,
        amount: String(t.amount),
        description: t.description,
        account: accounts.find((a) => a.id === t.accountId)?.name,
        toAccount: accounts.find((a) => a.id === t.toAccountId)?.name || '',
        category: categories.find((c) => c.id === t.categoryId)?.name || '',
        note: t.note,
      })),
      {
        header: true,
        escape_formulas: true,
        columns: [
          'date',
          'kind',
          'amount',
          'description',
          'account',
          'toAccount',
          'category',
          'note',
        ],
      },
    );
  let attachmentBytes = 0;
  const portableTransactions = [];
  for (const t of transactions) {
    const attachments = [];
    for (const a of t.attachments) {
      const content = (await loadReceipt(a.storageKey)).toString('base64');
      attachmentBytes += content.length;
      if (attachmentBytes > 60_000_000) throw new HttpError(413, 'fileTooLarge');
      attachments.push({ filename: a.filename, content });
    }
    portableTransactions.push({ ...t, date: iso(t.date), recurringId: undefined, attachments });
  }
  const backup = JSON.stringify(
    {
      format: 'fincore-v1',
      exportedAt: new Date(),
      currency: u.currency,
      accounts,
      categories,
      transactions: portableTransactions,
      budgets,
      goals: goals.map((g) => ({ ...g, deadline: iso(g.deadline) })),
      debts: debts.map((d) => ({ ...d, dueDate: iso(d.dueDate) })),
      recurring: recurring.map((r) => ({ ...r, nextDate: iso(r.nextDate) })),
    },
    null,
    2,
  );
  if (Buffer.byteLength(backup) > 64_000_000) throw new HttpError(413, 'fileTooLarge');
  return backup;
}
export async function importCsv(userId: string, text: string) {
  let rows: Record<string, string>[];
  try {
    rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      max_record_size: 10000,
    });
  } catch {
    throw new HttpError(400, 'invalidInput');
  }
  if (rows.length > 2000) throw new HttpError(413, 'fileTooLarge');
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const accounts = await tx.account.findMany({ where: { userId } });
      const categories = await tx.category.findMany({ where: { userId } });
      for (const row of rows) {
        if (
          accounts.filter((a) => a.name === row.account).length !== 1 ||
          (row.toAccount && accounts.filter((a) => a.name === row.toAccount).length !== 1) ||
          (row.category &&
            categories.filter((c) => c.name === row.category && c.kind === row.kind).length !== 1)
        )
          throw new HttpError(400, 'importMapping');
        const accountId = accounts.find((a) => a.name === row.account)?.id;
        const toAccountId = accounts.find((a) => a.name === row.toAccount)?.id || null;
        const category = categories.find((c) => c.name === row.category && c.kind === row.kind);
        if (!accountId || (row.toAccount && !toAccountId) || (row.category && !category))
          throw new HttpError(400, 'importMapping');
        const t = schemas.transactions.parse({
          ...row,
          accountId,
          toAccountId,
          categoryId: category?.id || null,
        });
        if (t.kind === 'transfer' && (!toAccountId || toAccountId === accountId))
          throw new HttpError(400, 'invalidTransfer');
        await tx.transaction.create({
          data: {
            ...t,
            toAccountId: t.kind === 'transfer' ? toAccountId : null,
            userId,
            date: new Date(t.date),
          },
        });
      }
      await tx.activity.create({
        data: {
          userId,
          action: 'imported',
          entity: 'transactions',
          label: String(rows.length),
        },
      });
      return rows.length;
    },
    { timeout: 30000 },
  );
}
export async function restoreBackup(userId: string, raw: unknown) {
  const b = backupSchema.parse(raw);
  const written: string[] = [];
  try {
    return await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
        if (await tx.account.count({ where: { userId } }))
          throw new HttpError(409, 'restoreEmptyOnly');
        if (
          (await tx.budget.count({ where: { userId } })) ||
          (await tx.goal.count({ where: { userId } })) ||
          (await tx.debt.count({ where: { userId } }))
        )
          throw new HttpError(409, 'restoreEmptyOnly');
        const u = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (u.currency !== b.currency) throw new HttpError(400, 'currencyMismatch');
        await tx.category.updateMany({
          where: { userId },
          data: { parentId: null },
        });
        await tx.category.deleteMany({ where: { userId } });
        const maps = {
          accounts: new Map<string, string>(),
          categories: new Map<string, string>(),
          debts: new Map<string, string>(),
        };
        const ref = (e: keyof typeof maps, id: string | null | undefined) => {
          if (!id) return null;
          const v = maps[e].get(id);
          if (!v) throw new HttpError(400, 'importMapping');
          return v;
        };
        const unique = (rows: { id: string }[]) => {
          if (new Set(rows.map((r) => r.id)).size !== rows.length)
            throw new HttpError(400, 'invalidInput');
        };
        unique(b.accounts);
        unique(b.categories);
        unique(b.debts);
        for (const { id, ...data } of b.accounts) {
          const r = await tx.account.create({ data: { ...data, userId } });
          maps.accounts.set(id, r.id);
        }
        for (const { id, ...data } of b.categories) {
          const r = await tx.category.create({
            data: { ...data, parentId: null, userId },
          });
          maps.categories.set(id, r.id);
        }
        for (const c of b.categories) {
          if (c.parentId) {
            const seen = new Set([c.id]);
            let p: string | null | undefined = c.parentId;
            while (p) {
              if (seen.has(p)) throw new HttpError(400, 'invalidInput');
              seen.add(p);
              const parent = b.categories.find((x) => x.id === p);
              if (!parent || parent.kind !== c.kind) throw new HttpError(400, 'importMapping');
              p = parent.parentId;
            }
            await tx.category.update({
              where: { id: ref('categories', c.id)! },
              data: { parentId: ref('categories', c.parentId) },
            });
          }
        }
        for (const { id, ...data } of b.debts) {
          const r = await tx.debt.create({
            data: {
              ...data,
              dueDate: data.dueDate ? new Date(data.dueDate) : null,
              userId,
            },
          });
          maps.debts.set(id, r.id);
        }
        for (const { id: _id, attachments, ...data } of b.transactions) {
          void _id;
          const cat = b.categories.find((c) => c.id === data.categoryId);
          if (cat && cat.kind !== data.kind) throw new HttpError(400, 'categoryMismatch');
          const accountId = ref('accounts', data.accountId)!;
          const toAccountId = ref('accounts', data.toAccountId);
          if (data.kind === 'transfer' && (!toAccountId || toAccountId === accountId))
            throw new HttpError(400, 'invalidTransfer');
          const operation = await tx.transaction.create({
            data: {
              ...data,
              date: new Date(data.date),
              accountId,
              toAccountId,
              categoryId: ref('categories', data.categoryId),
              debtId: ref('debts', data.debtId),
              userId,
            },
          });
          for (const a of attachments) {
            const stored = await storeReceipt(Buffer.from(a.content, 'base64'));
            written.push(stored.storageKey);
            await tx.attachment.create({
              data: {
                transactionId: operation.id,
                filename: a.filename,
                ...stored,
              },
            });
          }
        }
        for (const { id: _id, ...data } of b.budgets) {
          void _id;
          if (b.categories.find((c) => c.id === data.categoryId)?.kind !== 'expense')
            throw new HttpError(400, 'categoryMismatch');
          await tx.budget.create({
            data: {
              ...data,
              userId,
              categoryId: ref('categories', data.categoryId)!,
            },
          });
        }
        for (const { id: _id, ...data } of b.goals) {
          void _id;
          await tx.goal.create({
            data: {
              ...data,
              userId,
              deadline: data.deadline ? new Date(data.deadline) : null,
            },
          });
        }
        for (const { id: _id, ...data } of b.recurring) {
          void _id;
          if (
            data.categoryId &&
            b.categories.find((c) => c.id === data.categoryId)?.kind !== data.kind
          )
            throw new HttpError(400, 'categoryMismatch');
          await tx.recurring.create({
            data: {
              ...data,
              userId,
              accountId: ref('accounts', data.accountId)!,
              categoryId: ref('categories', data.categoryId),
              nextDate: new Date(data.nextDate),
              anchorDay: data.anchorDay || new Date(data.nextDate).getUTCDate(),
            },
          });
        }
        await tx.activity.create({
          data: {
            userId,
            action: 'imported',
            entity: 'backup',
            label: String(b.transactions.length),
          },
        });
        return b.transactions.length;
      },
      { timeout: 60000 },
    );
  } catch (e) {
    await Promise.all(written.map(removeReceipt));
    throw e;
  }
}
