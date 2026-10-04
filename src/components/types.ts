export type Row = { id: string; [key: string]: unknown };
export type User = {
  id: string;
  name: string;
  email: string;
  currency: string;
  locale: string;
  theme: string;
  style: string;
  accent: string;
};
export type Data = {
  user: User;
  accounts: Row[];
  categories: Row[];
  transactions: Row[];
  budgets: Row[];
  goals: Row[];
  debts: Row[];
  recurring: Row[];
  activities: Row[];
  notifications: Row[];
};
export const str = (r: Row, k: string) => String(r[k] ?? '');
export const num = (r: Row, k: string) => Number(r[k] ?? 0);
export const ledger = (rows: Row[]) =>
  rows.map((r) => ({
    accountId: str(r, 'accountId'),
    toAccountId: str(r, 'toAccountId'),
    kind: str(r, 'kind'),
    amount: r.amount,
    date: str(r, 'date'),
    categoryId: str(r, 'categoryId'),
  }));
export async function request(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'serverError');
  return result;
}
