import { useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';
import { pictureFor } from '@/lib/boards';

/**
 * The photo of a board, wherever one is needed.
 *
 * The drawings are square with the board centred and scaled by area rather than
 * by its longest side, so a T-Dongle and an ESP32-CAM carry the same visual
 * weight in a grid instead of one being a sliver next to the other. That only
 * survives if the frame is square too: in a wide, short box every upright board
 * collapses to a strip.
 *
 * A board with no drawing yet still has to look deliberate rather than broken,
 * so it falls back to its chip on a plain tile.
 */
export default function BoardArt({
  board,
  className,
  fallback,
}: {
  board: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [board]);

  if (failed) {
    if (fallback !== undefined) return <>{fallback}</>;
    // The chip is already printed under the tile, so the box only has to look
    // like a place a drawing is going to arrive, not repeat itself.
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-white/[0.09] bg-white/[0.02] ${className ?? ''}`}
      >
        <Cpu className="h-8 w-8 text-white/[0.13]" strokeWidth={1} />
      </div>
    );
  }

  return (
    <img
      src={pictureFor(board)}
      alt={board}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
      className={`object-contain ${className ?? ''}`}
    />
  );
}
