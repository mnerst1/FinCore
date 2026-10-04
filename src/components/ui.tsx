'use client';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Inbox,
  Trash2,
  Pencil,
} from 'lucide-react';
import { Row, str } from './types';
export type T = (key: string) => string;
export function Modal({
  title,
  description,
  children,
  onClose,
  closeLabel,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal">
          <header>
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description || title}</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label={closeLabel}>
              <X size={20} />
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({
  t,
  onAdd,
  noResults = false,
}: {
  t: T;
  onAdd?: () => void;
  noResults?: boolean;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={30} />
      </span>
      <h3>{t(noResults ? 'noResults' : 'empty')}</h3>
      <p>{t(noResults ? 'noResultsHint' : 'emptyHint')}</p>
      {onAdd && (
        <button className="primary" onClick={onAdd}>
          <Plus size={16} />
          {t('add')}
        </button>
      )}
    </div>
  );
}
export function Actions({
  row,
  onEdit,
  onDelete,
  t,
}: {
  row: Row;
  onEdit: (r: Row) => void;
  onDelete: (r: Row) => void;
  t: T;
}) {
  return (
    <div className="row-actions">
      <button className="icon-button" aria-label={t('edit')} onClick={() => onEdit(row)}>
        <Pencil size={16} />
      </button>
      <button className="icon-button danger" aria-label={t('delete')} onClick={() => onDelete(row)}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}
export function KindIcon({ kind }: { kind: string }) {
  return (
    <span className={`kind-icon ${kind}`}>
      {kind === 'income' ? (
        <ArrowDownLeft size={18} />
      ) : kind === 'transfer' ? (
        <ArrowLeftRight size={18} />
      ) : (
        <ArrowUpRight size={18} />
      )}
    </span>
  );
}
export function TransactionList({
  rows,
  data,
  t,
  money,
  onEdit,
  onDelete,
  compact = false,
}: {
  rows: Row[];
  data: { accounts: Row[]; categories: Row[] };
  t: T;
  money: (n: number) => string;
  onEdit: (r: Row) => void;
  onDelete: (r: Row) => void;
  compact?: boolean;
}) {
  return (
    <div className="transaction-list">
      {rows.map((r) => (
        <div className="transaction" key={r.id}>
          <KindIcon kind={str(r, 'kind')} />
          <div className="transaction-name">
            <strong>{str(r, 'description')}</strong>
            <small>
              {(data.categories.find((c) => c.id === r.categoryId)?.name as string) ||
                t('uncategorized')}{' '}
              <span>·</span> {data.accounts.find((a) => a.id === r.accountId)?.name as string}
            </small>
          </div>
          <time dateTime={str(r, 'date')}>{str(r, 'date').slice(0, 10)}</time>
          <b className={str(r, 'kind') === 'income' ? 'positive' : ''}>
            {str(r, 'kind') === 'income' ? '+' : str(r, 'kind') === 'expense' ? '−' : ''}
            {money(Number(r.amount))}
          </b>
          {!compact && <Actions row={r} onEdit={onEdit} onDelete={onDelete} t={t} />}
        </div>
      ))}
    </div>
  );
}
