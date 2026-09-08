'use client';

import { ThemeProvider } from 'next-themes';

/**
 * Dark, and only dark. The brand is dark surfaces with gold as the one accent,
 * the hero sits on a dark photograph either way, and every band on this page is
 * painted explicitly. A light theme only ever recoloured four controls and left
 * the headline near-black on a near-black picture, so it is forced rather than
 * offered — otherwise anyone whose system is set to light would land in it with
 * no way back out now the toggle is gone.
 */
export function ClientThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="dark">
      {children}
    </ThemeProvider>
  );
}
