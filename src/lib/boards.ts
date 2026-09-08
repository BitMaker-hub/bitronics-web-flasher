/**
 * The NerdMiner ships thirty-odd boards across four different chips, which is
 * more than anyone can scan. Rather than keep a hand-written table that goes
 * stale the moment upstream adds a board, the chip and the vendor are read out
 * of the board name, which already carries them. Only the names that do not
 * say their chip out loud need a line here.
 */

export type Chip = 'ESP32' | 'ESP32-S2' | 'ESP32-S3' | 'ESP32-C3';

export const CHIPS: Chip[] = ['ESP32', 'ESP32-S2', 'ESP32-S3', 'ESP32-C3'];

/**
 * Boards whose name does not carry the chip, or carries something that looks
 * like one. "Plus2" ends in s2 without being an ESP32-S2, which is why the
 * matching below is on whole words rather than substrings.
 */
const CHIP_OVERRIDES: Record<string, Chip> = {
  nerdminerv2: 'ESP32-S3', // the original board is a T-Display-S3
  'nerdminerv2-t-qt': 'ESP32-S3',
  'nerdminerv2-t-hmi': 'ESP32-S3',
  'nerdminerv2-t-display_v1': 'ESP32',
  'lilygo-t-embed': 'ESP32-S3',
  'm5-stamps3': 'ESP32-S3',
  'wt32-sc01-plus': 'ESP32-S3',
  'm5stick-c-plus2': 'ESP32',
};

const words = (board: string) => board.toLowerCase().split(/[-_\s.]+/);

export function chipOf(board: string): Chip {
  const key = board.toLowerCase();
  if (CHIP_OVERRIDES[key]) return CHIP_OVERRIDES[key];

  const parts = words(key);
  if (parts.includes('c3')) return 'ESP32-C3';
  if (parts.includes('s3')) return 'ESP32-S3';
  if (parts.includes('s2')) return 'ESP32-S2';
  return 'ESP32';
}

/** What the chip calls itself over serial, so a detected chip maps to a filter. */
export function chipFromEsptool(name: string): Chip | null {
  const n = name.toUpperCase();
  if (n.includes('C3')) return 'ESP32-C3';
  if (n.includes('S3')) return 'ESP32-S3';
  if (n.includes('S2')) return 'ESP32-S2';
  if (n.includes('ESP32')) return 'ESP32';
  return null;
}

const VENDORS: { id: string; label: string; match: (parts: string[], key: string) => boolean }[] = [
  {
    id: 'lilygo',
    label: 'LilyGO',
    match: (parts, key) =>
      parts.includes('lilygo') || parts.includes('ttgo') || key.startsWith('nerdminerv2'),
  },
  { id: 'm5stack', label: 'M5Stack', match: (parts) => parts.some((p) => p.startsWith('m5')) },
  {
    id: 'devkit',
    label: 'Dev kits',
    match: (parts) => parts.some((p) => p.startsWith('devkit') || p.startsWith('esp32cam')),
  },
];

export function vendorOf(board: string): { id: string; label: string } {
  const key = board.toLowerCase();
  const parts = words(key);
  const hit = VENDORS.find((v) => v.match(parts, key));
  return hit ? { id: hit.id, label: hit.label } : { id: 'other', label: 'Other' };
}

/** The photo for a board, when somebody has dropped one in. */
export function pictureFor(board: string) {
  return `/pictures/boards/${board}.png`;
}
