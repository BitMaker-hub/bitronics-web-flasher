export type Firmware = { version: string; path: string };
export type Board = { name: string; file: string; supported_firmware: Firmware[] };

export type DeviceCategory = 'miners' | 'tools';

/**
 * Every device is served the same way: a main manifest lists the versions, and
 * each version's manifest lists the boards that version was built for. The only
 * things that change from one device to the next are which boards belong to it,
 * how they are spelled on screen, and how the device is presented. Adding a
 * device is adding a row.
 */
export type DeviceSource = {
  device: string; // name in firmware_data.json
  slug: string; // folder under public/firmware
  category: DeviceCategory;
  /** One line under the name in the picker. Figures belong in mono. */
  tagline?: string;
  /**
   * A wide hero image for this device. Compose it with the subject on the
   * right and quiet space on the left: the headline sits over the left third.
   * Missing files are not an error, the page just falls back to the plain
   * headline, so a banner can be dropped in later without a code change.
   */
  banner?: string;
  /** Where to buy it, when we sell it */
  shop?: string;
  keepsConfiguration?: boolean; // ships a firmware-only image to flash at 0x10000
  /** Boards this device claims out of a shared folder */
  includes?: (board: string) => boolean;
  /** How a board is spelled in the selector */
  label?: Record<string, string>;
  sort?: (a: Board, b: Board) => number;
  /**
   * Ask the chip what it is before offering boards. Worth it where a device has
   * more boards than anyone can scan, and pointless where it has two.
   */
  detectChip?: boolean;
};

export const CATEGORIES: { id: DeviceCategory; title: string; blurb: string }[] = [
  {
    id: 'miners',
    title: 'Miners',
    blurb: 'Solo mining hardware, from lottery odds to multi-terahash.',
  },
  {
    id: 'tools',
    title: 'Tools',
    blurb: 'The rest of the bench: keys, seeds and everything around them.',
  },
];

const SHOP = 'https://bitronics.store/collections';

export const NERDMINER_ORIGINAL = 'NerdMinerV2 original board (T-Display-S3)';

export const DEVICE_SOURCES: DeviceSource[] = [
  {
    device: 'NerdMiner',
    category: 'miners',
    tagline: '78 Kh/s',
    shop: `${SHOP}/nerdminer`,
    keepsConfiguration: true,
    detectChip: true, // thirty-two boards across four different chips
    slug: 'nerdminer',
    label: { NerdminerV2: NERDMINER_ORIGINAL },
    // The original board goes first, the rest alphabetically.
    sort: (a, b) =>
      a.name === NERDMINER_ORIGINAL
        ? -1
        : b.name === NERDMINER_ORIGINAL
          ? 1
          : a.name.localeCompare(b.name),
  },
  {
    device: 'Bitaxe',
    category: 'miners',
    tagline: '500 Gh/s – 1.2 Th/s',
    shop: `${SHOP}/bitaxe`,
    keepsConfiguration: true,
    slug: 'bitaxe',
    label: { Supra401: 'Supra 401', Gamma601: 'Gamma 601' },
  },
  {
    device: 'Nerdaxe',
    category: 'miners',
    tagline: '1.2 – 2.4 Th/s',
    shop: `${SHOP}/nerdaxe`,
    keepsConfiguration: true,
    slug: 'nerdqaxe', // shares its folder with the NerdQaxe, same repository
    includes: (board) => board.startsWith('NerdAxe'),
    label: { NerdAxe: 'Ultra', NerdAxeGamma: 'Gamma' },
  },
  {
    device: 'NerdQaxe',
    category: 'miners',
    tagline: '2.4 – 4.8 Th/s',
    shop: `${SHOP}/nerdqaxe`,
    keepsConfiguration: true,
    slug: 'nerdqaxe',
    includes: (board) => board.startsWith('NerdQAxe'),
    label: { 'NerdQAxe++': '++ (4.8 Th/s)', 'NerdQAxe+': '+ (2.4 Th/s)' },
  },
  {
    device: 'NerdOctaxe',
    category: 'miners',
    tagline: 'Up to 12 Th/s',
    shop: `${SHOP}/nerdoctaxe`,
    keepsConfiguration: true,
    slug: 'nerdoctaxe',
    label: { NerdOctaxeGamma: 'Gamma' },
  },
  {
    device: 'NerdNos',
    category: 'miners',
    tagline: 'Nano miner',
    slug: 'nerdnos',
  },
  {
    device: 'Seeder',
    category: 'tools',
    banner: '/pictures/banners/seeder.png',
    tagline: 'BIP39 seed generator',
    slug: 'seeder',
    label: { TDisplay: 'TTGO T-Display', TDisplayS3: 'LilyGO T-Display-S3' },
  },
];

export const sourceFor = (device: string) => DEVICE_SOURCES.find((s) => s.device === device);
