'use client';
import { useState } from 'react';
import {
  Plus,
  Wallet,
  Target,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Paperclip,
} from 'lucide-react';
import { Data, Row, str, num, ledger, request } from './types';
import { T, Actions, Empty, TransactionList, Modal } from './ui';
import { balance, cents, today, categoryIds } from '@/lib/finance';
import type { Entity } from '@/lib/service';
export function Records({
  entity,
  data,
  t,
  money,
  month,
  setMonth,
  onEdit,
  onDelete,
  onAdd,
  onRefresh,
  onError,
}: {
  entity: Entity;
  data: Data;
  t: T;
  money: (n: number) => string;
  month: string;
  setMonth: (m: string) => void;
  onEdit: (r: Row) => void;
  onDelete: (r: Row) => void;
  onAdd: () => void;
  onRefresh: () => Promise<void>;
  onError: (e: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [account, setAccount] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [pay, setPay] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  let rows = data[entity];
  if (entity === 'budgets') rows = rows.filter((r) => r.month === month);
  if (entity === 'transactions') {
    rows = rows
      .filter(
        (r) =>
          (str(r, 'description') + ' ' + str(r, 'note'))
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (!kind || r.kind === kind) &&
          (!account || r.accountId === account || r.toAccountId === account) &&
          (!category || r.categoryId === category) &&
          (!from || str(r, 'date').slice(0, 10) >= from) &&
          (!to || str(r, 'date').slice(0, 10) <= to),
      )
      .sort((a, b) =>
        sort === 'newest'
          ? str(b, 'date').localeCompare(str(a, 'date'))
          : sort === 'oldest'
            ? str(a, 'date').localeCompare(str(b, 'date'))
            : sort === 'largest'
              ? num(b, 'amount') - num(a, 'amount')
              : num(a, 'amount') - num(b, 'amount'),
      );
  }
  const hints: Partial<Record<Entity, string>> = {
    goals: 'goalHint',
    debts: 'debtHint',
    recurring: 'recurringHint',
    categories: 'renameData',
  };
  async function payment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await request(`/api/debts/${pay!.id}/pay`, 'POST', Object.fromEntries(f));
      await onRefresh();
      setPay(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'serverError');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">FinCore / {t(entity)}</p>
          <h1>{t(entity)}</h1>
          {hints[entity] && <p className="hint">{t(hints[entity]!)}</p>}
        </div>
        <div className="page-actions">
          {entity === 'budgets' && (
            <label>
              <span className="sr-only">{t('month')}</span>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
          )}
          {entity === 'recurring' && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await request('/api/data', 'POST');
                  await onRefresh();
                } catch (e) {
                  onError(e instanceof Error ? e.message : 'serverError');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('process')}
            </button>
          )}
          <button className="primary" onClick={onAdd}>
            <Plus size={17} />
            {t('add')}
          </button>
        </div>
      </div>
      {entity === 'transactions' && (
        <div className="panel filters">
          <input
            aria-label={t('search')}
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select aria-label={t('kind')} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">
              {t('all')} · {t('kind')}
            </option>
            {['income', 'expense', 'transfer'].map((k) => (
              <option key={k} value={k}>
                {t(k)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('accountId')}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">
              {t('all')} · {t('accounts')}
            </option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {str(a, 'name')}
              </option>
            ))}
          </select>
          <select
            aria-label={t('categoryId')}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">
              {t('all')} · {t('categories')}
            </option>
            {data.categories.map((a) => (
              <option key={a.id} value={a.id}>
                {str(a, 'name')}
              </option>
            ))}
          </select>
          <label>
            {t('from')}
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            {t('to')}
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <select aria-label={t('sort')} value={sort} onChange={(e) => setSort(e.target.value)}>
            {['newest', 'oldest', 'largest', 'smallest'].map((s) => (
              <option key={s} value={s}>
                {t(s)}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearch('');
              setKind('');
              setAccount('');
              setCategory('');
              setFrom('');
              setTo('');
            }}
          >
            {t('reset')}
          </button>
        </div>
      )}
      {rows.length ? (
        entity === 'transactions' ? (
          <section className="panel">
            <div className="panel-title">
              <h3>
                {rows.length} {t('rows')}
              </h3>
              <small>{t('sortHint')}</small>
            </div>
            <TransactionList
              rows={rows}
              data={data}
              t={t}
              money={money}
              onEdit={onEdit}
              onDelete={onDelete}
            />
            <ReceiptManager rows={rows} t={t} onRefresh={onRefresh} onError={onError} />
          </section>
        ) : (
          <section className="record-grid">
            {rows.map((r) => {
              const spent =
                entity === 'budgets'
                  ? (() => {
                      const ids = categoryIds(
                        data.categories.map((c) => ({
                          id: c.id,
                          parentId: str(c, 'parentId') || null,
                        })),
                        str(r, 'categoryId'),
                      );
                      return (
                        data.transactions
                          .filter(
                            (a) =>
                              a.kind === 'expense' &&
                              ids.includes(str(a, 'categoryId')) &&
                              str(a, 'date').startsWith(month) &&
                              str(a, 'date').slice(0, 10) <= today(),
                          )
                          .reduce((s, a) => s + cents(a.amount), 0) / 100
                      );
                    })()
                  : 0;
              const pct =
                entity === 'goals'
                  ? (num(r, 'saved') / num(r, 'target')) * 100
                  : entity === 'budgets'
                    ? (spent / num(r, 'amount')) * 100
                    : 0;
              return (
                <article key={r.id} className={`panel record-card ${entity}`}>
                  <div className="record-top">
                    <span
                      className="account-symbol"
                      style={{
                        color: str(r, 'color') || 'var(--accent)',
                        background: (str(r, 'color') || '#5765f2') + '18',
                      }}
                    >
                      {entity === 'goals' ? (
                        <Target size={22} />
                      ) : entity === 'recurring' ? (
                        <CalendarDays size={22} />
                      ) : (
                        <Wallet size={22} />
                      )}
                    </span>
                    <Actions row={r} onEdit={onEdit} onDelete={onDelete} t={t} />
                  </div>
                  <h3>
                    {entity === 'budgets'
                      ? (data.categories.find((c) => c.id === r.categoryId)?.name as string)
                      : str(r, 'name') || str(r, 'description')}
                  </h3>
                  {entity === 'accounts' && (
                    <>
                      <p className="hint">{t(str(r, 'kind'))}</p>
                      <h2>
                        {money(
                          balance(
                            { id: r.id, openingBalance: r.openingBalance },
                            ledger(data.transactions),
                            today(),
                          ),
                        )}
                      </h2>
                      <small>
                        {t('openingBalance')}: {money(num(r, 'openingBalance'))}
                      </small>
                    </>
                  )}
                  {entity === 'categories' && (
                    <>
                      <span className="pill">{t(str(r, 'kind'))}</span>
                      {r.parentId ? (
                        <p className="hint">
                          {t('parentId')}:{' '}
                          {str(
                            data.categories.find((c) => c.id === r.parentId)!,
                            'name',
                          )}
                        </p>
                      ) : null}
                    </>
                  )}
                  {(entity === 'budgets' || entity === 'goals') && (
                    <>
                      <div className="record-amount">
                        <h2>{money(entity === 'goals' ? num(r, 'saved') : spent)}</h2>
                        <span>/ {money(num(r, entity === 'goals' ? 'target' : 'amount'))}</span>
                      </div>
                      <div className="progress">
                        <i
                          style={{
                            width: Math.min(100, pct) + '%',
                            background:
                              pct > 100 ? 'var(--danger)' : str(r, 'color') || 'var(--accent)',
                          }}
                        />
                      </div>
                      <p className="record-bottom">
                        <span>
                          {entity === 'budgets' ? t(pct > 100 ? 'over' : 'left') : t('progress')}
                        </span>
                        <b>
                          {entity === 'budgets'
                            ? money(Math.abs(num(r, 'amount') - spent))
                            : Math.round(pct) + '%'}
                        </b>
                      </p>
                      {r.deadline ? (
                        <small>
                          {t('deadline')}: {str(r, 'deadline').slice(0, 10)}
                        </small>
                      ) : null}
                    </>
                  )}
                  {entity === 'debts' && (
                    <>
                      <span className="pill">{t(str(r, 'direction'))}</span>
                      <h2>{money(num(r, 'remaining'))}</h2>
                      <p className="hint">
                        {t('principal')}: {money(num(r, 'principal'))} · {num(r, 'interestRate')}%
                      </p>
                      {r.dueDate ? (
                        <p>
                          {t('dueDate')}: {str(r, 'dueDate').slice(0, 10)}
                        </p>
                      ) : null}
                      <button
                        disabled={!num(r, 'remaining') || !data.accounts.length}
                        onClick={() => setPay(r)}
                      >
                        {t('pay')}
                      </button>
                    </>
                  )}
                  {entity === 'recurring' && (
                    <>
                      <h2>{money(num(r, 'amount'))}</h2>
                      <p>
                        {t(str(r, 'frequency'))} · {t(str(r, 'kind'))}
                      </p>
                      <p className="hint">
                        {t('nextDate')}: {str(r, 'nextDate').slice(0, 10)}
                      </p>
                      <span className="pill">
                        {t('active')}: {r.active ? '✓' : '—'}
                      </span>
                    </>
                  )}
                </article>
              );
            })}
          </section>
        )
      ) : (
        <Empty
          t={t}
          onAdd={onAdd}
          noResults={entity === 'transactions' && !!data.transactions.length}
        />
      )}
      {pay && (
        <Modal
          closeLabel={t('close')}
          title={t('pay')}
          description={str(pay, 'name')}
          onClose={() => setPay(null)}
        >
          <form className="editor-form" onSubmit={payment}>
            <label>
              {t('accountId')}
              <select name="accountId" required>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {str(a, 'name')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('amount')}
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                max={num(pay, 'remaining')}
                required
                defaultValue={num(pay, 'remaining')}
              />
            </label>
            <label>
              {t('date')}
              <input max={today()} name="date" type="date" defaultValue={today()} required />
            </label>
            <footer>
              <button type="button" onClick={() => setPay(null)}>
                {t('cancel')}
              </button>
              <button className="primary" disabled={busy}>
                {t('save')}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
function ReceiptManager({
  rows,
  t,
  onRefresh,
  onError,
}: {
  rows: Row[];
  t: T;
  onRefresh: () => Promise<void>;
  onError: (e: string) => void;
}) {
  const [selected, setSelected] = useState(rows[0]?.id || '');
  const [busy, setBusy] = useState(false);
  async function upload(file?: File) {
    if (!file || !selected) return;
    setBusy(true);
    const f = new FormData();
    f.set('file', file);
    f.set('transactionId', selected);
    try {
      const res = await fetch('/api/attachments', { method: 'POST', body: f });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      await onRefresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'serverError');
    } finally {
      setBusy(false);
    }
  }
  const row = rows.find((r) => r.id === selected);
  const attachments = (row?.attachments || []) as {
    id: string;
    filename: string;
  }[];
  return (
    <details className="receipts">
      <summary>
        <Paperclip size={16} />
        {t('attachments')}
      </summary>
      <select
        aria-label={t('transactions')}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {str(r, 'date').slice(0, 10)} · {str(r, 'description')}
          </option>
        ))}
      </select>
      <div
        className="dropzone"
        aria-busy={busy}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) void upload(e.dataTransfer.files[0]);
        }}
      >
        <p>{t('drop')}</p>
        <small>{t('fileHint')}</small>
        <label className="file-button">
          {t('upload')}
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            disabled={busy}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {attachments.map((a) => (
        <div className="attachment-row" key={a.id}>
          <a href={`/api/attachments?id=${a.id}`}>{a.filename}</a>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await request(`/api/attachments?id=${a.id}`, 'DELETE');
                await onRefresh();
              } catch (e) {
                onError(e instanceof Error ? e.message : 'serverError');
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('delete')}
          </button>
        </div>
      ))}
    </details>
  );
}
export function CalendarView({
  data,
  t,
  money,
  locale,
  onEdit,
}: {
  data: Data;
  t: T;
  money: (n: number) => string;
  locale: string;
  onEdit: (r: Row) => void;
}) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [day, setDay] = useState(today());
  const start = new Date(month + '-01');
  const days = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (start.getUTCDay() + 6) % 7;
  function shift(n: number) {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  }
  const selected = data.transactions.filter((r) => str(r, 'date').startsWith(day));
  return (
    <>
      <div className="page-title">
        <h1>{t('calendar')}</h1>
        <div className="page-actions">
          <button aria-label={t('previous')} onClick={() => shift(-1)}>
            <ChevronLeft size={18} />
          </button>
          <b>
            {new Intl.DateTimeFormat(locale, {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(start)}
          </b>
          <button aria-label={t('next')} onClick={() => shift(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="calendar-layout">
        <section className="panel">
          <div className="calendar-grid weekday-row">
            {Array.from({ length: 7 }, (_, i) => (
              <b key={i}>
                {new Intl.DateTimeFormat(locale, {
                  weekday: 'short',
                  timeZone: 'UTC',
                }).format(new Date(Date.UTC(2026, 0, 5 + i)))}
              </b>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from({ length: offset }, (_, i) => (
              <div key={'blank' + i} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const d = month + '-' + String(i + 1).padStart(2, '0');
              const rows = data.transactions.filter((r) => str(r, 'date').startsWith(d));
              return (
                <button
                  key={d}
                  className={`calendar-day ${day === d ? 'selected' : ''} ${d === today() ? 'is-today' : ''}`}
                  onClick={() => setDay(d)}
                >
                  <b>{i + 1}</b>
                  {rows.slice(0, 2).map((r) => (
                    <span key={r.id} className={str(r, 'kind')}>
                      {money(num(r, 'amount'))}
                    </span>
                  ))}
                  {rows.length > 2 && <small>+{rows.length - 2}</small>}
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <h3>
            {t('selectedDate')} · {day}
          </h3>
          {selected.length ? (
            selected.map((r) => (
              <button className="calendar-operation" key={r.id} onClick={() => onEdit(r)}>
                <span>{str(r, 'description')}</span>
                <b>{money(num(r, 'amount'))}</b>
              </button>
            ))
          ) : (
            <Empty t={t} />
          )}
        </section>
      </div>
    </>
  );
}
