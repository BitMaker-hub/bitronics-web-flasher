import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface InstructionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The steps, in a drawer. It used to be a navy card that slid half off the
 * right edge, because the class meant to hold it open ("translate-x-20px") is
 * not one Tailwind has, so nothing ever cancelled the translate-x-full.
 */
export default function InstructionPanel({ isOpen, onClose }: InstructionPanelProps) {
  const { t } = useTranslation();
  const steps = [1, 2, 3, 4, 5, 6, 7];

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        aria-hidden={!isOpen}
        className={`fixed right-0 top-20 z-50 flex h-[calc(100vh-5rem)] w-[min(22rem,100vw)] flex-col border-l border-[var(--color-hairline)] bg-[var(--color-chrome)] text-white shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between border-b border-[var(--color-hairline)] px-6 py-5">
          <div>
            <p className="brand-kicker">Seven steps</p>
            <h2 className="font-display text-lg font-bold tracking-tight">
              {t('instructions.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ol className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {steps.map((step) => (
            <li key={step} className="flex gap-3">
              <span className="font-data mt-0.5 text-[11px] text-[var(--color-bitronics)]">
                {String(step).padStart(2, '0')}
              </span>
              <span className="text-sm leading-relaxed text-white/70">
                {t(`instructions.steps.${step}`)}
              </span>
            </li>
          ))}
        </ol>

        <p className="border-t border-[var(--color-hairline)] px-6 py-4 text-xs leading-relaxed text-white/40">
          {t('instructions.moreInfo')}{' '}
          <a
            className="text-[var(--color-bitronics)] underline-offset-2 hover:underline"
            href="https://www.osmu.wiki"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('instructions.documentation')}
          </a>
          .
        </p>
      </aside>
    </>
  );
}
