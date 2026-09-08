import { useEffect, useMemo, useState } from 'react';
import { Search, X, Usb, Loader2 } from 'lucide-react';
import { Board, DeviceSource } from '@/lib/devices';
import { Chip, CHIPS, chipOf, vendorOf } from '@/lib/boards';
import BoardArt from './BoardArt';

interface BoardPickerProps {
  isOpen: boolean;
  onClose: () => void;
  source?: DeviceSource;
  boards: Board[];
  selected: string;
  onSelect: (board: string) => void;
  /** Reads the chip off the connected device. Resolves to null if it cannot. */
  onDetect?: () => Promise<Chip | null>;
}

export default function BoardPicker({
  isOpen,
  onClose,
  source,
  boards,
  selected,
  onSelect,
  onDetect,
}: BoardPickerProps) {
  const [chipFilter, setChipFilter] = useState<Chip | null>(null);
  const [query, setQuery] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detectNote, setDetectNote] = useState<string | null>(null);
  // The dialog is always in the tree so it can fade, which means its tiles
  // would fetch three megabytes of board photos before anyone asked to see
  // them. Nothing is built until the first open; after that it stays built so
  // reopening still animates.
  const [everOpened, setEverOpened] = useState(false);
  useEffect(() => {
    if (isOpen) setEverOpened(true);
  }, [isOpen]);

  // A fresh device deserves a fresh filter.
  useEffect(() => {
    setChipFilter(null);
    setQuery('');
    setDetectNote(null);
  }, [source?.device]);

  // Only offer the chips this device actually has boards for.
  const availableChips = useMemo(() => {
    const present = new Set(boards.map((b) => chipOf(b.file)));
    return CHIPS.filter((c) => present.has(c));
  }, [boards]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return boards.filter((board) => {
      if (chipFilter && chipOf(board.file) !== chipFilter) return false;
      if (!needle) return true;
      return (
        board.name.toLowerCase().includes(needle) ||
        board.file.toLowerCase().includes(needle) ||
        vendorOf(board.file).label.toLowerCase().includes(needle)
      );
    });
  }, [boards, chipFilter, query]);

  const detect = async () => {
    if (!onDetect) return;
    setDetecting(true);
    setDetectNote(null);
    try {
      const chip = await onDetect();
      if (chip) {
        setChipFilter(chip);
        setDetectNote(`Found an ${chip}. Showing only boards that use it.`);
      } else {
        setDetectNote('Could not read the chip. The full list is still here.');
      }
    } catch (error) {
      setDetectNote('Could not read the chip. The full list is still here.');
    } finally {
      setDetecting(false);
    }
  };

  const chipButton = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-[var(--color-bitronics)] bg-[var(--color-bitronics)] text-[var(--color-gold-ink)]'
          : 'border-[var(--color-hairline)] text-white/60 hover:border-white/30 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

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
        aria-label="Choose your board"
        className={`fixed inset-0 top-20 z-50 flex justify-center overflow-y-auto px-4 py-6 transition-all duration-300 ease-out ${
          isOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="h-fit w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-chrome)] shadow-2xl">
          <div className="sticky top-0 z-10 border-b border-[var(--color-hairline)] bg-[var(--color-chrome)] px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="brand-kicker">Step 2</p>
                <h2 className="font-display text-xl font-bold tracking-tight text-white">
                  Choose your board
                </h2>
                <p className="mt-0.5 text-sm text-white/40">
                  {boards.length} {boards.length === 1 ? 'board' : 'boards'} for the{' '}
                  {source?.device}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(availableChips.length > 1 || onDetect) && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {onDetect && (
                  <button
                    onClick={detect}
                    disabled={detecting}
                    className="flex items-center gap-1.5 rounded-full bg-[var(--color-bitronics)] px-3 py-1 text-xs font-semibold text-[var(--color-gold-ink)] transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {detecting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Usb className="h-3.5 w-3.5" />
                    )}
                    {detecting ? 'Reading the chip…' : 'Detect my board'}
                  </button>
                )}

                {availableChips.length > 1 && (
                  <>
                    {chipButton('All', chipFilter === null, () => setChipFilter(null))}
                    {availableChips.map((chip) =>
                      chipButton(chip, chipFilter === chip, () => setChipFilter(chip)),
                    )}
                  </>
                )}

                {boards.length > 8 && (
                  <div className="relative ml-auto">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search boards"
                      className="w-44 rounded-full border border-[var(--color-hairline)] bg-black/30 py-1 pl-8 pr-3 text-xs text-white placeholder:text-white/30 focus:border-[var(--color-bitronics)] focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {detectNote && <p className="font-data mt-3 text-[11px] text-white/50">{detectNote}</p>}
          </div>

          <div className="px-6 py-6">
            {!everOpened ? null : visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-white/40">
                No board matches that. Try clearing the filters.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visible.map((board) => {
                  const isSelected = board.name === selected;
                  return (
                    <button
                      key={board.name}
                      onClick={() => onSelect(board.name)}
                      className={`group flex flex-col rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 ${
                        isSelected
                          ? 'border-[var(--color-bitronics)] bg-[var(--color-chrome-light)]'
                          : 'border-[var(--color-hairline)] bg-[var(--color-surface)] hover:border-white/25'
                      }`}
                    >
                      <BoardArt board={board.file} className="aspect-[5/4] w-full" />
                      <span className="mt-3 text-sm font-medium leading-tight text-white">
                        {board.name}
                      </span>
                      <span className="font-data mt-1.5 text-[10px] uppercase tracking-wide text-white/35">
                        {chipOf(board.file)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
