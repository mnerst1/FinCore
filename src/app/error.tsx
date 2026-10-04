'use client';
import { translate } from '@/lib/i18n';
export default function ErrorPage({ reset }: { reset: () => void }) {
  const locale =
    typeof window !== 'undefined' ? localStorage.getItem('fincore-locale') || 'en' : 'en';
  return (
    <main className="boot">
      <h1>{translate(locale, 'error')}</h1>
      <p>{translate(locale, 'serverError')}</p>
      <button onClick={reset}>{translate(locale, 'retry')}</button>
    </main>
  );
}
