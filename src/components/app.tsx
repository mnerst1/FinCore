'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  ChartPie,
  Target,
  HandCoins,
  Repeat2,
  CalendarDays,
  Tags,
  History,
  Settings2,
  Bell,
  LogOut,
  Plus,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ArrowRight,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { User, Data, Row, str, request } from './types';
import { translate, locales, formatMoney } from '@/lib/i18n';
import { today } from '@/lib/finance';
import { Overview } from './overview';
import { Records, CalendarView } from './records';
import { Editor } from './editor';
import { Settings } from './settings';
import { Empty, Modal } from './ui';
import type { Entity } from '@/lib/service';
const navigation = [
  ['overview', LayoutDashboard],
  ['transactions', ArrowLeftRight],
  ['accounts', Wallet],
  ['budgets', ChartPie],
  ['goals', Target],
  ['debts', HandCoins],
  ['recurring', Repeat2],
  ['calendar', CalendarDays],
  ['categories', Tags],
  ['activity', History],
  ['settings', Settings2],
] as const;
export function App({ initialUser }: { initialUser: User | null }) {
  const [user, setUser] = useState(initialUser);
  const [data, setData] = useState<Data | null>(null);
  const [locale, setLocale] = useState(initialUser?.locale || 'en');
  const [localeReady, setLocaleReady] = useState(false);
  const [view, setView] = useState('overview');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [mobile, setMobile] = useState(false);
  const [compact, setCompact] = useState(false);
  const [editor, setEditor] = useState<{ entity: Entity; row?: Row } | null>(null);
  const [deleting, setDeleting] = useState<{ entity: Entity; row: Row } | null>(null);
  const [toast, setToast] = useState<{ key: string; error: boolean } | null>(null);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const reduced = useReducedMotion();
  const t = useCallback((k: string) => translate(locale, k), [locale]);
  const money = (n: number) => formatMoney(n, user?.currency || 'USD', locale);
  const showError = (key: string) => setToast({ key, error: true });
  const showSuccess = (key: string) => setToast({ key, error: false });
  const reload = useCallback(async () => {
    const result = (await request('/api/data')) as Data;
    setData(result);
    setUser(result.user);
    setLocale(result.user.locale);
    setFailure('');
  }, []);
  useEffect(() => {
    const saved = localStorage.getItem('fincore-locale');
    if (!initialUser && saved && locales[saved]) setLocale(saved);
    setCompact(localStorage.getItem('fincore-sidebar-compact') === 'true');
    setLocaleReady(true);
    const update = () => {
      const requested = new URLSearchParams(window.location.search).get('view') || 'overview';
      setView(
        navigation.some((n) => n[0] === requested) || requested === 'notifications'
          ? requested
          : 'overview',
      );
    };
    update();
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, [initialUser]);
  useEffect(() => {
    if (!localeReady) return;
    document.documentElement.lang = locale;
    document.documentElement.dir = locales[locale]?.dir || 'ltr';
    localStorage.setItem('fincore-locale', locale);
  }, [locale, localeReady]);
  useEffect(() => {
    if (localeReady) localStorage.setItem('fincore-sidebar-compact', String(compact));
  }, [compact, localeReady]);
  useEffect(() => {
    if (!user) return;
    const root = document.documentElement;
    root.dataset.style = user.style;
    root.style.setProperty('--accent', user.accent);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      root.dataset.theme =
        user.theme === 'system' ? (media.matches ? 'dark' : 'light') : user.theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [user]);
  useEffect(() => {
    if (!user?.id) return;
    let live = true;
    void (async () => {
      try {
        await request('/api/data', 'POST');
        if (live) await reload();
      } catch (e) {
        if (live) setFailure(e instanceof Error ? e.message : 'serverError');
      }
    })();
    return () => {
      live = false;
    };
  }, [user?.id, reload]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  function navigate(v: string) {
    setView(v);
    setMobile(false);
    window.history.pushState(null, '', `/?view=${v}`);
    window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' });
  }
  function add(entity: Entity) {
    if (['transactions', 'recurring'].includes(entity) && !data?.accounts.length) {
      showError('accountRequired');
      navigate('accounts');
      return;
    }
    setEditor({ entity });
  }
  if (!user)
    return (
      <Auth
        locale={locale}
        setLocale={setLocale}
        t={t}
        onUser={(u) => {
          setUser(u);
          setLocale(u.locale);
        }}
      />
    );
  const unread = data?.notifications.filter((n) => !n.read).length || 0;
  return (
    <div className={`app-shell ${compact ? 'sidebar-compact' : ''}`}>
      <button
        className={`sidebar-scrim ${mobile ? 'open' : ''}`}
        aria-label={t('close')}
        onClick={() => setMobile(false)}
      />
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link
            href="/"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              navigate('overview');
            }}
          >
            <span className="brand-mark">
              f<span>·</span>
            </span>
            <span className="brand-name">FinCore</span>
          </Link>
          <button
            className="sidebar-toggle icon-button"
            aria-label={t(compact ? 'expandSidebar' : 'collapseSidebar')}
            title={t(compact ? 'expandSidebar' : 'collapseSidebar')}
            aria-expanded={!compact}
            aria-controls="primary-navigation"
            onClick={() => setCompact((value) => !value)}
          >
            {compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <p className="sidebar-caption">{t('financialSpace')}</p>
        <nav id="primary-navigation">
          {navigation.map(([key, Icon], i) => (
            <button
              className={`${view === key ? 'active' : ''} ${i === 8 ? 'nav-gap' : ''}`}
              key={key}
              aria-label={t(key)}
              title={t(key)}
              aria-current={view === key ? 'page' : undefined}
              onClick={() => navigate(key)}
            >
              <Icon size={19} />
              <span>{t(key)}</span>
              {view === key && <i />}
            </button>
          ))}
        </nav>
        <div className="privacy-card">
          <ShieldCheck size={19} />
          <p>{t('localOnly')}</p>
          <span>● PostgreSQL</span>
        </div>
        <div className="sidebar-profile">
          <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <button
            className="profile-details"
            aria-label={t('settings')}
            title={user.name}
            onClick={() => navigate('settings')}
          >
            <span className="avatar compact-profile-avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </button>
          <button
            className="icon-button"
            aria-label={t('logout')}
            title={t('logout')}
            onClick={async () => {
              try {
                await request('/api/logout', 'POST');
                setUser(null);
                setData(null);
              } catch (e) {
                showError(e instanceof Error ? e.message : 'serverError');
              }
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label={t('menu')}
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">{t(view)}</span>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label={t('refresh')}
              onClick={async () => {
                try {
                  await request('/api/data', 'POST');
                  await reload();
                  showSuccess('processed');
                } catch (e) {
                  showError(e instanceof Error ? e.message : 'serverError');
                }
              }}
            >
              <Repeat2 size={19} />
            </button>
            <button
              className="icon-button notification-button"
              aria-label={t('notifications')}
              onClick={() => navigate('notifications')}
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </button>
            <span className="avatar small">{user.name.slice(0, 1)}</span>
            <button className="primary" onClick={() => add('transactions')}>
              <Plus size={17} />
              <span>{t('newTransaction')}</span>
            </button>
          </div>
        </header>
        <main>
          {failure ? (
            <div className="panel empty">
              <h2>{t('error')}</h2>
              <p>{t(failure)}</p>
              <button
                onClick={() => {
                  void request('/api/data', 'POST')
                    .then(reload)
                    .catch((e) => setFailure(e.message));
                }}
              >
                {t('retry')}
              </button>
            </div>
          ) : !data ? (
            <div aria-busy="true">
              <p className="hint">{t('loading')}</p>
              <div className="metrics">
                {[0, 1, 2, 3].map((i) => (
                  <div className="skeleton metric" key={i} />
                ))}
              </div>
              <div className="skeleton tall" />
            </div>
          ) : (
            <div>
              <motion.div
                key={view}
                initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.18 }}
              >
                {view === 'overview' ? (
                  <Overview
                    data={data}
                    t={t}
                    money={money}
                    locale={locale}
                    month={month}
                    setMonth={setMonth}
                    navigate={navigate}
                    onAdd={() => add('transactions')}
                  />
                ) : view === 'settings' ? (
                  <Settings
                    key={data.user.id}
                    data={data}
                    t={t}
                    onRefresh={reload}
                    onUser={setUser}
                    onError={showError}
                    onSuccess={showSuccess}
                  />
                ) : view === 'calendar' ? (
                  <CalendarView
                    data={data}
                    t={t}
                    money={money}
                    locale={locale}
                    onEdit={(row) => setEditor({ entity: 'transactions', row })}
                  />
                ) : view === 'activity' ? (
                  <>
                    <div className="page-title">
                      <h1>{t('activity')}</h1>
                    </div>
                    <section className="panel activity-list">
                      {data.activities.length ? (
                        data.activities.map((r) => (
                          <div key={r.id}>
                            <span className="timeline-dot" />
                            <div>
                              <strong>
                                {t(str(r, 'action'))} · {t(str(r, 'entity'))}
                              </strong>
                              <p>{str(r, 'label')}</p>
                            </div>
                            <time>
                              {new Intl.DateTimeFormat(locale, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }).format(new Date(str(r, 'createdAt')))}
                            </time>
                          </div>
                        ))
                      ) : (
                        <Empty t={t} />
                      )}
                    </section>
                  </>
                ) : view === 'notifications' ? (
                  <>
                    <div className="page-title">
                      <div>
                        <h1>{t('notifications')}</h1>
                        <p className="hint">{t('notificationHint')}</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await request('/api/notifications', 'POST');
                            await reload();
                          } catch (e) {
                            showError(e instanceof Error ? e.message : 'serverError');
                          }
                        }}
                      >
                        {t('markRead')}
                      </button>
                    </div>
                    <section className="panel activity-list">
                      {data.notifications.length ? (
                        data.notifications.map((r) => (
                          <div key={r.id} className={r.read ? 'is-read' : ''}>
                            <Bell size={20} />
                            <div>
                              <strong>{t(str(r, 'type'))}</strong>
                              <p>{str(r, 'label')}</p>
                            </div>
                            <span className="pill">{t(r.read ? 'read' : 'unread')}</span>
                          </div>
                        ))
                      ) : (
                        <Empty t={t} />
                      )}
                    </section>
                  </>
                ) : (
                  <Records
                    key={view}
                    entity={view as Entity}
                    data={data}
                    t={t}
                    money={money}
                    month={month}
                    setMonth={setMonth}
                    onEdit={(row) => setEditor({ entity: view as Entity, row })}
                    onDelete={(row) => setDeleting({ entity: view as Entity, row })}
                    onAdd={() => add(view as Entity)}
                    onRefresh={reload}
                    onError={showError}
                  />
                )}
              </motion.div>
            </div>
          )}
          <footer className="app-footer">
            <span>FinCore</span>
            <small>{t('localOnly')}</small>
          </footer>
        </main>
      </div>
      {data && editor && (
        <Editor
          key={editor.row?.id || editor.entity}
          entity={editor.entity}
          row={editor.row}
          data={data}
          t={t}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            await reload();
            showSuccess('success');
          }}
        />
      )}
      {deleting && (
        <Modal
          closeLabel={t('close')}
          title={t('deleteConfirm')}
          description={t('deleteHint')}
          onClose={() => setDeleting(null)}
        >
          <p>{str(deleting.row, 'name') || str(deleting.row, 'description')}</p>
          <footer>
            <button onClick={() => setDeleting(null)}>{t('cancel')}</button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await request(`/api/records/${deleting.entity}?id=${deleting.row.id}`, 'DELETE');
                  await reload();
                  setDeleting(null);
                  showSuccess('deleted');
                } catch (e) {
                  showError(e instanceof Error ? e.message : 'serverError');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('delete')}
            </button>
          </footer>
        </Modal>
      )}
      <AnimatePresence>
        {toast && (
          <motion.div
            role={toast.error ? 'alert' : 'status'}
            className={`toast ${toast.error ? 'error' : ''}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span>{t(toast.key)}</span>
            <button className="icon-button" aria-label={t('close')} onClick={() => setToast(null)}>
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function Auth({
  locale,
  setLocale,
  t,
  onUser,
}: {
  locale: string;
  setLocale: (l: string) => void;
  t: (k: string) => string;
  onUser: (u: User) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="auth-page">
      <section className="auth-art">
        <Link href="/" className="brand">
          <span className="brand-mark">
            f<span>·</span>
          </span>
          FinCore
        </Link>
        <div className="auth-copy">
          <p className="eyebrow">FINCORE</p>
          <h1>{t('welcome')}</h1>
          <p>{t('intro')}</p>
          <div className="auth-illustration">
            <div className="orbit orbit-a" />
            <div className="orbit orbit-b" />
            <div className="floating-card">
              <Wallet size={25} />
              <small>{t('netWorth')}</small>
              <b>
                $ 24,890<span>.00</span>
              </b>
              <div className="sparkline">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <span className="sample-label">{t('sample')}</span>
            </div>
            <div className="floating-tag">
              <Target size={19} />
              {t('goals')}
              <span>↗</span>
            </div>
          </div>
        </div>
        <p className="auth-privacy">
          <ShieldCheck size={16} />
          {t('localOnly')}
        </p>
      </section>
      <section className="auth-form-wrap">
        <label className="auth-language">
          <span className="sr-only">{t('language')}</span>
          <select value={locale} onChange={(e) => setLocale(e.target.value)}>
            {Object.entries(locales).map(([k, v]) => (
              <option value={k} key={k}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <div className="auth-form">
          <span className="auth-sun">
            <Sun size={27} />
          </span>
          <h2>{t(mode === 'login' ? 'greeting' : 'register')}</h2>
          <p>{t(mode === 'login' ? 'overviewHint' : 'createHint')}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              const body = Object.fromEntries(new FormData(e.currentTarget));
              try {
                const result = await request('/api/auth', 'POST', {
                  ...body,
                  mode,
                  locale,
                });
                onUser(result.user);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'serverError');
              } finally {
                setBusy(false);
              }
            }}
          >
            {mode === 'register' && (
              <label>
                {t('name')}
                <input name="name" required maxLength={100} autoComplete="name" />
              </label>
            )}
            <label>
              {t('email')}
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label>
              {t('password')}
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {t(error)}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {t(mode === 'login' ? 'loginAction' : 'registerAction')}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {t(mode === 'login' ? 'needAccount' : 'alreadyAccount')}{' '}
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
            >
              {t(mode === 'login' ? 'register' : 'login')}
            </button>
          </p>
          <button
            type="button"
            className="demo-box"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                const result = await request('/api/auth/demo', 'POST', { locale });
                onUser(result.user);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'serverError');
              } finally {
                setBusy(false);
              }
            }}
          >
            <ShieldCheck size={17} />
            <span>{t('demoLogin')}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}
