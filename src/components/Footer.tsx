import { useState } from 'react';
import { X } from 'lucide-react';

const basePath = '';

// Where each firmware actually comes from. Saying so in the footer is the
// cheapest form of honesty: this site only re-serves other people's builds.
const FIRMWARE_LINKS = [
  { label: 'Bitaxe', href: 'https://github.com/bitaxeorg/ESP-Miner' },
  { label: 'NerdQaxe & Octaxe', href: 'https://github.com/shufps/ESP-Miner-NerdQAxePlus' },
  { label: 'NerdMiner', href: 'https://github.com/BitMaker-hub/NerdMiner_v2' },
  { label: 'Seeder', href: 'https://github.com/BitMaker-hub/Seeder' },
];

const SITE_LINKS = [
  { label: 'Shop', href: 'https://bitronics.store/collections/best-sellers' },
  { label: 'Pool', href: 'https://pool.bitronics.store' },
  { label: 'Wiki', href: 'https://bitronics.store/pages/knowledge-base' },
  { label: 'Blog', href: 'https://bitronics.store/blogs/knowledge-base' },
  { label: 'Contact', href: 'https://bitronics.store/pages/contact-form' },
];

function Notice({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-md rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-6 text-white">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-white/50 transition-colors hover:text-white"
        >
          <X size={20} />
        </button>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm text-white/60">{body}</p>
      </div>
    </div>
  );
}

export default function Footer() {
  const [notice, setNotice] = useState<'privacy' | 'terms' | null>(null);

  const linkClass = 'text-sm text-white/60 transition-colors hover:text-white';

  return (
    <>
      {notice === 'privacy' && (
        <Notice
          title="Privacy"
          body="We collect no data. Your ISP still does."
          onClose={() => setNotice(null)}
        />
      )}
      {notice === 'terms' && (
        <Notice
          title="Terms"
          body="The source code is provided under the GPL-3.0 licence."
          onClose={() => setNotice(null)}
        />
      )}

      <footer className="mt-16 w-full border-t border-[var(--color-hairline)] bg-[var(--color-chrome)] text-white">
        <div className="mx-auto grid w-full max-w-screen-xl gap-10 px-4 py-12 md:grid-cols-3 lg:px-6">
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src={`${basePath}/pictures/bitronics-logo-dark.svg`}
                alt="Bitronics"
                className="h-6 w-auto"
              />
              <span className="brand-badge">Flasher</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
              Open source firmware for open source hardware, flashed straight from the browser.
            </p>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold tracking-tight">Firmware</h3>
            <ul className="mt-4 space-y-2.5">
              {FIRMWARE_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold tracking-tight">Bitronics</h3>
            <ul className="mt-4 space-y-2.5">
              {SITE_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-[var(--color-hairline)]">
          <div className="mx-auto flex w-full max-w-screen-xl flex-col-reverse items-center gap-3 px-4 py-5 text-xs text-white/40 sm:flex-row sm:justify-between lg:px-6">
            <div className="flex items-center gap-4">
              <span>© {new Date().getFullYear()} Bitronics</span>
              <button
                onClick={() => setNotice('terms')}
                className="transition-colors hover:text-white/70"
              >
                Terms
              </button>
              <button
                onClick={() => setNotice('privacy')}
                className="transition-colors hover:text-white/70"
              >
                Privacy
              </button>
            </div>
            <a
              href="https://github.com/WantClue"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white/70"
            >
              Credits to WantClue
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
