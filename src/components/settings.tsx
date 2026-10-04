'use client';
import { useState } from 'react';
import { Check, Download, Upload, ShieldCheck, Palette, Globe, UserRound } from 'lucide-react';
import { Data, User, request } from './types';
import { T } from './ui';
import { locales, coverage } from '@/lib/i18n';
const accents = [
  ['blue', '#5765f2'],
  ['violet', '#8b5cf6'],
  ['green', '#168c68'],
  ['cyan', '#087d96'],
  ['orange', '#c56723'],
  ['red', '#cf3c4d'],
  ['pink', '#c43d8a'],
];
export function Settings({
  data,
  t,
  onRefresh,
  onUser,
  onError,
  onSuccess,
}: {
  data: Data;
  t: T;
  onRefresh: () => Promise<void>;
  onUser: (u: User) => void;
  onError: (key: string) => void;
  onSuccess: (key: string) => void;
}) {
  const [values, setValues] = useState({ ...data.user });
  const [busy, setBusy] = useState(false);
  const change = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await request('/api/settings', 'PATCH', values);
      onUser(user);
      await onRefresh();
      onSuccess('success');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'serverError');
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file: File | undefined, json: boolean) {
    if (!file) return;
    setBusy(true);
    try {
      const res = await fetch('/api/portability', {
        method: 'POST',
        headers: { 'Content-Type': json ? 'application/json' : 'text/csv' },
        body: await file.text(),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await onRefresh();
      onSuccess('importSuccess');
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
          <p className="eyebrow">FinCore / {t('settings')}</p>
          <h1>{t('settings')}</h1>
        </div>
        <ShieldCheck size={30} />
      </div>
      <form onSubmit={save} className="settings-layout">
        <section className="panel">
          <div className="panel-title">
            <h3>
              <UserRound size={19} />
              {t('profile')}
            </h3>
          </div>
          <div className="form-grid">
            <label>
              {t('name')}
              <input
                required
                maxLength={100}
                value={values.name}
                onChange={(e) => change('name', e.target.value)}
              />
            </label>
            <label>
              {t('email')}
              <input
                required
                type="email"
                value={values.email}
                onChange={(e) => change('email', e.target.value)}
              />
            </label>
            <label>
              {t('currency')}
              <select
                aria-label={t('currency')}
                value={values.currency}
                onChange={(e) => change('currency', e.target.value)}
              >
                {[
                  'USD',
                  'EUR',
                  'KZT',
                  'RUB',
                  'GBP',
                  'TRY',
                  'JPY',
                  'CNY',
                  'INR',
                  'KRW',
                  'UAH',
                  'BRL',
                  'AED',
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              {t('language')}
              <select
                aria-label={t('language')}
                value={values.locale}
                onChange={(e) => change('locale', e.target.value)}
              >
                {Object.entries(locales).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v.name} · {coverage(k)}%
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">{t('currencyHint')}</p>
          <p className="hint">
            <Globe size={14} />
            {t(locales[values.locale]?.complete ? 'completeTranslation' : 'partialTranslation')}
          </p>
        </section>
        <section className="panel appearance-panel">
          <div className="panel-title">
            <h3>
              <Palette size={19} />
              {t('appearance')}
            </h3>
          </div>
          <p>{t('theme')}</p>
          <div className="segmented">
            {['light', 'dark', 'system'].map((k) => (
              <button
                type="button"
                aria-pressed={values.theme === k}
                className={values.theme === k ? 'selected' : ''}
                key={k}
                onClick={() => change('theme', k)}
              >
                {t(k)}
              </button>
            ))}
          </div>
          <p>{t('style')}</p>
          <div className="style-grid">
            {['clean', 'glass', 'minimal', 'contrast', 'soft'].map((k) => (
              <button
                type="button"
                aria-pressed={values.style === k}
                aria-label={t(k)}
                className={values.style === k ? 'selected' : ''}
                key={k}
                onClick={() => change('style', k)}
              >
                <span className={`style-preview ${k}`}>
                  <i />
                  <i />
                  <i />
                </span>
                {t(k)}
              </button>
            ))}
          </div>
          <p>{t('accent')}</p>
          <div className="swatches">
            {accents.map(([k, v]) => (
              <button
                type="button"
                key={k}
                aria-label={t(k)}
                aria-pressed={values.accent === v}
                style={{ background: v }}
                onClick={() => change('accent', v)}
              >
                {values.accent === v && <Check size={19} />}
              </button>
            ))}
            <label>
              {t('custom')}
              <input
                type="color"
                value={values.accent}
                onChange={(e) => change('accent', e.target.value)}
              />
            </label>
          </div>
        </section>
        <div className="settings-save">
          <button className="primary" disabled={busy}>
            {t('save')}
          </button>
        </div>
      </form>
      <div className="settings-layout">
        <section className="panel">
          <div className="panel-title">
            <h3>
              <ShieldCheck size={19} />
              {t('security')}
            </h3>
          </div>
          <p className="hint">{t('passwordHint')}</p>
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                await request('/api/settings', 'POST', Object.fromEntries(f));
                window.location.reload();
              } catch (e) {
                onError(e instanceof Error ? e.message : 'serverError');
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t('currentPassword')}
              <input
                name="current"
                type="password"
                required
                autoComplete="current-password"
                maxLength={128}
              />
            </label>
            <label>
              {t('newPassword')}
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <button disabled={busy}>{t('changePassword')}</button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-title">
            <h3>
              <Download size={19} />
              {t('data')}
            </h3>
          </div>
          <div className="data-buttons">
            <a className="button" href="/api/portability?format=csv">
              <Download size={16} />
              {t('exportCsv')}
            </a>
            <a className="button" href="/api/portability?format=json">
              <Download size={16} />
              {t('exportJson')}
            </a>
            <label className="file-button">
              <Upload size={16} />
              {t('importCsv')}
              <input
                type="file"
                accept=".csv"
                disabled={busy}
                onChange={(e) => {
                  void importFile(e.target.files?.[0], false);
                  e.target.value = '';
                }}
              />
            </label>
            <label className="file-button">
              <Upload size={16} />
              {t('restoreJson')}
              <input
                type="file"
                accept=".json"
                disabled={busy}
                onChange={(e) => {
                  void importFile(e.target.files?.[0], true);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <p className="hint">{t('importHint')}</p>
          <p className="hint">{t('backupHint')}</p>
        </section>
      </div>
    </>
  );
}
