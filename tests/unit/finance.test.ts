import { describe, it, expect } from 'vitest';
import { balance, nextOccurrence, cents, categoryIds } from '../../src/lib/finance';
import { schemas, date, settingsSchema } from '../../src/lib/validation';
import { hashPassword, verifyPassword } from '../../src/lib/security';
import en from '../../src/locales/en.json';
import ru from '../../src/locales/ru.json';
import kk from '../../src/locales/kk.json';
import { locales, coverage, translate } from '../../src/lib/i18n';
describe('financial invariants', () => {
  it('keeps transfers neutral and ignores future transactions', () => {
    const entries = [
      {
        accountId: 'a',
        toAccountId: 'b',
        kind: 'transfer',
        amount: '0.10',
        date: '2026-10-04',
      },
      { accountId: 'a', kind: 'expense', amount: '0.20', date: '2026-10-04' },
      { accountId: 'a', kind: 'income', amount: '999', date: '2026-11-01' },
    ];
    expect(balance({ id: 'a', openingBalance: '1.00' }, entries, '2026-10-04')).toBe(0.7);
    expect(balance({ id: 'b', openingBalance: '0' }, entries, '2026-10-04')).toBe(0.1);
    expect(cents(0.1) + cents(0.2)).toBe(30);
  });
  it('restores the anchor after a shorter month', () => {
    const feb = nextOccurrence(new Date('2024-01-31'), 'monthly', 31);
    expect(feb.toISOString().slice(0, 10)).toBe('2024-02-29');
    expect(nextOccurrence(feb, 'monthly', 31).toISOString().slice(0, 10)).toBe('2024-03-31');
    expect(nextOccurrence(new Date('2024-12-30'), 'weekly', 30).toISOString().slice(0, 10)).toBe(
      '2025-01-06',
    );
  });
  it('includes nested categories in a parent budget', () => {
    expect(
      categoryIds(
        [
          { id: 'a', parentId: null },
          { id: 'b', parentId: 'a' },
          { id: 'c', parentId: 'b' },
        ],
        'a',
      ),
    ).toEqual(['a', 'b', 'c']);
  });
  it('rejects invalid calendar dates and sub-cent values', () => {
    expect(date.safeParse('2026-02-30').success).toBe(false);
    expect(
      schemas.transactions.safeParse({
        accountId: 'a',
        kind: 'expense',
        amount: 0.001,
        date: '2026-10-04',
        description: 'Test',
      }).success,
    ).toBe(false);
  });
  it('requires savings to remain inside the target', () => {
    expect(
      schemas.goals.safeParse({
        name: 'Goal',
        target: 100,
        saved: 101,
        color: '#5765f2',
      }).success,
    ).toBe(false);
  });
  it('rejects CSS injection in accents', () => {
    expect(
      settingsSchema.safeParse({
        name: 'Test',
        email: 'a@b.com',
        currency: 'USD',
        locale: 'en',
        theme: 'light',
        style: 'glass',
        accent: 'red; display:none',
      }).success,
    ).toBe(false);
  });
});
describe('security and localization', () => {
  it('uses salted scrypt hashes and checks passwords', async () => {
    const a = await hashPassword('A-long-test-password!');
    const b = await hashPassword('A-long-test-password!');
    expect(a).not.toBe(b);
    expect(await verifyPassword('A-long-test-password!', a)).toBe(true);
    expect(await verifyPassword('Wrong-password!', a)).toBe(false);
  });
  it('ships complete primary dictionaries and honest fallback coverage', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(kk).sort()).toEqual(Object.keys(en).sort());
    expect(coverage('en')).toBe(100);
    expect(coverage('ar')).toBeLessThan(100);
    expect(locales.ar.dir).toBe('rtl');
    expect(translate('ja', 'serverError')).toBe(en.serverError);
  });
});
