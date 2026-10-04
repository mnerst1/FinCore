import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { db } from '../../src/lib/db';
import { mutate } from '../../src/lib/service';
import { settleRecurring } from '../../src/lib/recurring';
import { exportData, importCsv, restoreBackup } from '../../src/lib/portability';
import { today } from '../../src/lib/finance';
import { limitAuth, digest } from '../../src/lib/security';
// Uses only users created by this suite. Never resets or truncates a shared database.
let userId: string, otherId: string, restoreId: string, accountId: string, categoryId: string;
beforeAll(async () => {
  if (!process.env.DATABASE_URL)
    throw new Error('Set DATABASE_URL to a migrated PostgreSQL test database.');
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const u = await db.user.create({
      data: {
        email: `integration-${Date.now()}-${i}@fincore.test`,
        name: 'Test',
        passwordHash: 'unused',
      },
    });
    ids.push(u.id);
  }
  [userId, otherId, restoreId] = ids;
  accountId = (
    await db.account.create({
      data: { userId, name: 'Test account', openingBalance: 100 },
    })
  ).id;
  categoryId = (
    await db.category.create({
      data: { userId, name: 'Test category', kind: 'expense' },
    })
  ).id;
});
afterAll(async () => {
  await db.user.deleteMany({
    where: { id: { in: [userId, otherId, restoreId].filter(Boolean) } },
  });
  await db.$disconnect();
});
describe('PostgreSQL domain integration', () => {
  it('enforces a persistent auth limit and resets expired windows', async () => {
    const email = `limit-${Date.now()}@fincore.test`;
    try {
      for (let i = 0; i < 10; i++) await limitAuth(email);
      await expect(limitAuth(email)).rejects.toMatchObject({ status: 429 });
      await db.authAttempt.update({
        where: { id: digest(email) },
        data: { resetAt: new Date(Date.now() - 1000) },
      });
      await expect(limitAuth(email)).resolves.toBeUndefined();
      expect((await db.authAttempt.findUniqueOrThrow({ where: { id: digest(email) } })).count).toBe(
        1,
      );
    } finally {
      await db.authAttempt.deleteMany({ where: { id: digest(email) } });
    }
  });
  it('rejects cross-user mutations and references', async () => {
    await expect(
      mutate(
        otherId,
        'accounts',
        { name: 'Hijacked', kind: 'bank', openingBalance: 0, color: '#5765f2' },
        accountId,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      mutate(otherId, 'transactions', {
        description: 'Bad',
        kind: 'expense',
        amount: 1,
        date: today(),
        accountId,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('rejects self transfers atomically', async () => {
    await expect(
      mutate(userId, 'transactions', {
        description: 'Bad transfer',
        kind: 'transfer',
        amount: 1,
        date: today(),
        accountId,
        toAccountId: accountId,
      }),
    ).rejects.toMatchObject({ code: 'invalidTransfer' });
    expect(await db.transaction.count({ where: { userId } })).toBe(0);
  });
  it('prevents category cycles', async () => {
    const child = await db.category.create({
      data: { userId, name: 'Child', kind: 'expense', parentId: categoryId },
    });
    await expect(
      mutate(
        userId,
        'categories',
        {
          name: 'Test category',
          kind: 'expense',
          parentId: child.id,
          color: '#5765f2',
        },
        categoryId,
      ),
    ).rejects.toMatchObject({ code: 'invalidInput' });
  });
  it('posts recurring payments exactly once under concurrent requests', async () => {
    await db.recurring.create({
      data: {
        userId,
        accountId,
        categoryId,
        kind: 'expense',
        description: 'Recurring test',
        amount: 12.34,
        frequency: 'monthly',
        nextDate: new Date(today()),
        anchorDay: new Date(today()).getUTCDate(),
      },
    });
    const results = await Promise.all([settleRecurring(userId), settleRecurring(userId)]);
    expect(results.reduce((a, b) => a + b, 0)).toBe(1);
    expect(await db.transaction.count({ where: { userId } })).toBe(1);
  });
  it('rolls back the entire CSV import on an invalid row', async () => {
    const text =
      'date,kind,amount,description,account,category\n' +
      `${today()},expense,5,Good,Test account,Test category\n${today()},expense,5,Bad,Missing,Test category`;
    await expect(importCsv(userId, text)).rejects.toMatchObject({
      code: 'importMapping',
    });
    expect(await db.transaction.count({ where: { userId } })).toBe(1);
  });
  it('exports, remaps IDs and restores an entire backup', async () => {
    await db.goal.create({
      data: { userId, name: 'Trip', target: 500, saved: 100 },
    });
    const backup = JSON.parse(await exportData(userId));
    expect(backup.passwordHash).toBeUndefined();
    expect(await restoreBackup(restoreId, backup)).toBe(1);
    expect(await db.transaction.count({ where: { userId: restoreId } })).toBe(1);
    const copy = await db.account.findFirstOrThrow({
      where: { userId: restoreId },
    });
    expect(copy.id).not.toBe(accountId);
    await expect(restoreBackup(restoreId, backup)).rejects.toMatchObject({
      code: 'restoreEmptyOnly',
    });
  });
  it('escapes formula-shaped cells in CSV exports', async () => {
    await mutate(userId, 'transactions', {
      description: '=1+1',
      kind: 'expense',
      amount: 1,
      date: today(),
      accountId,
      categoryId,
    });
    expect(await exportData(userId, true)).toContain("'=1+1");
  });
});
