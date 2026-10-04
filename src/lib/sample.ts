import type { Prisma } from '@prisma/client';
import { today } from './finance';
export async function createDefaults(
  tx: Prisma.TransactionClient,
  userId: string,
  sample: boolean,
) {
  const labels = [
    ['Food & dining', 'expense', '#ec8a54'],
    ['Home', 'expense', '#737ae7'],
    ['Transport', 'expense', '#4babc1'],
    ['Shopping', 'expense', '#d977ac'],
    ['Wellbeing', 'expense', '#50a58a'],
    ['Subscriptions', 'expense', '#9a7eda'],
    ['Salary', 'income', '#50a58a'],
    ['Freelance', 'income', '#4babc1'],
  ];
  const categories = [];
  for (const [name, kind, color] of labels)
    categories.push(await tx.category.create({ data: { userId, name, kind, color } }));
  await tx.category.create({
    data: {
      userId,
      name: 'Groceries',
      kind: 'expense',
      color: '#ec8a54',
      parentId: categories[0].id,
    },
  });
  if (!sample) return;
  const bank = await tx.account.create({
    data: {
      userId,
      name: 'Everyday',
      kind: 'bank',
      openingBalance: 4820,
      color: '#5765f2',
    },
  });
  const savings = await tx.account.create({
    data: {
      userId,
      name: 'Future fund',
      kind: 'savings',
      openingBalance: 12500,
      color: '#48a78d',
    },
  });
  const cash = await tx.account.create({
    data: {
      userId,
      name: 'Pocket',
      kind: 'cash',
      openingBalance: 240,
      color: '#ec8a54',
    },
  });
  const now = new Date(today());
  for (let m = 5; m >= 0; m--) {
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1));
    await tx.transaction.create({
      data: {
        userId,
        accountId: bank.id,
        categoryId: categories[6].id,
        kind: 'income',
        amount: 4200 + m * 25,
        description: 'Monthly salary',
        date: base,
      },
    });
    for (let j = 0; j < 18; j++) {
      const day = 2 + ((j * 7) % 27);
      const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), day));
      if (d > now) continue;
      const c = j % 6;
      await tx.transaction.create({
        data: {
          userId,
          accountId: j === 0 ? cash.id : bank.id,
          categoryId: categories[c].id,
          kind: 'expense',
          amount: c === 1 ? 950 : Math.round((24 + j * 8 + m * 3) * 100) / 100,
          description: [
            'Sunday market',
            'Home essentials',
            'City transport',
            'A little something',
            'Morning studio',
            'Digital subscription',
          ][c],
          date: d,
          note: j % 5 === 0 ? 'Personal spending' : '',
        },
      });
    }
    await tx.transaction.create({
      data: {
        userId,
        accountId: bank.id,
        toAccountId: savings.id,
        kind: 'transfer',
        amount: 650,
        description: 'Monthly savings',
        date: base,
      },
    });
  }
  const month = today().slice(0, 7);
  for (let j = 0; j < 6; j++)
    await tx.budget.create({
      data: {
        userId,
        categoryId: categories[j].id,
        month,
        amount: [500, 3000, 250, 350, 280, 100][j],
      },
    });
  await tx.goal.createMany({
    data: [
      {
        userId,
        name: 'A month in Japan',
        target: 6000,
        saved: 3450,
        color: '#5765f2',
        deadline: new Date(Date.UTC(now.getUTCFullYear() + 1, 3, 1)),
      },
      {
        userId,
        name: 'Emergency cushion',
        target: 15000,
        saved: 8200,
        color: '#48a78d',
      },
      {
        userId,
        name: 'Creative workspace',
        target: 2500,
        saved: 780,
        color: '#ec8a54',
      },
    ],
  });
  await tx.debt.createMany({
    data: [
      {
        userId,
        name: 'Laptop instalments',
        direction: 'owe',
        principal: 1800,
        remaining: 1200,
        interestRate: 0,
        dueDate: new Date(Date.now() + 6 * 86400000),
      },
      {
        userId,
        name: 'Alex · shared trip',
        direction: 'owed',
        principal: 320,
        remaining: 320,
        interestRate: 0,
        dueDate: new Date(Date.now() + 12 * 86400000),
      },
    ],
  });
  for (const [j, description, amount] of [
    [5, 'Music & cloud', 18.99],
    [1, 'Apartment rent', 950],
  ] as const) {
    const nextDate = new Date(Date.now() + (j === 5 ? 3 : 8) * 86400000);
    await tx.recurring.create({
      data: {
        userId,
        accountId: bank.id,
        categoryId: categories[j].id,
        kind: 'expense',
        amount,
        description,
        frequency: 'monthly',
        nextDate,
        anchorDay: nextDate.getUTCDate(),
      },
    });
  }
  await tx.activity.create({
    data: { userId, action: 'created', entity: 'sample', label: 'FinCore' },
  });
}
