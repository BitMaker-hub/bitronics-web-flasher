import { ArrowUpRight } from 'lucide-react';

/**
 * The gold band. The pool site uses one to break a long dark page in two, and
 * it is the one place on this site where saying "we also sell these" is useful
 * rather than noise: plenty of people land here holding a board they built, and
 * plenty of others would rather not build one.
 */
export default function ShopStrip() {
  return (
    <a
      href="https://bitronics.store/collections/best-sellers"
      target="_blank"
      rel="noopener noreferrer"
      className="band-gold group flex w-full items-center justify-center gap-2 px-4 py-3 text-center transition-opacity hover:opacity-90"
    >
      <span className="font-data text-[11px] uppercase tracking-wider opacity-70">
        Rather not build one
      </span>
      <span className="text-sm font-semibold">
        We ship these devices assembled, flashed and tested
      </span>
      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}
