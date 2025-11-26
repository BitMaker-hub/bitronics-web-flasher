#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const semver = require('semver');

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
  }
  // Add more repos here as needed
  // nerdminer: {
  //   owner: 'BitMaker-hub',
  //   repo: 'NerdMiner_v2',
  //   assetPattern: 'NerdminerV2_factory.bin',
  //   firmwarePath: 'public/firmware/nerdminer',
  //   deviceName: 'Nerdminer'
  // }
};

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
        .sort((a, b) => {
          try {
            // Clean version strings for semver (remove 'v' prefix)
            const cleanA = a.replace('v', '');
            const cleanB = b.replace('v', '');
            return semver.rcompare(cleanA, cleanB);
          } catch {
            // If semver fails, fallback to string comparison
            return b.localeCompare(a);
          }
        });

      return versionDirs[0] || null;
    } catch (error) {
      console.log(`📁 No existing versions found in ${firmwarePath}`);
      return null;
    }
  }

  async createManifest(versionPath, version, boards = ['NerdQAxe']) {
    const manifestPath = path.join(versionPath, 'manifest.json');
    const manifest = {
      version: version,
      boards: boards
    };
    
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

        if (firmwarePath.includes('nerdoctaxe')) {
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
        mainManifest.versions = mainManifest.versions.slice(0, 10); // Keep only last 10 versions
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

  async processRepo(repoKey, config) {
    console.log(`\n🚀 Processing repository ${config.owner}/${config.repo}...`);
    
    const release = await this.getLatestRelease(config.owner, config.repo);
    if (!release) return;

    const newVersion = release.tag_name;
    const currentVersion = await this.getCurrentVersion(config.firmwarePath);
    
    console.log(`📊 Current version: ${currentVersion || 'none'}`);
    console.log(`📊 Latest version: ${newVersion}`);

    // Check if we need to update
    try {
      if (currentVersion) {
        const cleanCurrent = currentVersion.replace('v', '');
        const cleanNew = newVersion.replace('v', '');

        // Use semver.coerce to handle versions with 4 parts (e.g., 1.0.34.1)
        const coercedCurrent = semver.coerce(cleanCurrent);
        const coercedNew = semver.coerce(cleanNew);

        if (coercedCurrent && coercedNew && semver.gte(coercedCurrent, coercedNew)) {
          console.log(`✅ Already up to date for repository (${currentVersion} >= ${newVersion})`);
          return;
        }

        // If versions are equal after coercion but original strings differ, check exact match
        if (currentVersion === newVersion) {
          console.log(`✅ Already at exact version ${newVersion}`);
          return;
        }
      }
    } catch (error) {
      // If semver comparison fails, proceed with download (version format might be different)
      console.log(`⚠️  Version format comparison failed, proceeding with download...`);
      console.log(`   Error: ${error.message}`);
    }

    // Create version directory
    const versionDir = path.join(config.firmwarePath, newVersion);
    let downloadedDevices = [];

    // Process each device in the configuration
    for (const device of config.devices) {
      console.log(`\n📦 Processing device: ${device.name}`);
      
      // Find factory asset
      const factoryAsset = release.assets.find(asset => 
        asset.name.includes(device.factoryPattern)
      );
      
      // Find firmware asset  
      const firmwareAsset = release.assets.find(asset => 
        asset.name.includes(device.firmwarePattern) && 
        !asset.name.includes('factory')
      );

      if (!factoryAsset) {
        console.log(`⚠️  No factory asset found for ${device.name} with pattern: ${device.factoryPattern}`);
        continue;
      }

      if (!firmwareAsset) {
        console.log(`⚠️  No firmware asset found for ${device.name} with pattern: ${device.firmwarePattern}`);
        continue;
      }

      // Download factory
      const factoryPath = path.join(versionDir, `${device.fileName}_factory.bin`);
      const factorySuccess = await this.downloadAsset(factoryAsset.browser_download_url, factoryPath);
      
      if (!factorySuccess) {
        console.log(`❌ Failed to download factory for ${device.name}`);
        continue;
      }

      // Download firmware
      const firmwarePath = path.join(versionDir, `${device.fileName}_firmware.bin`);
      const firmwareSuccess = await this.downloadAsset(firmwareAsset.browser_download_url, firmwarePath);
      
      if (!firmwareSuccess) {
        console.log(`❌ Failed to download firmware for ${device.name}`);
        continue;
      }

      downloadedDevices.push(device.name);
      console.log(`✅ Successfully downloaded ${device.name} factory and firmware`);
    }

    if (downloadedDevices.length > 0) {
      // Create manifest with all successfully downloaded devices
      await this.createManifest(versionDir, newVersion, downloadedDevices);
      
      // Update main repository manifest
      await this.updateMainManifest(config.firmwarePath, newVersion, downloadedDevices, config);
      
      console.log(`🎉 Successfully updated repository to ${newVersion} with ${downloadedDevices.length} devices`);
      this.hasChanges = true;
    } else {
      console.log(`❌ No devices were successfully downloaded for ${newVersion}`);
    }
  }

  async run() {
    console.log('🤖 Starting firmware update check...');
    
    for (const [repoKey, config] of Object.entries(FIRMWARE_REPOS)) {
      await this.processRepo(repoKey, config);
    }

    console.log(`\n✨ Update check completed. Changes: ${this.hasChanges ? 'Yes' : 'No'}`);
  }
}

// Run the updater
const updater = new FirmwareUpdater();
updater.run().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});