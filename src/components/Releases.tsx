import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

const basePath = '';

type Release = {
  tag: string;
  name: string;
  published: string;
  prerelease: boolean;
  url: string;
  summary: string;
};

type Project = {
  name: string;
  repo: string;
  url: string;
  releases: Release[];
};

/**
 * What changed lately in the firmware this site serves. The feed is a static
 * file written by the nightly update job, not a call to GitHub from the
 * visitor's browser: sixty unauthenticated calls an hour per address is not a
 * budget a public page should be spending.
 */
export default function Releases() {
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${basePath}/releases.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((feed) => {
        if (!cancelled && feed?.projects?.length) setProjects(feed.projects);
      })
      .catch(() => {
        // No feed is not an error worth shouting about: the section just stays away.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!projects) return null;

  const when = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <section
      id="releases"
      className="w-full border-t border-[var(--color-hairline)] bg-[var(--color-chrome)] py-16 md:py-24"
    >
      <div className="mx-auto w-full max-w-screen-xl px-4 md:px-6">
        <div className="mb-10">
          <p className="brand-kicker">Stay updated</p>
          <h2 className="font-display mt-1 text-2xl font-bold tracking-tight text-white">
            What changed lately
          </h2>
          <p className="mt-1 text-sm text-white/40">
            The latest release from each project this flasher serves.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {projects.map((project) => {
            // Lead with the newest stable, because that is what this site will
            // actually flash. A newer release candidate gets a footnote rather
            // than the headline, so nobody reads it as the version to install.
            const latest = project.releases.find((r) => !r.prerelease) ?? project.releases[0];
            const testing = project.releases.find(
              (r) => r.prerelease && r.published > latest?.published,
            );
            if (!latest) return null;

            return (
              <a
                key={project.repo}
                href={latest.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-bitronics)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-sm font-bold tracking-tight text-white">
                    {project.name}
                  </h3>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25 transition-colors group-hover:text-[var(--color-bitronics)]" />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-data text-sm text-[var(--color-bitronics)]">
                    {latest.tag}
                  </span>
                  {latest.prerelease && (
                    <span className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/40">
                      Pre-release
                    </span>
                  )}
                </div>

                <p className="font-data mt-1 text-[11px] text-white/30">{when(latest.published)}</p>

                {latest.summary && (
                  <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-white/50">
                    {latest.summary}
                  </p>
                )}

                {testing && (
                  <p className="mt-3 border-t border-[var(--color-hairline)] pt-2.5 text-[11px] text-white/30">
                    <span className="font-data">{testing.tag}</span> is in testing
                  </p>
                )}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
