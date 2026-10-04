'use client';
import { useState } from 'react';
import { Modal, T } from './ui';
import { Data, Row, str, request } from './types';
import { today } from '@/lib/finance';
import type { Entity } from '@/lib/service';
type Field = {
  key: string;
  type?: string;
  options?: string[];
  source?: 'accounts' | 'categories';
  optional?: boolean;
};
const definitions: Record<Entity, Field[]> = {
  accounts: [
    { key: 'name' },
    {
      key: 'kind',
      options: ['bank', 'cash', 'savings', 'investment', 'credit'],
    },
    { key: 'openingBalance', type: 'number' },
    { key: 'color', type: 'color' },
  ],
  categories: [
    { key: 'name' },
    { key: 'kind', options: ['expense', 'income'] },
    { key: 'parentId', source: 'categories', optional: true },
    { key: 'color', type: 'color' },
  ],
  transactions: [
    { key: 'description' },
    { key: 'kind', options: ['expense', 'income', 'transfer'] },
    { key: 'amount', type: 'number' },
    { key: 'accountId', source: 'accounts' },
    { key: 'toAccountId', source: 'accounts', optional: true },
    { key: 'categoryId', source: 'categories', optional: true },
    { key: 'date', type: 'date' },
    { key: 'note', type: 'textarea', optional: true },
  ],
  budgets: [
    { key: 'categoryId', source: 'categories' },
    { key: 'month', type: 'month' },
    { key: 'amount', type: 'number' },
  ],
  goals: [
    { key: 'name' },
    { key: 'target', type: 'number' },
    { key: 'saved', type: 'number' },
    { key: 'deadline', type: 'date', optional: true },
    { key: 'color', type: 'color' },
  ],
  debts: [
    { key: 'name' },
    { key: 'direction', options: ['owe', 'owed'] },
    { key: 'principal', type: 'number' },
    { key: 'remaining', type: 'number' },
    { key: 'interestRate', type: 'number' },
    { key: 'dueDate', type: 'date', optional: true },
  ],
  recurring: [
    { key: 'description' },
    { key: 'kind', options: ['expense', 'income'] },
    { key: 'amount', type: 'number' },
    { key: 'accountId', source: 'accounts' },
    { key: 'categoryId', source: 'categories', optional: true },
    { key: 'frequency', options: ['monthly', 'weekly', 'daily', 'yearly'] },
    { key: 'nextDate', type: 'date' },
    { key: 'active', type: 'checkbox' },
  ],
};
const defaults: Record<string, unknown> = {
  kind: 'expense',
  openingBalance: 0,
  color: '#5765f2',
  saved: 0,
  interestRate: 0,
  direction: 'owe',
  frequency: 'monthly',
  active: true,
  note: '',
};
export function Editor({
  entity,
  row,
  data,
  t,
  onClose,
  onSaved,
}: {
  entity: Entity;
  row?: Row;
  data: Data;
  t: T;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {
      ...defaults,
      date: today(),
      nextDate: today(),
      month: today().slice(0, 7),
      accountId: data.accounts[0]?.id,
      ...row,
    };
    if (entity === 'accounts' && !row) v.kind = 'bank';
    return v;
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = { ...values };
    for (const f of definitions[entity])
      if (f.optional && f.type !== 'textarea' && !body[f.key]) body[f.key] = null;
    try {
      await request(
        `/api/records/${entity}${row ? `?id=${row.id}` : ''}`,
        row ? 'PATCH' : 'POST',
        body,
      );
      await onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'serverError');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      closeLabel={t('close')}
      title={`${t(row ? 'edit' : 'add')} · ${t(entity)}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="editor-form">
        <div className="form-grid">
          {definitions[entity]
            .filter((f) => f.key !== 'toAccountId' || values.kind === 'transfer')
            .filter((f) => f.key !== 'categoryId' || values.kind !== 'transfer')
            .map((f) => {
              let options = f.source ? data[f.source].filter((r) => r.id !== row?.id) : [];
              if (f.source === 'categories')
                options = options.filter(
                  (c) => c.kind === (entity === 'budgets' ? 'expense' : values.kind),
                );
              const val =
                f.type === 'date'
                  ? String(values[f.key] || '').slice(0, 10)
                  : String(values[f.key] ?? '');
              return (
                <label key={f.key} className={f.type === 'textarea' ? 'wide' : ''}>
                  <span>
                    {t(f.key)} {f.optional && <small>({t('optional')})</small>}
                  </span>
                  {f.options || f.source ? (
                    <select
                      required={!f.optional}
                      value={val}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    >
                      {f.optional && <option value="">—</option>}
                      {!f.optional && (
                        <option value="" disabled>
                          —
                        </option>
                      )}
                      {f.options?.map((o) => (
                        <option value={o} key={o}>
                          {t(o)}
                        </option>
                      ))}
                      {options.map((o) => (
                        <option value={o.id} key={o.id}>
                          {str(o, 'name')}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(values[f.key])}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.checked })}
                    />
                  ) : f.type === 'textarea' ? (
                    <textarea
                      maxLength={2000}
                      value={val}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      required={!f.optional}
                      type={f.type || 'text'}
                      step={f.type === 'number' ? '0.01' : undefined}
                      maxLength={100}
                      value={val}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    />
                  )}
                </label>
              );
            })}
        </div>
        {error && (
          <p role="alert" className="form-error">
            {t(error)}
          </p>
        )}
        <footer>
          <button type="button" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="primary" disabled={busy}>
            {t('save')}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
