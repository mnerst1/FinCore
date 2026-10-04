import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'FinCore',
  description: 'A private, local-first home for your personal finances.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
