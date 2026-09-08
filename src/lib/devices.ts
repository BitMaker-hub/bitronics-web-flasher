/** Where an upstream release published this exact file, when we know. */
export type Upstream = { repo: string; tag: string; asset: string };

export type Firmware = {
  version: string;
  path: string;
  /** What the file should hash to, recorded when it was fetched. */
  sha256?: string;
  upstream?: Upstream;
};
export type Board = { name: string; file: string; supported_firmware: Firmware[] };

export type DeviceCategory = 'miners' | 'tools';

/**
 * What a device says for itself. Swapping the background was never enough:
 * somebody arriving at a seed generator deserves to be told what it is before
 * being handed a Flash button.
 */
export type DeviceIntro = {
  kicker: string;
  /** The last word is set in gold, so end on the word that matters. */
  headline: string;
  body: string;
  points: { title: string; body: string }[];
  cta?: { label: string; href: string; note?: string };
};

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
  intro?: DeviceIntro;
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
    // Every claim here is one the project documents in SECURITY.md. Nothing
    // about a seed generator should be sold harder than it can be proven.
    intro: {
      kicker: 'Offline seed generator',
      headline: 'The randomness is yours',
      body: 'The SEEDER has no random number generator. You bring the entropy with a coin or a die and the device does the BIP39 arithmetic in front of you. A generator that makes its own randomness asks you to trust its silicon, its firmware, and whoever sold it to you.',
      points: [
        {
          title: 'You roll it, it only counts',
          body: 'A coin gives 128 tosses for twelve words, and the bits are the entropy, raw and unhashed. A die gives 50 rolls, hashed with SHA-256 over the ASCII digits. The Entropy (hex) screen shows the exact bytes, so you can redo the whole thing with any offline BIP39 tool and check it agrees.',
        },
        {
          title: 'The seed never reaches the flash',
          body: 'It lives in RAM and is gone the moment you unplug it. The firmware prints nothing over serial. Nothing to extract later, because nothing was kept.',
        },
        {
          title: 'Check what you actually flashed',
          body: 'The flash is deliberately left unencrypted so that esptool verify_flash --no-stub still works: with the stub disabled it is the chip ROM that answers, so a tampered firmware cannot lie about what is on it. That command, and the hashes to compare, are in the project README.',
        },
        {
          title: 'Or start from one that is already signed',
          body: 'Units sold pre-flashed by Bitronics run Secure Boot v2: only firmware signed with our key boots. That proves the firmware is the one we signed, not that it is good — the checks above are what prove that. A unit you build yourself stays completely open, with no lock of any kind.',
        },
      ],
      cta: {
        label: 'Read the security model',
        href: 'https://github.com/BitMaker-hub/Seeder/blob/master/SECURITY.md',
        note: 'It is written so you can distrust the device with some criteria, which is the only healthy way to use one.',
      },
    },
    tagline: 'BIP39 seed generator',
    slug: 'seeder',
    label: { TDisplay: 'TTGO T-Display', TDisplayS3: 'LilyGO T-Display-S3' },
  },
];

export const sourceFor = (device: string) => DEVICE_SOURCES.find((s) => s.device === device);
