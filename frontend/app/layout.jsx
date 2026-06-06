import './globals.scss';
import { AppShell } from '@/components/AppShell/AppShell';

export const metadata = {
  title: 'MyTrade — Stock Intelligence',
  description: 'Personal hedge-fund-style stock analysis dashboard',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
  manifest: '/manifest.webmanifest',
};

export const viewport = {
  themeColor: '#3D7EFF',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
