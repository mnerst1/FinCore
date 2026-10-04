import { test, expect } from '@playwright/test';
test('compact sidebar persists, supports icon navigation and keeps mobile menu expanded', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const registered = await page.request.post('/api/auth', {
    headers: { Origin: process.env.APP_URL || 'http://localhost:3000' },
    data: { mode: 'register', email: `sidebar-${Date.now()}@fincore.test`, password: 'FinCore-sidebar-password!', name: 'Sidebar test', locale: 'en' },
  });
  expect(registered.status()).toBe(200);
  await page.goto('/');
  await expect(page.locator('nav')).toBeVisible();
  await expect(page).toHaveTitle('FinCore');
  await expect(page.getByText(/Day 012|DAY 012|^012$/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  await expect(page.locator('.app-shell')).toHaveClass(/sidebar-compact/);
  await expect.poll(async () => (await page.locator('aside').boundingBox())?.width).toBe(78);
  await page.locator('nav').getByRole('button', { name: 'Accounts', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveClass(/sidebar-compact/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(page.locator('nav').getByText('Accounts', { exact: true })).toBeVisible();
  expect((await page.locator('aside').boundingBox())?.width).toBe(246);
  await page.locator('nav').getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.locator('aside')).not.toHaveClass(/open/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  await expect(page.locator('.app-shell')).not.toHaveClass(/sidebar-compact/);
  await expect(page.locator('.brand-name')).toBeVisible();
});
test('demo button signs in without credentials and preserves selected language', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('demo@fincore.local', { exact: true })).toHaveCount(0);
  await expect(page.getByText('FinCore-Demo-2026!', { exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ru');
  await page.getByRole('button', { name: 'Войти в демо-аккаунт', exact: true }).click();
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  const data = await (await page.request.get('/api/data')).json();
  expect(data.user.email).toBe('demo@fincore.local');
  expect(data.user.locale).toBe('ru');
  const csrf = await page.request.post('/api/auth/demo', {
    headers: { Origin: 'https://attacker.invalid' }, data: { locale: 'en' },
  });
  expect(csrf.status()).toBe(403);
});
test('login language persists in profile, reload and subsequent sign-in', async ({ page }) => {
  const email = `locale-${Date.now()}@fincore.test`;
  const password = 'FinCore-locale-password!';
  const headers = { Origin: process.env.APP_URL || 'http://localhost:3000' };
  const registered = await page.request.post('/api/auth', {
    headers,
    data: { mode: 'register', email, password, name: 'Locale test', locale: 'en' },
  });
  expect(registered.status()).toBe(200);
  await page.request.post('/api/logout', { headers });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ru');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"], form button.primary').click();
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  expect((await (await page.request.get('/api/data')).json()).user.locale).toBe('ru');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.request.post('/api/logout', { headers });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button.primary').click();
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
});
test('registration, accounts, ledger, settings, RTL, logout and auth guards', async ({ page }) => {
  const email = `e2e-${Date.now()}@fincore.test`;
  const password = 'FinCore-test-password!';
  await page.goto('/');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('FinCore Test');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create your space' }).click();
  await expect(page.getByRole('heading', { name: 'Make room for what matters.' })).toBeVisible();
  const cookie = (await page.context().cookies()).find((c) => c.name === 'fincore_session');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Strict');
  await page.locator('nav').getByRole('button', { name: 'Accounts', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('Daily account');
  await dialog.getByLabel('Opening balance').fill('500');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Daily account' })).toBeVisible();
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click();
  await dialog.getByLabel('Description').fill('Lunch with friends');
  await dialog.getByLabel('Amount', { exact: true }).fill('25.50');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  await page.locator('nav').getByRole('button', { name: 'Transactions', exact: true }).click();
  await expect(page.getByText('Lunch with friends', { exact: true }).first()).toBeVisible();
  await page.getByPlaceholder('Search transactions…').fill('impossible');
  await expect(page.getByText('No matching results')).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  const origin = process.env.APP_URL || 'http://localhost:3000';
  const csrf = await page.request.post('/api/records/accounts', {
    data: {
      name: 'Blocked',
      kind: 'bank',
      openingBalance: 0,
      color: '#5765f2',
    },
    headers: { Origin: 'https://attacker.invalid' },
  });
  expect(csrf.status()).toBe(403);
  const crossUser = await page.request.patch('/api/records/accounts?id=does-not-belong-to-user', {
    data: {
      name: 'Blocked',
      kind: 'bank',
      openingBalance: 0,
      color: '#5765f2',
    },
    headers: { Origin: origin },
  });
  expect(crossUser.status()).toBe(404);
  await page.locator('nav').getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ar');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Glass', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-style', 'glass');
  await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  expect((await page.request.get('/api/data')).status()).toBe(401);
});
test('API: debts, recurrence, attachment authorization and complete backup restore', async ({
  request,
  browser,
}) => {
  const origin = process.env.APP_URL || 'http://localhost:3000';
  const headers = { Origin: origin };
  const suffix = Date.now();
  expect(
    (
      await request.post('/api/auth', {
        headers,
        data: {
          mode: 'register',
          email: `flows-${suffix}@fincore.test`,
          password: 'FinCore-long-test-password!',
          name: 'Flow test',
        },
      })
    ).status(),
  ).toBe(200);
  const create = async (entity: string, data: unknown) => {
    const res = await request.post(`/api/records/${entity}`, { headers, data });
    expect(res.status()).toBe(200);
    return res.json();
  };
  const a = await create('accounts', {
    name: 'A',
    kind: 'bank',
    openingBalance: 1000,
    color: '#5765f2',
  });
  const cat = await create('categories', { name: 'Bills', kind: 'expense', color: '#5765f2' });
  await create('budgets', {
    categoryId: cat.id,
    month: new Date().toISOString().slice(0, 7),
    amount: 100,
  });
  await create('goals', { name: 'Future', target: 1000, saved: 200, color: '#5765f2' });
  const debt = await create('debts', {
    name: 'Laptop',
    direction: 'owe',
    principal: 100,
    remaining: 100,
    interestRate: 0,
  });
  const date = new Date().toISOString().slice(0, 10);
  expect(
    (
      await request.post(`/api/debts/${debt.id}/pay`, {
        headers,
        data: { accountId: a.id, amount: 30, date },
      })
    ).status(),
  ).toBe(200);
  let data = await (await request.get('/api/data')).json();
  expect(Number(data.debts[0].remaining)).toBe(70);
  const payment = data.transactions.find((t: { debtId: string }) => t.debtId === debt.id);
  expect(
    (await request.delete(`/api/records/transactions?id=${payment.id}`, { headers })).status(),
  ).toBe(200);
  data = await (await request.get('/api/data')).json();
  expect(Number(data.debts[0].remaining)).toBe(100);
  await create('recurring', {
    accountId: a.id,
    categoryId: cat.id,
    kind: 'expense',
    amount: 90,
    description: 'Monthly bill',
    frequency: 'monthly',
    nextDate: date,
    active: true,
  });
  await request.post('/api/data', { headers });
  await request.post('/api/data', { headers });
  data = await (await request.get('/api/data')).json();
  expect(data.transactions).toHaveLength(1);
  expect(data.notifications.some((n: { type: string }) => n.type === 'budgetNear')).toBe(true);
  const tx = data.transactions[0];
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1cAAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await request.post('/api/attachments', {
    headers,
    multipart: {
      transactionId: tx.id,
      file: { name: 'receipt.png', mimeType: 'image/png', buffer: png },
    },
  });
  expect(upload.status()).toBe(200);
  const receipt = await upload.json();
  expect(await (await request.get(`/api/attachments?id=${receipt.id}`)).body()).toEqual(png);
  const backup = await (await request.get('/api/portability?format=json')).json();
  expect(backup.transactions[0].attachments[0].content).toBe(png.toString('base64'));
  expect(backup.passwordHash).toBeUndefined();
  const other = await browser.newContext();
  expect(
    (
      await other.request.post('/api/auth', {
        headers,
        data: {
          mode: 'register',
          email: `restore-${suffix}@fincore.test`,
          password: 'FinCore-long-test-password!',
          name: 'Restore test',
        },
      })
    ).status(),
  ).toBe(200);
  expect((await other.request.get(`/api/attachments?id=${receipt.id}`)).status()).toBe(404);
  const restored = await other.request.post('/api/portability', { headers, data: backup });
  expect(restored.status()).toBe(200);
  const restoredData = await (await other.request.get('/api/data')).json();
  expect(restoredData.accounts).toHaveLength(1);
  expect(restoredData.transactions).toHaveLength(1);
  expect(restoredData.accounts[0].id).not.toBe(a.id);
  const restoredReceipt = restoredData.transactions[0].attachments[0];
  expect(
    await (await other.request.get(`/api/attachments?id=${restoredReceipt.id}`)).body(),
  ).toEqual(png);
  expect(
    (await request.delete(`/api/records/transactions?id=${tx.id}`, { headers })).status(),
  ).toBe(200);
  expect((await request.get(`/api/attachments?id=${receipt.id}`)).status()).toBe(404);
  expect(
    (
      await request.post('/api/settings', {
        headers,
        data: { current: 'wrong', password: 'FinCore-new-test-password!' },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/api/settings', {
        headers,
        data: { current: 'FinCore-long-test-password!', password: 'FinCore-new-test-password!' },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get('/api/data')).status()).toBe(401);
  expect(
    (
      await request.post('/api/auth', {
        headers,
        data: {
          mode: 'login',
          email: `flows-${suffix}@fincore.test`,
          password: 'FinCore-long-test-password!',
        },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/api/auth', {
        headers,
        data: {
          mode: 'login',
          email: `flows-${suffix}@fincore.test`,
          password: 'FinCore-new-test-password!',
        },
      })
    ).status(),
  ).toBe(200);
  await other.close();
});
test('demo dashboard renders on desktop and mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('demo@fincore.local');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.DEMO_PASSWORD || 'FinCore-Demo-2026!');
  await page.getByRole('button', { name: 'Enter your space' }).click();
  await expect(page.getByRole('heading', { name: 'Make room for what matters.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cash flow', exact: true })).toBeVisible();
  await page.waitForTimeout(1800); // Allow chart entrance animation to finish before visual capture.
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300); // Finish the sidebar's responsive transition.
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('aside')).toHaveClass(/open/);
  await page.locator('nav').getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();
  await expect(page.locator('aside')).not.toHaveClass(/open/);
});
