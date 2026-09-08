import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import device_data from './firmware_data.json';
import { CATEGORIES, DEVICE_SOURCES } from '@/lib/devices';

const basePath = '';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectDevice: (name: string) => any;
}

export default function DeviceModal({ isOpen, onClose, selectDevice }: DeviceModalProps) {
  const { t } = useTranslation();

  // The picker follows the device table, so a device added there shows up here
  // in its section without anyone remembering to come and edit this file.
  const sections = CATEGORIES.map((category) => ({
    ...category,
    devices: DEVICE_SOURCES.filter((source) => source.category === category.id)
      .map((source) => ({
        source,
        picture: device_data.devices.find((d) => d.name === source.device)?.picture,
      }))
      .filter((entry) => entry.picture),
  })).filter((section) => section.devices.length > 0);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('devicesModal.title')}
        className={`fixed inset-0 top-20 z-50 flex justify-center overflow-y-auto px-4 py-6 transition-all duration-300 ease-out ${
          isOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="h-fit w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-chrome)] shadow-2xl">
          <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--color-hairline)] bg-[var(--color-chrome)] px-6 py-5">
            <div>
              <p className="brand-kicker">Step 1</p>
              <h2 className="font-display text-xl font-bold tracking-tight text-white">
                {t('devicesModal.title')}
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

          <div className="space-y-8 px-6 py-6">
            {sections.map((section) => (
              <section key={section.id}>
                <div className="mb-4">
                  <h3 className="font-display text-base font-bold tracking-tight text-white">
                    {section.title}
                  </h3>
                  <p className="mt-0.5 text-sm text-white/40">{section.blurb}</p>
                </div>

                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                  {section.devices.map(({ source, picture }) => (
                    <button
                      key={source.device}
                      onClick={() => selectDevice(source.device)}
                      className="group flex flex-col items-center rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-bitronics)] hover:bg-[var(--color-chrome-light)]"
                    >
                      <img
                        src={`${basePath}/${picture}`}
                        alt={source.device}
                        className="h-14 w-14 object-contain transition-transform duration-200 group-hover:scale-105"
                      />
                      <span className="mt-2 font-display text-[13px] font-semibold leading-tight text-white">
                        {source.device}
                      </span>
                      {source.tagline && (
                        <span className="font-data mt-0.5 text-[10px] leading-tight text-white/40 group-hover:text-[var(--color-bitronics)]">
                          {source.tagline}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
