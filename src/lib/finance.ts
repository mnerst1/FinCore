export type LedgerEntry = {
  accountId: string;
  toAccountId?: string | null;
  kind: string;
  amount: unknown;
  date: Date | string;
  categoryId?: string | null;
};
export function cents(value: unknown): number {
  const n = Number(String(value));
  if (!Number.isFinite(n)) throw new Error('Invalid amount');
  return Math.round(n * 100);
}
export function balance(
  account: { id: string; openingBalance: unknown },
  entries: LedgerEntry[],
  until = '9999-12-31',
) {
  let result = cents(account.openingBalance);
  for (const t of entries) {
    if (new Date(t.date).toISOString().slice(0, 10) > until) continue;
    if (t.accountId === account.id) result += (t.kind === 'income' ? 1 : -1) * cents(t.amount);
    if (t.kind === 'transfer' && t.toAccountId === account.id) result += cents(t.amount);
  }
  return result / 100;
}
export function nextOccurrence(date: Date, frequency: string, anchorDay: number) {
  const n = new Date(date);
  if (frequency === 'daily') n.setUTCDate(n.getUTCDate() + 1);
  else if (frequency === 'weekly') n.setUTCDate(n.getUTCDate() + 7);
  else {
    const step = frequency === 'yearly' ? 12 : 1;
    n.setUTCDate(1);
    n.setUTCMonth(n.getUTCMonth() + step);
    const last = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0)).getUTCDate();
    n.setUTCDate(Math.min(anchorDay, last));
  }
  return n;
}
export const today = () => new Date().toISOString().slice(0, 10);
export function categoryIds(
  categories: { id: string; parentId: string | null }[],
  id: string,
): string[] {
  return [
    id,
    ...categories.filter((c) => c.parentId === id).flatMap((c) => categoryIds(categories, c.id)),
  ];
}
