import { ArrowUpRight } from 'lucide-react';
import { DeviceIntro as Intro } from '@/lib/devices';

const basePath = '';

/**
 * A device that needs explaining gets to explain itself before anyone reaches
 * the Flash button. It sits on the light band, because a wall of text on the
 * dark photograph is where reading goes to die.
 */
export default function DeviceIntro({
  intro,
  picture,
  device,
  shop,
}: {
  intro: Intro;
  picture?: string;
  device: string;
  shop?: string;
}) {
  const words = intro.headline.trim().split(' ');
  const accent = words.pop();

  return (
    <section className="band-light w-full py-14 md:py-20">
      <div className="mx-auto w-full max-w-screen-xl px-4 md:px-6">
        <div className="grid items-center gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          {picture && (
            <div className="flex justify-center">
              <img
                src={`${basePath}/${picture}`}
                alt={device}
                className="w-full max-w-[320px] object-contain drop-shadow-xl"
              />
            </div>
          )}

          <div>
            <p className="brand-kicker">{intro.kicker}</p>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-[var(--color-ink)] md:text-4xl">
              {words.join(' ')} <span className="text-[var(--color-gold-deep)]">{accent}</span>
            </h2>
            <p className="mt-4 max-w-prose leading-relaxed text-[var(--color-ink)]/70">
              {intro.body}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {shop && (
                <a
                  href={shop}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-bitronics)] px-4 py-2 text-sm font-semibold text-[var(--color-gold-ink)] transition-opacity hover:opacity-90"
                >
                  Buy one ready to use
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
              {intro.cta && (
                <a
                  href={intro.cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-ink)]/15 px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]/40"
                >
                  {intro.cta.label}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
            </div>

            {intro.cta?.note && (
              <p className="mt-3 max-w-prose text-xs leading-relaxed text-[var(--color-ink)]/45">
                {intro.cta.note}
              </p>
            )}
          </div>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {intro.points.map((point, index) => (
            <div
              key={point.title}
              className="rounded-xl border border-[var(--color-hairline-light)] bg-white p-5"
            >
              <span className="font-data text-[11px] text-[var(--color-gold-deep)]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="font-display mt-1.5 text-sm font-bold tracking-tight text-[var(--color-ink)]">
                {point.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-ink)]/60">
                {point.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
