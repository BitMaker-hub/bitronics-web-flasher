import type { Metadata } from 'next';
import './globals.css';
import { ClientThemeWrapper } from '../components/ClientThemeWrapper';
import { I18nProvider } from '../components/I18nProvider';

// The typefaces are declared as @font-face in globals.css and served out of
// public/fonts. next/font/google fetches them at build time instead, which makes
// every deploy depend on fonts.gstatic.com answering — and one day it did not.

export const metadata: Metadata = {
  title: 'Bitronics flasher',
  description: 'Flash your Bitronics devices directly from the web',
  icons: {
    icon: [
      {
        url: '/pictures/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
    shortcut: '/pictures/favicon.svg',
    apple: '/pictures/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientThemeWrapper>
          <I18nProvider>
            <div className="min-h-screen text-foreground">
              <main className="w-full p-4">{children}</main>
            </div>
          </I18nProvider>
        </ClientThemeWrapper>
      </body>
    </html>
  );
}
