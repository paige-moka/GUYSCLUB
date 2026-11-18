import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'The Member Lounge | GUYS&CO', template: '%s | GUYS&CO Member Lounge' },
  description: 'The private GUYS&CO Member Lounge.',
  robots: { index: false, follow: false },
  icons: { icon: [{ url: '/assets/img/favicon.svg', type: 'image/svg+xml' }, { url: '/assets/img/favicon-32.png', sizes: '32x32' }], apple: '/assets/img/apple-touch-icon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en-CA"><body>{children}</body></html>);
}
