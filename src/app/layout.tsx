import type { Metadata } from 'next';
import { Inter, Space_Grotesk, M_PLUS_1_Code } from 'next/font/google';
import './globals.css';
import { ClientThemeWrapper } from '../components/ClientThemeWrapper';
import { I18nProvider } from '../components/I18nProvider';

const inter = Inter({ subsets: ['latin'] });

// Bitronics uses Space Grotesk for headlines and M PLUS 1 Code for anything
// numeric: firmware versions, hashes, board revisions.
const display = Space_Grotesk({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-display' });
const data = M_PLUS_1_Code({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-data' });

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
      <body className={`${inter.className} ${display.variable} ${data.variable}`}>
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
