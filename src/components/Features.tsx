import { Zap, Wifi, Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Features() {
  const { t } = useTranslation();

  return (
    <section id="features" className="features-section w-full py-16 md:py-24">
      <div className="mx-auto w-full max-w-screen-xl px-4 md:px-6">
        <div className="mb-10 text-center">
          <p className="brand-kicker">Why the browser</p>
          <h2 className="font-display mt-1 text-2xl font-bold tracking-tight text-white">
            {t('features.title')}
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title={t('features.fastFlashing.title')}
            description={t('features.fastFlashing.description')}
          />
          <FeatureCard
            icon={<Wifi className="h-6 w-6" />}
            title={t('features.webBased.title')}
            description={t('features.webBased.description')}
          />
          <FeatureCard
            icon={<Cpu className="h-6 w-6" />}
            title={t('features.multipleBoards.title')}
            description={t('features.multipleBoards.description')}
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-bitronics)] text-[var(--color-gold-ink)]">
        {icon}
      </div>
      <h3 className="font-display mt-4 font-bold tracking-tight text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-white/50">{description}</p>
    </div>
  );
}
