import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Providers from '@/components/providers/Providers';
import AppShell from '@/components/layout/AppShell';

// One family across the whole product, as in the reference. Headings are
// separated from body text by size and tracking. Nothing goes above 600 —
// heavier weights read as shouting at these sizes.
const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

// Case numbers, phone numbers, vehicle plates and hashes — anything an officer
// reads character by character.
const jetbrains = JetBrains_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TRINETRA — Criminal Network Intelligence Platform',
  description: 'AI-Powered Criminal Network Intelligence & Investigation Platform',
  // Browser tab icon. The default Next.js favicon.ico in src/app/ still wins
  // on some browsers, so the logo is declared explicitly here.
  icons: {
    icon: [
      { url: '/trinetra-logo.png', type: 'image/png' },
    ],
    shortcut: ['/trinetra-logo.png'],
    apple: ['/trinetra-logo.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
