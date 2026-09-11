#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
// Upstream ships versions with four parts (v1.0.34.1) and semver cannot parse
// them. Coercing them down to three made every x.y.z.N release look identical
// to x.y.z, so the updater decided it was already up to date and skipped it.
// Compare the numeric parts one by one instead, however many there are.
// GitHub Pages refuses to publish a site larger than 1 GB and every release of
// every device adds tens of megabytes. The manifest used to be trimmed to ten
// versions while the folders were kept forever, so the published site grew to
// 1.4 GB and deployments quietly stopped landing. Keeping the last few versions
// of each device holds the site at a stable size.
const VERSIONS_KEPT = 4;

// The NerdMiner ships 32 boards in every release, so a single version of it
// weighs as much as three of anything else. It keeps one fewer.
const VERSIONS_KEPT_BY_DEVICE = { nerdminer: 3 };

function compareVersions(a, b) {
  const parts = (v) => String(v).replace(/^v/, '').split('-')[0].split('.');
  const [left, right] = [parts(a), parts(b)];

  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const one = Number(left[i]) || 0;
    const other = Number(right[i]) || 0;
    if (one !== other) return one < other ? -1 : 1;
  }
  return 0;
}

// Configuration for firmware repositories
const FIRMWARE_REPOS = {
  nerdqaxe: {
    owner: 'shufps',
    repo: 'ESP-Miner-NerdQAxePlus',
    firmwarePath: 'public/firmware/nerdqaxe',
    devices: [
      {
        name: 'NerdQAxe++',
        factoryPattern: 'esp-miner-factory-NerdQAxe++',
        firmwarePattern: 'esp-miner-NerdQAxe++',
        fileName: 'NerdQAxe++'
      },
      {
        name: 'NerdQAxe+',
        factoryPattern: 'esp-miner-factory-NerdQAxe+-v',
        firmwarePattern: 'esp-miner-NerdQAxe+.bin',
        fileName: 'NerdQAxe+'
      },
      {
        name: 'NerdAxe',
        factoryPattern: 'esp-miner-factory-NerdAxe',
        firmwarePattern: 'esp-miner-NerdAxe',
        fileName: 'NerdAxe'
      },
      {
        name: 'NerdAxeGamma',
        factoryPattern: 'esp-miner-factory-NerdAxeGamma',
        firmwarePattern: 'esp-miner-NerdAxeGamma',
        fileName: 'NerdAxeGamma'
      }
    ]
  },
  bitaxe: {
    owner: 'bitaxeorg',
    repo: 'ESP-Miner',
    firmwarePath: 'public/firmware/bitaxe',
    devices: [
      {
        name: 'Supra401',
        factoryPattern: 'esp-miner-factory-401-v',
        firmwarePattern: 'esp-miner.bin',
        fileName: 'Supra401'
      },
      {
        name: 'Gamma601',
        factoryPattern: 'esp-miner-factory-601-v',
        firmwarePattern: 'esp-miner.bin',
        fileName: 'Gamma601'
      }
    ]
  },
  nerdoctaxe: {
    owner: 'shufps',
    repo: 'ESP-Miner-NerdQAxePlus',
    firmwarePath: 'public/firmware/nerdoctaxe',
    devices: [
      {
        name: 'NerdOctaxeGamma',
        factoryPattern: 'esp-miner-factory-NerdOCTAXE-Gamma',
        firmwarePattern: 'esp-miner-NerdOCTAXE-Gamma',
        fileName: 'NerdOctaxeGamma'
      }
    ]
  },
  seeder: {
    owner: 'BitMaker-hub',
    repo: 'Seeder',
    firmwarePath: 'public/firmware/seeder',
    // Write down which release asset each image is, so the page can check the
    // hash against the one GitHub records for it and say "Verified" — not
    // only against the hash this script computed. Without it the page can
    // only ever say "Checksum matches". The Seeder is the one device where
    // verified is a promise; the NerdMiner stays out on purpose.
    crossCheck: true,
    devices: [
      {
        name: 'TDisplay',
        factoryPattern: 'seeder-tdisplay-merged.bin',
        fileName: 'TDisplay'
      },
      {
        name: 'TDisplayS3',
        factoryPattern: 'seeder-tdisplay-s3-merged.bin',
        fileName: 'TDisplayS3'
      }
    ]
  },
  nerdminer: {
    owner: 'BitMaker-hub',
    repo: 'NerdMiner_v2',
    firmwarePath: 'public/firmware/nerdminer',
    // Their tags read nerdminer-release-V1.8.3; the flasher stores v1.8.3.
    version: (tag) => 'v' + tag.replace(/^nerdminer-release-v?/i, ''),
    // Thirty-two boards and counting: take whatever the release ships instead
    // of listing them one by one and going stale the moment a board is added.
    devicesFromAssets: true
  }
};

// The changelog shown on the site. Collected here, on the daily run, rather
// than from every visitor's browser: GitHub allows sixty unauthenticated calls
// an hour per address, and the page should not go blank because somebody else
// on the same network used them up.
// `devices` is what each repository actually feeds on this site, which is not
// always one to one: one NerdQaxe repository covers three of our devices.
const FOLLOWED_PROJECTS = [
  { owner: 'bitaxeorg', repo: 'ESP-Miner', devices: ['Bitaxe'] },
  {
    owner: 'shufps',
    repo: 'ESP-Miner-NerdQAxePlus',
    devices: ['Nerdaxe', 'NerdQaxe', 'NerdOctaxe'],
  },
  { owner: 'BitMaker-hub', repo: 'NerdMiner_v2', devices: ['NerdMiner'] },
  { owner: 'BitMaker-hub', repo: 'Seeder', devices: ['Seeder'] },
];

class FirmwareUpdater {
  constructor() {
    this.hasChanges = false;
  }

  async getLatestRelease(owner, repo) {
    try {
      console.log(`🔍 Checking latest release for ${owner}/${repo}...`);
      
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
      const release = response.data;
      
      console.log(`📦 Latest release: ${release.tag_name} (${release.name})`);
      return release;
    } catch (error) {
      console.error(`❌ Error fetching release for ${owner}/${repo}:`, error.message);
      return null;
    }
  }

  async downloadAsset(assetUrl, outputPath) {
    try {
      console.log(`⬇️  Downloading ${assetUrl}...`);
      
      const response = await axios.get(assetUrl, {
        responseType: 'arraybuffer',
        timeout: 30000 // 30 seconds timeout
      });

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, response.data);
      
      console.log(`✅ Downloaded to ${outputPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Error downloading asset:`, error.message);
      return false;
    }
  }

  async getCurrentVersion(firmwarePath) {
    try {
      const versionsDir = await fs.readdir(firmwarePath);
      const versionDirs = versionsDir
        .filter(dir => dir.startsWith('v') && dir.match(/^v\d+\.\d+\.\d+/))
        .filter(dir => {
          // Filter out -rc and -beta versions from being considered current
          return !dir.includes('-rc') && !dir.includes('-beta') && !dir.includes('-test');
        })
        .sort((a, b) => compareVersions(b, a)); // newest first

      return versionDirs[0] || null;
    } catch (error) {
      console.log(`📁 No existing versions found in ${firmwarePath}`);
      return null;
    }
  }

  async createManifest(versionPath, version, boards = ['NerdQAxe'], upstream) {
    const manifestPath = path.join(versionPath, 'manifest.json');

    // Record what each factory image hashes to. It costs nothing here and it
    // lets anyone check that the file this site serves is the one the upstream
    // CI published, which matters most for a device that generates seeds.
    const sha256 = {};
    for (const board of boards) {
      try {
        const image = await fs.readFile(path.join(versionPath, `${board}_factory.bin`));
        sha256[board] = crypto.createHash('sha256').update(image).digest('hex');
      } catch (error) {
        console.log(`⚠️  Could not hash the factory image for ${board}`);
      }
    }

    const manifest = { version: version, boards: boards, sha256: sha256 };
    if (upstream) manifest.upstream = upstream;

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`📝 Created manifest at ${manifestPath}`);
  }

  async updateMainManifest(firmwarePath, newVersion, devices, repoConfig) {
    try {
      const mainManifestPath = path.join(firmwarePath, 'manifest.json');
      let mainManifest;
      
      // Read existing manifest or create new one
      try {
        const data = await fs.readFile(mainManifestPath, 'utf8');
        mainManifest = JSON.parse(data);
      } catch (error) {
        // Create new manifest based on repository and firmware path
        const repoName = `${repoConfig.owner}/${repoConfig.repo}`;
        let seriesName = "Unknown Series";

        if (firmwarePath.includes('seeder')) {
          seriesName = 'Seeder Series';
        } else if (firmwarePath.includes('nerdminer')) {
          seriesName = 'Nerdminer Series';
        } else if (firmwarePath.includes('nerdoctaxe')) {
          seriesName = "NerdOctaxe Series";
        } else if (repoName === "shufps/ESP-Miner-NerdQAxePlus") {
          seriesName = "NerdQAxe Series";
        } else if (repoName === "bitaxeorg/ESP-Miner") {
          seriesName = "Bitaxe Series";
        }

        mainManifest = {
          name: seriesName,
          repository: repoName,
          versions: [],
          devices: [],
          lastUpdated: null
        };
      }
      
      // Add new version if it doesn't exist
      if (!mainManifest.versions.includes(newVersion)) {
        mainManifest.versions.unshift(newVersion); // Add at beginning (newest first)
        mainManifest.versions = mainManifest.versions.slice(0, VERSIONS_KEPT);
      }
      
      // Update devices list (merge and deduplicate)
      const allDevices = [...new Set([...mainManifest.devices, ...devices])];
      mainManifest.devices = allDevices;
      
      // Update timestamp
      mainManifest.lastUpdated = new Date().toISOString();
      
      // Write updated manifest
      await fs.writeFile(mainManifestPath, JSON.stringify(mainManifest, null, 2));
      console.log(`📝 Updated main manifest at ${mainManifestPath}`);
      
    } catch (error) {
      console.error(`❌ Error updating main manifest:`, error.message);
    }
  }

  async updateFirmwareData(deviceName, version, boardName = null) {
    try {
      const firmwareDataPath = 'src/components/firmware_data.json';
      let firmwareData;
      
      try {
        const data = await fs.readFile(firmwareDataPath, 'utf8');
        firmwareData = JSON.parse(data);
      } catch (error) {
        // Create new firmware data structure if file doesn't exist
        firmwareData = { devices: [] };
      }

      // Find existing device entry
      let device = firmwareData.devices.find(d => d.name === deviceName);
      if (!device) {
        console.log(`⚠️  Device ${deviceName} not found in firmware_data.json`);
        return;
      }

      // Find the specific board or use first board
      let targetBoard;
      if (boardName) {
        targetBoard = device.boards.find(b => b.name === boardName);
        if (!targetBoard) {
          console.log(`⚠️  Board ${boardName} not found for device ${deviceName}`);
          return;
        }
      } else {
        targetBoard = device.boards[0];
      }

      // Check if version already exists
      const existingFirmware = targetBoard.supported_firmware.find(f => f.version === version);
      
      if (!existingFirmware) {
        targetBoard.supported_firmware.unshift({
          version: version,
          path: `firmware/${deviceName.toLowerCase()}/${version}/${deviceName}_factory.bin`
        });
        
        // Keep only last 5 versions
        targetBoard.supported_firmware = targetBoard.supported_firmware.slice(0, 5);
        
        await fs.writeFile(firmwareDataPath, JSON.stringify(firmwareData, null, 2));
        console.log(`📝 Updated firmware data for ${deviceName} - ${targetBoard.name}`);
        this.hasChanges = true;
      } else {
        console.log(`ℹ️  Version ${version} already exists for ${deviceName} - ${targetBoard.name}`);
      }
    } catch (error) {
      console.error(`❌ Error updating firmware data:`, error.message);
    }
  }

  // Delete every version folder the manifest no longer advertises. This also
  // sweeps up folders left behind by hand, which is where most of the weight was.
  async pruneOldVersions(firmwarePath) {
    const manifestPath = path.join(firmwarePath, 'manifest.json');
    let manifest;

    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    } catch (error) {
      return; // a folder without a manifest is maintained by hand
    }

    const limit = VERSIONS_KEPT_BY_DEVICE[path.basename(firmwarePath)] || VERSIONS_KEPT;
    const kept = (manifest.versions || []).slice(0, limit);
    if (kept.length === 0) return; // never empty a folder on a broken manifest

    if (kept.length !== (manifest.versions || []).length) {
      manifest.versions = kept;
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`✂️  Trimmed ${firmwarePath} manifest to ${kept.length} versions`);
      this.hasChanges = true;
    }

    for (const entry of await fs.readdir(firmwarePath, { withFileTypes: true })) {
      if (!entry.isDirectory() || kept.includes(entry.name)) continue;

      await fs.rm(path.join(firmwarePath, entry.name), { recursive: true, force: true });
      console.log(`🧹 Removed ${entry.name} from ${firmwarePath}`);
      this.hasChanges = true;
    }
  }

  async processRepo(repoKey, config) {
    console.log(`\n🚀 Processing repository ${config.owner}/${config.repo}...`);
    
    const release = await this.getLatestRelease(config.owner, config.repo);
    if (!release) return;

    const newVersion = config.version ? config.version(release.tag_name) : release.tag_name;

    // A release that publishes <board>_factory.bin already names its own boards.
    const devices = config.devicesFromAssets
      ? release.assets
          .filter((asset) => asset.name.endsWith('_factory.bin'))
          .map((asset) => {
            const name = asset.name.replace(/_factory.bin$/, '');
            return {
              name,
              factoryPattern: `${name}_factory.bin`,
              firmwarePattern: `${name}_firmware.bin`,
              fileName: name
            };
          })
      : config.devices;
    const currentVersion = await this.getCurrentVersion(config.firmwarePath);
    
    console.log(`📊 Current version: ${currentVersion || 'none'}`);
    console.log(`📊 Latest version: ${newVersion}`);

    // Check if we need to update
    if (currentVersion && compareVersions(currentVersion, newVersion) >= 0) {
      console.log(`✅ Already up to date for repository (${currentVersion} >= ${newVersion})`);
      return;
    }

    // Create version directory
    const versionDir = path.join(config.firmwarePath, newVersion);
    let downloadedDevices = [];
    const assetNames = {};

    // Process each device in the configuration
    for (const device of devices) {
      console.log(`\n📦 Processing device: ${device.name}`);
      
      // Find factory asset
      const factoryAsset = release.assets.find(asset => 
        asset.name.includes(device.factoryPattern)
      );
      
      // Find the firmware-only asset, for devices that publish one
      const firmwareAsset = device.firmwarePattern
        ? release.assets.find(
            (asset) =>
              asset.name.includes(device.firmwarePattern) && !asset.name.includes('factory')
          )
        : null;

      if (!factoryAsset) {
        console.log(`⚠️  No factory asset found for ${device.name} with pattern: ${device.factoryPattern}`);
        continue;
      }

      // A board with no firmware-only build still deserves its factory image;
      // dropping it here is what used to make a board vanish from a version.
      if (!firmwareAsset && device.firmwarePattern) {
        console.log(`⚠️  No firmware-only asset for ${device.name}, shipping just the factory image`);
      }

      // Download factory
      const factoryPath = path.join(versionDir, `${device.fileName}_factory.bin`);
      const factorySuccess = await this.downloadAsset(factoryAsset.browser_download_url, factoryPath);
      
      if (!factorySuccess) {
        console.log(`❌ Failed to download factory for ${device.name}`);
        continue;
      }

      // Download the firmware-only build when the release has one
      if (firmwareAsset) {
        const firmwarePath = path.join(versionDir, `${device.fileName}_firmware.bin`);
        const firmwareSuccess = await this.downloadAsset(firmwareAsset.browser_download_url, firmwarePath);

        if (!firmwareSuccess) {
          console.log(`❌ Failed to download firmware for ${device.name}`);
          continue;
        }
      }

      downloadedDevices.push(device.name);
      assetNames[device.name] = factoryAsset.name;
      console.log(`✅ Successfully downloaded ${device.name} factory and firmware`);
    }

    if (downloadedDevices.length > 0) {
      const upstream = config.crossCheck
        ? { repo: `${config.owner}/${config.repo}`, tag: release.tag_name, assets: assetNames }
        : undefined;

      // Create manifest with all successfully downloaded devices
      await this.createManifest(versionDir, newVersion, downloadedDevices, upstream);
      
      // Update main repository manifest
      await this.updateMainManifest(config.firmwarePath, newVersion, downloadedDevices, config);
      
      console.log(`🎉 Successfully updated repository to ${newVersion} with ${downloadedDevices.length} devices`);
      this.hasChanges = true;
    } else {
      console.log(`❌ No devices were successfully downloaded for ${newVersion}`);
    }
  }

  // A release note trimmed to something that fits a card. The full text is one
  // click away, so this only has to say enough to decide whether to go and read it.
  summarise(body) {
    if (!body) return '';

    // Headings, list bullets and quote marks carry no meaning once the text is
    // one line, and "What's Changed" is the same sentence on every release.
    const noise = /^(what'?s changed|full changelog|new contributors)\b/i;

    return body
      .replace(/\r/g, '')
      .replace(/\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gi, '')
      .split('\n')
      .map((line) => line.replace(/^[#>*\-\s]+/, '').trim())
      .filter(
        (line) =>
          line.length > 0 && line[0] !== '!' && !line.startsWith('```') && !noise.test(line)
      )
      .slice(0, 3)
      .join(' · ')
      .slice(0, 240);
  }

  async writeReleaseFeed() {
    console.log('\n📰 Collecting release notes...');
    const projects = [];

    for (const project of FOLLOWED_PROJECTS) {
      try {
        const { data } = await axios.get(
          `https://api.github.com/repos/${project.owner}/${project.repo}/releases?per_page=5`
        );

        const releases = data
          .filter((release) => !release.draft)
          .slice(0, 2)
          .map((release) => ({
            tag: release.tag_name,
            name: release.name || release.tag_name,
            published: release.published_at,
            prerelease: release.prerelease,
            url: release.html_url,
            summary: this.summarise(release.body),
          }));

        projects.push({
          repo: `${project.owner}/${project.repo}`,
          devices: project.devices,
          url: `https://github.com/${project.owner}/${project.repo}/releases`,
          releases,
        });
        console.log(`   ${project.owner}/${project.repo}: ${releases.length} release(s)`);
      } catch (error) {
        console.log(`⚠️  Could not read releases for ${project.repo}: ${error.message}`);
      }
    }

    // Never replace a good feed with an empty one because GitHub had a bad minute.
    if (projects.length === 0) return;

    const feedPath = 'public/releases.json';
    let previous = null;
    try {
      previous = JSON.parse(await fs.readFile(feedPath, 'utf8'));
    } catch (error) {
      // there is no feed yet
    }

    // The timestamp moving on its own is not a change worth committing.
    if (previous && JSON.stringify(previous.projects) === JSON.stringify(projects)) return;

    await fs.writeFile(
      feedPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), projects }, null, 2)
    );
    console.log('📝 Updated public/releases.json');
    this.hasChanges = true;
  }

  async run() {
    console.log('🤖 Starting firmware update check...');
    
    for (const [repoKey, config] of Object.entries(FIRMWARE_REPOS)) {
      await this.processRepo(repoKey, config);
    }

    // Prune every device, including the ones nobody automates, so a folder
    // filled in by hand cannot push the site back over the limit.
    console.log(`\n🧹 Keeping the last ${VERSIONS_KEPT} versions of each device...`);
    const root = 'public/firmware';
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      if (entry.isDirectory()) await this.pruneOldVersions(path.join(root, entry.name));
    }

    await this.writeReleaseFeed();

    console.log(`\n✨ Update check completed. Changes: ${this.hasChanges ? 'Yes' : 'No'}`);
  }
}

// Run the updater
const updater = new FirmwareUpdater();
updater.run().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});