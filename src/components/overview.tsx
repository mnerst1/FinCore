'use client';
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Target,
  ArrowRight,
  ArrowLeftRight,
} from 'lucide-react';
import { Data, str, num, ledger } from './types';
import { balance, today, cents, categoryIds } from '@/lib/finance';
import { T, TransactionList, Empty } from './ui';
import { TrendChart, SpendingChart } from './charts';
export function Overview({
  data,
  t,
  money,
  locale,
  month,
  setMonth,
  navigate,
  onAdd,
}: {
  data: Data;
  t: T;
  money: (n: number) => string;
  locale: string;
  month: string;
  setMonth: (v: string) => void;
  navigate: (v: string) => void;
  onAdd: () => void;
}) {
  const entries = ledger(data.transactions);
  const actual = data.transactions.filter((r) => str(r, 'date').slice(0, 10) <= today());
  const current = actual.filter((r) => str(r, 'date').startsWith(month));
  const sum = (kind: string) =>
    current.filter((r) => r.kind === kind).reduce((s, r) => s + cents(r.amount), 0) / 100;
  const income = sum('income'),
    expense = sum('expense');
  const balances = data.accounts.map((a) => ({
    row: a,
    value: balance({ id: a.id, openingBalance: a.openingBalance }, entries, today()),
  }));
  const assets = balances.reduce((s, a) => s + a.value, 0);
  const owe =
    data.debts.filter((d) => d.direction === 'owe').reduce((s, d) => s + cents(d.remaining), 0) /
    100;
  const owed =
    data.debts.filter((d) => d.direction === 'owed').reduce((s, d) => s + cents(d.remaining), 0) /
    100;
  const start = new Date(month + '-01');
  const trends = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 5 + i, 1));
    const prefix = d.toISOString().slice(0, 7);
    const rows = actual.filter((r) => str(r, 'date').startsWith(prefix));
    return {
      month: new Intl.DateTimeFormat(locale, {
        month: 'short',
        timeZone: 'UTC',
      }).format(d),
      income:
        rows.filter((r) => r.kind === 'income').reduce((s, r) => s + cents(r.amount), 0) / 100,
      expense:
        rows.filter((r) => r.kind === 'expense').reduce((s, r) => s + cents(r.amount), 0) / 100,
    };
  });
  const groups = data.categories
    .filter((c) => !c.parentId && c.kind === 'expense')
    .map((c) => {
      const ids = categoryIds(
        data.categories.map((r) => ({
          id: r.id,
          parentId: str(r, 'parentId') || null,
        })),
        c.id,
      );
      return {
        name: str(c, 'name'),
        value:
          current
            .filter((r) => r.kind === 'expense' && ids.includes(str(r, 'categoryId')))
            .reduce((s, r) => s + cents(r.amount), 0) / 100,
        color: str(c, 'color'),
      };
    });
  const uncategorized =
    current
      .filter((r) => r.kind === 'expense' && !r.categoryId)
      .reduce((s, r) => s + cents(r.amount), 0) / 100;
  if (uncategorized)
    groups.push({
      name: t('uncategorized'),
      value: uncategorized,
      color: '#a7acba',
    });
  const breakdown = groups.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const upcoming = data.recurring.filter(
    (r) =>
      r.active &&
      str(r, 'nextDate').slice(0, 10) <=
        new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">
            {t('greeting')}, {data.user.name.split(' ')[0]}
          </p>
          <h1>{t('overviewHint')}</h1>
        </div>
        <label className="month-picker">
          <span className="sr-only">{t('month')}</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>
      <section className="metrics">
        <article className="wealth-card">
          <div className="wealth-top">
            <span>{t('netWorth')}</span>
            <ArrowUpRight size={22} />
          </div>
          <h2>{money(assets + owed - owe)}</h2>
          <p>{t('netWorthHint')}</p>
          <div className="wealth-bottom">
            <span>
              <Wallet size={15} />
              {data.accounts.length} {t('accounts')}
            </span>
            <span>{data.user.currency}</span>
          </div>
          <div className="wealth-orbit" />
        </article>
        <article className="metric">
          <span className="metric-icon green">
            <ArrowDownRight size={20} />
          </span>
          <p>{t('monthlyIncome')}</p>
          <h2>{money(income)}</h2>
          <small>{t('thisMonth')}</small>
        </article>
        <article className="metric">
          <span className="metric-icon peach">
            <ArrowUpRight size={20} />
          </span>
          <p>{t('monthlyExpense')}</p>
          <h2>{money(expense)}</h2>
          <small>{t('thisMonth')}</small>
        </article>
        <article className="metric">
          <span className="metric-icon lilac">
            <ArrowLeftRight size={20} />
          </span>
          <p>{t('cashflow')}</p>
          <h2>{money(income - expense)}</h2>
          <small>
            {t('savingsRate')} · {income ? Math.round(((income - expense) / income) * 100) : 0}%
          </small>
        </article>
      </section>
      <section className="overview-grid">
        <article className="panel trend-panel">
          <div className="panel-title">
            <h3>{t('cashflow')}</h3>
            <div className="chart-key">
              <span>
                <i />
                {t('income')}
              </span>
              <span>
                <i className="expense-dot" />
                {t('expense')}
              </span>
            </div>
          </div>
          <TrendChart rows={trends} t={t} money={money} />
        </article>
        <article className="panel">
          <div className="panel-title">
            <h3>{t('spending')}</h3>
            <small>{month}</small>
          </div>
          {breakdown.length ? (
            <SpendingChart rows={breakdown} money={money} total={expense} t={t} />
          ) : (
            <Empty t={t} onAdd={onAdd} />
          )}
        </article>
        <article className="panel recent-panel">
          <div className="panel-title">
            <h3>{t('recent')}</h3>
            <button className="text-button" onClick={() => navigate('transactions')}>
              {t('viewAll')}
              <ArrowRight size={14} />
            </button>
          </div>
          {actual.length ? (
            <TransactionList
              rows={actual.slice(0, 5)}
              data={data}
              t={t}
              money={money}
              compact
              onEdit={() => {}}
              onDelete={() => {}}
            />
          ) : (
            <Empty t={t} onAdd={onAdd} />
          )}
        </article>
        <article className="panel">
          <div className="panel-title">
            <h3>{t('upcoming')}</h3>
            <span className="pill">30 {t('days')}</span>
          </div>
          {upcoming.length ? (
            <div className="upcoming-list">
              {upcoming.slice(0, 4).map((r) => (
                <button key={r.id} onClick={() => navigate('recurring')}>
                  <span className="date-badge">
                    <small>
                      {new Intl.DateTimeFormat(locale, {
                        month: 'short',
                        timeZone: 'UTC',
                      }).format(new Date(str(r, 'nextDate')))}
                    </small>
                    <strong>{new Date(str(r, 'nextDate')).getUTCDate()}</strong>
                  </span>
                  <span>
                    <strong>{str(r, 'description')}</strong>
                    <small>{t(str(r, 'frequency'))}</small>
                  </span>
                  <b>{money(num(r, 'amount'))}</b>
                </button>
              ))}
            </div>
          ) : (
            <p className="hint">{t('noUpcoming')}</p>
          )}
        </article>
      </section>
      <section className="bottom-grid">
        <article className="panel">
          <div className="panel-title">
            <h3>{t('accounts')}</h3>
            <button className="text-button" onClick={() => navigate('accounts')}>
              {t('viewAll')}
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="mini-accounts">
            {balances.map((a) => (
              <button key={a.row.id} onClick={() => navigate('accounts')}>
                <span
                  className="account-symbol"
                  style={{
                    color: str(a.row, 'color'),
                    background: str(a.row, 'color') + '18',
                  }}
                >
                  <Wallet size={19} />
                </span>
                <span>
                  <strong>{str(a.row, 'name')}</strong>
                  <small>{t(str(a.row, 'kind'))}</small>
                </span>
                <b>{money(a.value)}</b>
              </button>
            ))}
          </div>
        </article>
        <article className="panel goals-preview">
          <div className="panel-title">
            <h3>{t('goals')}</h3>
            <Target size={18} />
          </div>
          {data.goals.slice(0, 2).map((g) => (
            <button className="goal-preview" key={g.id} onClick={() => navigate('goals')}>
              <div>
                <strong>{str(g, 'name')}</strong>
                <span>{Math.round((num(g, 'saved') / num(g, 'target')) * 100)}%</span>
              </div>
              <div className="progress">
                <i
                  style={{
                    width: Math.min(100, (num(g, 'saved') / num(g, 'target')) * 100) + '%',
                    background: str(g, 'color'),
                  }}
                />
              </div>
              <small>
                {money(num(g, 'saved'))} / {money(num(g, 'target'))}
              </small>
            </button>
          ))}
        </article>
      </section>
      <div className="net-details">
        <span>
          {t('totalBalance')}: {money(assets)}
        </span>
        <span>
          {t('receivables')}: {money(owed)}
        </span>
        <span>
          {t('liabilities')}: {money(owe)}
        </span>
      </div>
    </>
  );
}
