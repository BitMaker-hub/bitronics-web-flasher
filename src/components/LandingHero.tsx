'use client';

import { useState, useEffect, useRef } from 'react';
import { ComputerIcon, Download, Usb, Zap, Cpu, GitCompareIcon, RadioReceiver } from 'lucide-react';
import { Button } from './ui/button';
import { ESPLoader, Transport } from 'esptool-js';
import { useTranslation } from 'react-i18next';
import Header from './Header';
import InstructionPanel from './InstructionPanel';
import DeviceModal from './DeviceModal';
import Selector from './Selector';
import device_data from './firmware_data.json';

import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

const basePath = '';

export default function LandingHero() {
  const { t } = useTranslation();
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [selectedBoardVersion, setSelectedBoardVersion] = useState('');
  const [selectedFirmware, setSelectedFirmware] = useState('');
  const [status, setStatus] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChromiumBased, setIsChromiumBased] = useState(true);
  const [keepConfiguration, setKeepConfiguration] = useState(false);
  const [customAPName, setCustomAPName] = useState(false);
  const [apName, setApName] = useState('');
  const [nerdminerBoards, setNerdminerBoards] = useState<any[]>([]);
  const [nerdaxeBoards, setNerdaxeBoards] = useState<any[]>([]);
  const [nerdqaxeBoards, setNerdqaxeBoards] = useState<any[]>([]);
  const [bitaxeBoards, setBitaxeBoards] = useState<any[]>([]);
  const [nerdnosBoards, setNerdnosBoards] = useState<any[]>([]);
  const [nerdoctaxeBoards, setNerdoctaxeBoards] = useState<any[]>([]);
  const serialPortRef = useRef<any>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const textDecoderRef = useRef<TextDecoderStream | null>(null);
  const readableStreamClosedRef = useRef<Promise<void> | null>(null);
  const logsRef = useRef<string>('');

  // Function to load Nerdaxe boards from nerdqaxe manifests
  const loadNerdaxeBoards = async () => {
    try {
      // Read main manifest to get available versions
      let versions = ['v1.0.31', 'v1.0.29']; // Fallback versions
      
      try {
        const mainManifestResponse = await fetch(`${basePath}/firmware/nerdqaxe/manifest.json`);
        if (mainManifestResponse.ok) {
          const mainManifest = await mainManifestResponse.json();
          versions = mainManifest.versions || versions;
          console.log('Available Nerdaxe versions from main manifest:', versions);
        }
      } catch (error) {
        console.warn('Could not read main nerdqaxe manifest, using fallback versions');
      }
      
      const allBoards = new Map<string, any>();
      
      for (const version of versions) {
        try {
          const manifestResponse = await fetch(`${basePath}/firmware/nerdqaxe/${version}/manifest.json`);
          if (!manifestResponse.ok) continue;
          
          const manifest = await manifestResponse.json();
          
          if (manifest.boards && Array.isArray(manifest.boards)) {
            // Filter only Nerdaxe boards (not NerdQAxe)
            const nerdaxeBoards = manifest.boards.filter((board: string) => 
              board.startsWith('NerdAxe') && !board.startsWith('NerdQAxe')
            );
            
            for (const boardName of nerdaxeBoards) {
              const displayName = boardName === 'NerdAxe' ? 'Ultra' : 
                                 boardName === 'NerdAxeGamma' ? 'Gamma' : boardName;
              
              if (!allBoards.has(displayName)) {
                allBoards.set(displayName, {
                  name: displayName,
                  supported_firmware: []
                });
              }
              
              allBoards.get(displayName).supported_firmware.push({
                version: version,
                path: `${basePath}/firmware/nerdqaxe/${version}/${boardName}_factory.bin`
              });
            }
          }
        } catch (error) {
          console.error(`Error loading Nerdaxe manifest for ${version}:`, error);
        }
      }
      
      const boardsArray = Array.from(allBoards.values());
      setNerdaxeBoards(boardsArray);
    } catch (error) {
      console.error('Error loading Nerdaxe boards:', error);
    }
  };

  // Function to load Bitaxe boards from bitaxe manifests
  const loadBitaxeBoards = async () => {
    try {
      // Read main manifest to get available versions
      let versions = ['v2.10.0']; // Fallback versions
      
      try {
        const mainManifestResponse = await fetch(`${basePath}/firmware/bitaxe/manifest.json`);
        if (mainManifestResponse.ok) {
          const mainManifest = await mainManifestResponse.json();
          versions = mainManifest.versions || versions;
          console.log('Available Bitaxe versions from main manifest:', versions);
        }
      } catch (error) {
        console.warn('Could not read main bitaxe manifest, using fallback versions');
      }
      
      const allBoards = new Map<string, any>();
      
      for (const version of versions) {
        try {
          const manifestResponse = await fetch(`${basePath}/firmware/bitaxe/${version}/manifest.json`);
          if (!manifestResponse.ok) continue;
          
          const manifest = await manifestResponse.json();
          
          if (manifest.boards && Array.isArray(manifest.boards)) {
            for (const boardName of manifest.boards) {
              // Check if this is a lowmem version
              const isLowMem = version.includes('-lowmem');

              let displayName;
              if (isLowMem) {
                // For lowmem versions, add "Low Memory" suffix
                displayName = boardName === 'Supra401' ? 'Supra 401 (Low Memory)' :
                             boardName === 'Gamma601' ? 'Gamma 601 (Low Memory)' :
                             `${boardName} (Low Memory)`;
              } else {
                // Normal versions
                displayName = boardName === 'Supra401' ? 'Supra 401' :
                             boardName === 'Gamma601' ? 'Gamma 601' : boardName;
              }

              if (!allBoards.has(displayName)) {
                allBoards.set(displayName, {
                  name: displayName,
                  supported_firmware: []
                });
              }

              allBoards.get(displayName).supported_firmware.push({
                version: version,
                path: `${basePath}/firmware/bitaxe/${version}/${boardName}_factory.bin`
              });
            }
          }
        } catch (error) {
          console.error(`Error loading Bitaxe manifest for ${version}:`, error);
        }
      }
      
      const boardsArray = Array.from(allBoards.values());
      setBitaxeBoards(boardsArray);
    } catch (error) {
      console.error('Error loading Bitaxe boards:', error);
    }
  };

  // Function to load NerdNos boards from nerdnos manifests
  const loadNerdnosBoards = async () => {
    try {
      // Read main manifest to get available versions
      let versions = ['v1.0.4']; // Fallback versions
      
      try {
        const mainManifestResponse = await fetch(`${basePath}/firmware/nerdnos/manifest.json`);
        if (mainManifestResponse.ok) {
          const mainManifest = await mainManifestResponse.json();
          versions = mainManifest.versions || versions;
          console.log('Available NerdNos versions from main manifest:', versions);
        }
      } catch (error) {
        console.warn('Could not read main nerdnos manifest, using fallback versions');
      }

      const allBoards = new Map();

      // Process each version
      for (const version of versions) {
        try {
          const manifestResponse = await fetch(`${basePath}/firmware/nerdnos/${version}/manifest.json`);
          if (manifestResponse.ok) {
            const manifest = await manifestResponse.json();
            
            // Process each board in this version
            if (manifest.boards && Array.isArray(manifest.boards)) {
              for (const boardName of manifest.boards) {
                const boardKey = boardName;
                
                if (!allBoards.has(boardKey)) {
                  allBoards.set(boardKey, {
                    name: boardName,
                    supported_firmware: []
                  });
                }
                
                allBoards.get(boardKey).supported_firmware.push({
                  version: version,
                  path: `firmware/nerdnos/${version}/${boardName}_factory.bin`
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error loading NerdNos manifest for ${version}:`, error);
        }
      }
      
      const boardsArray = Array.from(allBoards.values());
      setNerdnosBoards(boardsArray);
    } catch (error) {
      console.error('Error loading NerdNos boards:', error);
    }
  };

  // Function to load NerdQaxe boards from nerdqaxe manifests
  const loadNerdqaxeBoards = async () => {
    try {
      // Read main manifest to get available versions
      let versions = ['v1.0.31', 'v1.0.29']; // Fallback versions

      try {
        const mainManifestResponse = await fetch(`${basePath}/firmware/nerdqaxe/manifest.json`);
        if (mainManifestResponse.ok) {
          const mainManifest = await mainManifestResponse.json();
          versions = mainManifest.versions || versions;
          console.log('Available NerdQaxe versions from main manifest:', versions);
        }
      } catch (error) {
        console.warn('Could not read main nerdqaxe manifest, using fallback versions');
      }

      const allBoards = new Map<string, any>();

      for (const version of versions) {
        try {
          const manifestResponse = await fetch(`${basePath}/firmware/nerdqaxe/${version}/manifest.json`);
          if (!manifestResponse.ok) continue;

          const manifest = await manifestResponse.json();

          if (manifest.boards && Array.isArray(manifest.boards)) {
            // Filter only NerdQAxe boards
            const nerdqaxeBoards = manifest.boards.filter((board: string) =>
              board.startsWith('NerdQAxe')
            );

            for (const boardName of nerdqaxeBoards) {
              const displayName = boardName === 'NerdQAxe++' ? '++ (4.8THs)' :
                                 boardName === 'NerdQAxe+' ? '+ (2.4THs)' : boardName;

              if (!allBoards.has(displayName)) {
                allBoards.set(displayName, {
                  name: displayName,
                  supported_firmware: []
                });
              }

              allBoards.get(displayName).supported_firmware.push({
                version: version,
                path: `${basePath}/firmware/nerdqaxe/${version}/${boardName}_factory.bin`
              });
            }
          }
        } catch (error) {
          console.error(`Error loading NerdQaxe manifest for ${version}:`, error);
        }
      }

      const boardsArray = Array.from(allBoards.values());
      setNerdqaxeBoards(boardsArray);
    } catch (error) {
      console.error('Error loading NerdQaxe boards:', error);
    }
  };

  // Function to load NerdOctaxe boards from nerdoctaxe manifests
  const loadNerdoctaxeBoards = async () => {
    try {
      let versions = ['v1.0.34.1', 'v1.0.32.1', 'v1.0.32']; // Fallback versions

      try {
        const mainManifestResponse = await fetch(`${basePath}/firmware/nerdoctaxe/manifest.json`);
        if (mainManifestResponse.ok) {
          const mainManifest = await mainManifestResponse.json();
          versions = mainManifest.versions || versions;
          console.log('Available NerdOctaxe versions from main manifest:', versions);
        }
      } catch (error) {
        console.warn('Could not read main nerdoctaxe manifest, using fallback versions');
      }

      const allBoards = new Map<string, any>();

      for (const version of versions) {
        try {
          const manifestResponse = await fetch(`${basePath}/firmware/nerdoctaxe/${version}/manifest.json`);
          if (!manifestResponse.ok) continue;

          const manifest = await manifestResponse.json();

          if (manifest.boards && Array.isArray(manifest.boards)) {
            for (const boardName of manifest.boards) {
              const displayName = boardName === 'NerdOctaxeGamma' ? 'Gamma' : boardName;

              if (!allBoards.has(displayName)) {
                allBoards.set(displayName, {
                  name: displayName,
                  supported_firmware: []
                });
              }

              allBoards.get(displayName).supported_firmware.push({
                version: version,
                path: `${basePath}/firmware/nerdoctaxe/${version}/${boardName}_factory.bin`
              });
            }
          }
        } catch (error) {
          console.error(`Error loading NerdOctaxe manifest for ${version}:`, error);
        }
      }

      const boardsArray = Array.from(allBoards.values());
      setNerdoctaxeBoards(boardsArray);
    } catch (error) {
      console.error('Error loading NerdOctaxe boards:', error);
    }
  };

  // Function to load all Nerdminer boards from manifests
  const loadNerdminerBoards = async () => {
    try {
      const versions = ['v1.8.3', 'v1.7.0', 'v1.6.3'];
      const allBoards = new Map<string, any>();
      
      for (const version of versions) {
        try {
          const manifestResponse = await fetch(`${basePath}/firmware/nerdminer/${version}/manifest.json`);
          if (!manifestResponse.ok) {
            console.warn(`Manifest not found for ${version}`);
            continue;
          }
          
          const manifest = await manifestResponse.json();
          console.log(`Manifest for ${version}:`, manifest);
          
          if (manifest.boards && Array.isArray(manifest.boards)) {
            for (const boardName of manifest.boards) {
              let displayName = boardName;
              
              // Special case for the original board - make it first
              if (boardName.toUpperCase() === 'NERDMINERV2') {
                displayName = 'NERDMINERV2 ORIGINAL BOARD (TDISPLAY-S3)';
              }
              
              if (!allBoards.has(displayName)) {
                allBoards.set(displayName, {
                  name: displayName,
                  supported_firmware: []
                });
              }
              
              // Add this version to the board's supported firmware
              allBoards.get(displayName).supported_firmware.push({
                version: version,
                path: `${basePath}/firmware/nerdminer/${version}/${boardName}_factory.bin`
              });
            }
          }
        } catch (error) {
          console.error(`Error loading manifest for ${version}:`, error);
        }
      }
      
      // Convert Map to Array and sort: Original board first, then alphabetical
      const boardsArray = Array.from(allBoards.values()).sort((a, b) => {
        if (a.name === 'NERDMINERV2 ORIGINAL BOARD (TDISPLAY-S3)') return -1;
        if (b.name === 'NERDMINERV2 ORIGINAL BOARD (TDISPLAY-S3)') return 1;
        return a.name.localeCompare(b.name);
      });
      
      console.log('All loaded boards:', boardsArray);
      setNerdminerBoards(boardsArray);
    } catch (error) {
      console.error('Error loading Nerdminer boards:', error);
    }
  };

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isChromium = /chrome|chromium|crios|edge/i.test(userAgent);
    setIsChromiumBased(isChromium);
    
    // Initialize default background
    document.body.style.background = `linear-gradient(rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.85)), url('${basePath}/pictures/Bitronics_hw.png')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    
    // Load boards dynamically
    loadNerdminerBoards();
    loadNerdaxeBoards();
    loadNerdqaxeBoards();
    loadBitaxeBoards();
    loadNerdnosBoards();
    loadNerdoctaxeBoards();
  }, []);

  useEffect(() => {
    if (terminalContainerRef.current && !terminalRef.current && isLogging) {
      const term = new Terminal({
        cols: 80,
        rows: 24,
        theme: {
          background: '#1a1b26',
          foreground: '#a9b1d6',
        },
      });
      terminalRef.current = term;
      term.open(terminalContainerRef.current);
      term.writeln(t('status.loggingStarted'));
      logsRef.current = t('status.loggingStarted') + '\n';
    }

    return () => {
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
    };
  }, [isLogging, t]);

  const devices = device_data.devices;
  
  // Get device data with dynamic support for Nerdminer, Nerdaxe, NerdQaxe, and Bitaxe
  const getDeviceData = () => {
    if (selectedDevice === '') return { boards: [] };
    
    const device = devices.find((d) => d.name == selectedDevice);
    if (!device) return { boards: [] };
    
    if (device.name === 'Nerdminer') {
      // Return dynamic boards for Nerdminer
      return { boards: nerdminerBoards };
    }
    
    if (device.name === 'Nerdaxe') {
      // Return dynamic boards for Nerdaxe from nerdqaxe manifests
      return { boards: nerdaxeBoards };
    }
    
    if (device.name === 'NerdQaxe') {
      // Return dynamic boards for NerdQaxe from nerdqaxe manifests  
      return { boards: nerdqaxeBoards };
    }
    
    if (device.name === 'Bitaxe') {
      // Return dynamic boards for Bitaxe from bitaxe manifests
      return { boards: bitaxeBoards };
    }
    
    if (device.name === 'NerdNos') {
      // Return dynamic boards for NerdNos from nerdnos manifests
      return { boards: nerdnosBoards };
    }

    if (device.name === 'NerdOctaxe') {
      // Return dynamic boards for NerdOctaxe from nerdoctaxe manifests
      return { boards: nerdoctaxeBoards };
    }

    return device;
  };
  
  const device = getDeviceData();
  const board =
    selectedBoardVersion !== ''
      ? device.boards.find((b) => b.name == selectedBoardVersion)!
      : { supported_firmware: [] };
  const firmware =
    selectedFirmware !== ''
      ? board.supported_firmware.find((f: any) => f.version == selectedFirmware)!
      : { path: '' };

  const handleConnect = async () => {
    setIsConnecting(true);
    setStatus(t('status.connecting'));

    try {
      const port = await navigator.serial.requestPort();
      await port.open({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
      });

      serialPortRef.current = port;
      setIsConnected(true);
      setStatus(t('status.connected'));
    } catch (error) {
      console.error('Connection failed:', error);
      setStatus(
        `${t('status.connectionFailed')}: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (isLogging) {
      await stopSerialLogging();
    }
    try {
      if (serialPortRef.current?.readable) {
        await serialPortRef.current.close();
      }
      serialPortRef.current = null;
      setIsConnected(false);
      setStatus('');
    } catch (error) {
      console.error('Disconnect error:', error);
      setStatus(
        `${t('status.disconnectError')}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const startSerialLogging = async () => {
    if (!serialPortRef.current) {
      setStatus(t('status.connectFirst'));
      return;
    }

    try {
      setIsLogging(true);
      const port = serialPortRef.current;

      // First ensure any existing connections are cleaned up
      if (readerRef.current) {
        await readerRef.current.cancel();
      }
      if (readableStreamClosedRef.current) {
        await readableStreamClosedRef.current;
      }

      // Set up text decoder stream
      const decoder = new TextDecoderStream();
      const inputDone = port.readable.pipeTo(decoder.writable);
      const inputStream = decoder.readable;
      const reader = inputStream.getReader();

      textDecoderRef.current = decoder;
      readableStreamClosedRef.current = inputDone;
      readerRef.current = reader;

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            reader.releaseLock();
            break;
          }
          terminalRef.current?.write(value);
          logsRef.current += value;
        }
      } catch (error) {
        console.error('Error in read loop:', error);
      }
    } catch (error) {
      console.error('Serial logging error:', error);
      setStatus(
        `${t('status.loggingError')}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    setIsLogging(false);
  };

  const stopSerialLogging = async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      if (readableStreamClosedRef.current) {
        await readableStreamClosedRef.current;
        readableStreamClosedRef.current = null;
      }
      if (textDecoderRef.current) {
        textDecoderRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping serial logging:', error);
    } finally {
      setIsLogging(false);
    }
  };

  const downloadLogs = () => {
    const blob = new Blob([logsRef.current], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `bitaxe-logs-${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const createNVSPartition = (entries: { key: string; value: string }[], hasStateNamespace: boolean = false): string => {
    // NVS partition structure for ESP32
    // NVS uses pages of 4096 bytes, first page is header
    const PAGE_SIZE = 4096;
    const NVS_SIZE = 0x6000; // 24KB NVS partition (3 pages)
    
    // Create empty NVS partition filled with 0xFF
    const nvsBuffer = new Uint8Array(NVS_SIZE);
    nvsBuffer.fill(0xFF);
    
    // Page 0: NVS Header
    let offset = 0;
    
    // NVS Page Header (32 bytes)
    nvsBuffer[offset++] = 0xFE; // Page state: Active
    nvsBuffer[offset++] = 0xFF;
    nvsBuffer[offset++] = 0xFF; 
    nvsBuffer[offset++] = 0xFF;
    
    // Sequence number (4 bytes) - start with 1
    nvsBuffer[offset++] = 0x01;
    nvsBuffer[offset++] = 0x00;
    nvsBuffer[offset++] = 0x00;
    nvsBuffer[offset++] = 0x00;
    
    // Skip rest of header (fill with 0xFF)
    offset = 32;
    
    // Create namespace "config" if it doesn't exist
    if (!hasStateNamespace) {
      console.log('Creating namespace "config" - new device detected');
      const namespaceBytes = new TextEncoder().encode('config');
      console.log(`Namespace entry will be written at offset: ${offset}`);
      
      // Namespace entry header (32 bytes)
      nvsBuffer[offset++] = 0x00; // Namespace index 0 (for namespace definitions)
      nvsBuffer[offset++] = 0x01; // Type: Namespace (0x01)
      nvsBuffer[offset++] = 0x01; // Span
      nvsBuffer[offset++] = 0x00; // Reserved
      
      // CRC32 (4 bytes) - simplified
      nvsBuffer[offset++] = 0x00;
      nvsBuffer[offset++] = 0x00;
      nvsBuffer[offset++] = 0x00;
      nvsBuffer[offset++] = 0x00;
      
      // Namespace name (max 15 bytes, null-terminated)
      for (let i = 0; i < Math.min(namespaceBytes.length, 15); i++) {
        nvsBuffer[offset++] = namespaceBytes[i];
      }
      for (let i = namespaceBytes.length; i < 16; i++) {
        nvsBuffer[offset++] = 0x00; // Null padding
      }
      
      // Namespace index (1 byte) + padding (7 bytes)
      nvsBuffer[offset++] = 0x01; // Assign namespace index 1
      for (let i = 0; i < 7; i++) {
        nvsBuffer[offset++] = 0x00;
      }
    }
    
    // Write entries
    console.log(`Writing ${entries.length} NVS entries starting at offset: ${offset}`);
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const keyBytes = new TextEncoder().encode(entry.key);
      const valueBytes = new TextEncoder().encode(entry.value);
      
      console.log(`Entry ${i + 1}: "${entry.key}" = "${entry.value}" (${keyBytes.length + valueBytes.length + 32} bytes)`);
      
      if (offset + 32 + keyBytes.length + valueBytes.length > PAGE_SIZE) {
        console.warn('NVS page full, skipping remaining entries');
        break;
      }
      
      // NVS Entry Header (32 bytes)
      nvsBuffer[offset++] = 0x01; // Namespace index (config = 1)
      nvsBuffer[offset++] = 0x21; // Type: String (0x21)
      nvsBuffer[offset++] = 0x01; // Span
      nvsBuffer[offset++] = 0x00; // Reserved
      
      // CRC32 (4 bytes) - simplified, using 0x00000000
      nvsBuffer[offset++] = 0x00;
      nvsBuffer[offset++] = 0x00;
      nvsBuffer[offset++] = 0x00;
      nvsBuffer[offset++] = 0x00;
      
      // Key (max 15 bytes, null-terminated)
      const keyLen = Math.min(keyBytes.length, 15);
      for (let i = 0; i < keyLen; i++) {
        nvsBuffer[offset++] = keyBytes[i];
      }
      for (let i = keyLen; i < 16; i++) {
        nvsBuffer[offset++] = 0x00; // Null padding
      }
      
      // Data length (2 bytes)
      nvsBuffer[offset++] = valueBytes.length & 0xFF;
      nvsBuffer[offset++] = (valueBytes.length >> 8) & 0xFF;
      
      // Reserved (6 bytes)
      for (let i = 0; i < 6; i++) {
        nvsBuffer[offset++] = 0x00;
      }
      
      // Value data
      for (let i = 0; i < valueBytes.length; i++) {
        nvsBuffer[offset++] = valueBytes[i];
      }
      
      // Align to 4-byte boundary
      while (offset % 4 !== 0) {
        nvsBuffer[offset++] = 0x00;
      }
    }
    
    // Convert to binary string for esptool
    return Array.from(nvsBuffer, (byte) => String.fromCharCode(byte)).join('');
  };

  const parseExistingNVS = (nvsData: Uint8Array): { hasStateNamespace: boolean; entries: { key: string; value: string }[] } => {
    const entries: { key: string; value: string }[] = [];
    let hasStateNamespace = false;
    
    // Skip NVS page header (32 bytes) and start reading entries
    let offset = 32;
    
    while (offset < nvsData.length - 32) {
      // Check if we're at an empty entry (all 0xFF)
      if (nvsData[offset] === 0xFF) break;
      
      // Read entry header (32 bytes)
      const namespaceIndex = nvsData[offset];
      const type = nvsData[offset + 1];
      
      // Check for namespace definition entry
      if (type === 0x01 && namespaceIndex === 0x00) {
        // This is a namespace definition
        let namespaceName = '';
        for (let i = 8; i < 24; i++) {
          if (nvsData[offset + i] === 0) break;
          namespaceName += String.fromCharCode(nvsData[offset + i]);
        }
        if (namespaceName === 'config') {
          hasStateNamespace = true;
          console.log('Found existing "config" namespace');
        }
        offset += 32;
        continue;
      }
      
      // Skip non-string entries or different namespaces
      if (type !== 0x21 || namespaceIndex !== 0x01) {
        offset += 32;
        continue;
      }
      
      // Read key (16 bytes, null-terminated)
      let key = '';
      for (let i = 8; i < 24; i++) {
        if (nvsData[offset + i] === 0) break;
        key += String.fromCharCode(nvsData[offset + i]);
      }
      
      // Read data length
      const dataLen = nvsData[offset + 24] | (nvsData[offset + 25] << 8);
      
      offset += 32;
      
      // Read value data
      let value = '';
      for (let i = 0; i < dataLen; i++) {
        value += String.fromCharCode(nvsData[offset + i]);
      }
      
      entries.push({ key, value });
      
      // Move to next entry (align to 4-byte boundary)
      offset += Math.ceil(dataLen / 4) * 4;
    }
    
    return { hasStateNamespace, entries };
  };

  const createSPIFFSImage = (fileName: string, content: string): Uint8Array => {
    // Implementar estructura SPIFFS real para ESP32
    const SPIFFS_PAGE_SIZE = 256;
    const SPIFFS_BLOCK_SIZE = 4096; 
    const SPIFFS_IMAGE_SIZE = 0x20000; // 128KB debería ser suficiente
    
    const image = new Uint8Array(SPIFFS_IMAGE_SIZE);
    image.fill(0xFF); // Estado borrado
    
    console.log(`Creating SPIFFS image with file: ${fileName}`);
    
    // SPIFFS Header Block (bloque 0)
    let offset = 0;
    
    // SPIFFS Magic numbers y configuración
    image[offset++] = 0x20; image[offset++] = 0x16; // Magic
    image[offset++] = 0x05; image[offset++] = 0x19; // Version  
    
    // Configuración SPIFFS
    image[offset++] = (SPIFFS_PAGE_SIZE >> 0) & 0xFF;
    image[offset++] = (SPIFFS_PAGE_SIZE >> 8) & 0xFF;
    image[offset++] = (SPIFFS_BLOCK_SIZE >> 0) & 0xFF;
    image[offset++] = (SPIFFS_BLOCK_SIZE >> 8) & 0xFF;
    image[offset++] = (SPIFFS_BLOCK_SIZE >> 16) & 0xFF;
    image[offset++] = (SPIFFS_BLOCK_SIZE >> 24) & 0xFF;
    
    // Saltar al bloque 1 para datos
    offset = SPIFFS_BLOCK_SIZE;
    
    // Object Index Header (ID de archivo)
    const fileId = 1;
    image[offset++] = fileId & 0xFF;
    image[offset++] = (fileId >> 8) & 0xFF;
    
    // Object Header
    image[offset++] = 0x02; // SPIFFS_OBJ_TYPE_FILE
    image[offset++] = 0x00; // Span index
    
    // Nombre del archivo (máximo 32 bytes)
    const fileNameBytes = new TextEncoder().encode(fileName);
    const maxNameLen = 32;
    for (let i = 0; i < maxNameLen; i++) {
      if (i < fileNameBytes.length) {
        image[offset++] = fileNameBytes[i];
      } else {
        image[offset++] = 0x00; // Padding
      }
    }
    
    // Metadata del archivo
    const contentBytes = new TextEncoder().encode(content);
    const fileSize = contentBytes.length;
    
    // Tamaño del archivo (4 bytes)
    image[offset++] = (fileSize >> 0) & 0xFF;
    image[offset++] = (fileSize >> 8) & 0xFF;
    image[offset++] = (fileSize >> 16) & 0xFF;
    image[offset++] = (fileSize >> 24) & 0xFF;
    
    // Alinear a siguiente página
    offset = Math.ceil(offset / SPIFFS_PAGE_SIZE) * SPIFFS_PAGE_SIZE;
    
    // Escribir contenido del archivo
    console.log(`Writing file content at offset: 0x${offset.toString(16)}`);
    for (let i = 0; i < contentBytes.length; i++) {
      image[offset++] = contentBytes[i];
    }
    
    console.log(`SPIFFS image created: ${SPIFFS_IMAGE_SIZE} bytes total`);
    return image;
  };

  const flashSimpleConfig = async (loader: any, key: string, value: string) => {
    try {
      // MÉTODO FÁCIL: Escribir datos simples en área libre del flash
      // Usar 0x3F0000 - final de huge_app.csv, área libre
      const configAddress = 0x3F0000;
      
      console.log(`📝 Writing simple config data to safe area: 0x${configAddress.toString(16)}`);
      console.log(`This method is simple and safe - no SPIFFS complexity`);
      
      // Crear estructura simple: MARCA + JSON
      const configJson = { [key]: value };
      const jsonString = JSON.stringify(configJson);
      const marker = "WEBFLASHER_CONFIG:";
      const fullData = marker + jsonString;
      
      console.log(`Config data: "${fullData}"`);
      console.log(`Total size: ${fullData.length} bytes`);
      
      // Convertir a binary string para esptool
      const dataBytes = new TextEncoder().encode(fullData);
      const binaryString = Array.from(dataBytes, byte => String.fromCharCode(byte)).join('');
      
      // Flash los datos
      await loader.writeFlash({
        fileArray: [
          {
            data: binaryString,
            address: configAddress,
          },
        ],
        flashSize: 'keep',
        flashMode: 'keep',
        flashFreq: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const percent = Math.round((written / total) * 100);
          console.log(`Config write progress: ${percent}% (${written}/${total} bytes)`);
        },
        calculateMD5Hash: () => '',
      });
      
      console.log('✅ Simple config data written successfully');
      
      // Verificar la escritura
      try {
        console.log('Verifying config data...');
        const verifyData = await loader.readFlash(configAddress, fullData.length + 10);
        
        let readBytes: Uint8Array;
        if (typeof verifyData === 'string') {
          readBytes = new Uint8Array(verifyData.length);
          for (let i = 0; i < verifyData.length; i++) {
            readBytes[i] = verifyData.charCodeAt(i);
          }
        } else {
          readBytes = new Uint8Array(verifyData);
        }
        
        // Convertir de vuelta a string
        const readString = Array.from(readBytes.slice(0, fullData.length), byte => 
          String.fromCharCode(byte)).join('');
        
        console.log(`Read back: "${readString}"`);
        
        if (readString === fullData) {
          console.log('✅ Config data verification successful!');
          console.log(`✅ AP name "${value}" written to flash at 0x${configAddress.toString(16)}`);
        } else {
          console.error('❌ Config data verification failed');
        }
        
      } catch (verifyError) {
        console.warn('Could not verify config data:', verifyError);
      }
      
    } catch (error) {
      console.error(`Error writing simple config:`, error);
      throw error;
    }
  };

  const validateSSID = (ssid: string): boolean => {
    if (!ssid || ssid.length === 0) return false;
    if (ssid.length > 31) return false;
    if (/\s/.test(ssid)) return false; // No spaces
    if (!/^[a-zA-Z0-9_-]+$/.test(ssid)) return false; // Only alphanumeric, underscore, hyphen
    return true;
  };

  // Check if the selected board supports custom AP name
  const supportsCustomAPName = (): boolean => {
    return selectedBoardVersion === 'NERDMINERV2 ORIGINAL BOARD (TDISPLAY-S3)' || 
           selectedBoardVersion === 'ESP32-devKitv1' ||
           selectedBoardVersion === 'ESP32-S3-mini-wemos' ||
           selectedBoardVersion === 'ESP32-S3-devKitv1' ||
           selectedBoardVersion === 'esp32-s3-devkitc1-n32r8' ||
           selectedBoardVersion === 'ESP32-C3-devKitmv1' ||
           selectedBoardVersion === 'ESP32-D0WD-V3-weact';
  };

  const handleStartFlashing = async () => {
    if (!serialPortRef.current) {
      setStatus(t('status.connectFirst'));
      return;
    }

    if (!selectedDevice || !selectedBoardVersion) {
      setStatus(t('status.selectBoth'));
      return;
    }

    // Validate custom AP name if enabled
    if (selectedDevice === 'Nerdminer' && customAPName) {
      if (!validateSSID(apName)) {
        setStatus('Invalid AP name. Must be 1-31 characters, no spaces, only letters, numbers, underscore and hyphen.');
        return;
      }
    }

    setIsFlashing(true);
    setStatus(t('status.preparing'));

    try {
      // Stop logging if it's active
      if (isLogging) {
        await stopSerialLogging();
      }

      // Close the current connection
      if (serialPortRef.current.readable) {
        await serialPortRef.current.close();
      }

      // Create transport and ESPLoader for flashing
      const transport = new Transport(serialPortRef.current);
      const loader = new ESPLoader({
        transport,
        baudrate: 115200,
        romBaudrate: 115200,
        terminal: {
          clean() {},
          writeLine(data: string) {
            // setStatus(data);
          },
          write(data: string) {
            // setStatus(data);
          },
        },
      });

      await loader.main();

      if (!firmware) {
        throw new Error('No firmware available for the selected device and board version');
      }

      // Handle single file flashing for all devices (now including Nerdminer)
      let firmwarePath;
      let flashAddress = 0;
      
      if (selectedDevice === 'Nerdminer') {
        // For Nerdminer, construct the path based on keep configuration setting
        let boardName = selectedBoardVersion;
        const version = selectedFirmware;
        
        // Handle the special case of the original board
        if (boardName === 'NERDMINERV2 ORIGINAL BOARD (TDISPLAY-S3)') {
          boardName = 'NerdminerV2';
        }
        
        if (keepConfiguration) {
          // Use firmware-only file and flash to 0x10000
          firmwarePath = `${basePath}/firmware/nerdminer/${version}/${boardName}_firmware.bin`;
          flashAddress = 0x10000;
        } else {
          // Use factory file and flash to 0x0000
          firmwarePath = `${basePath}/firmware/nerdminer/${version}/${boardName}_factory.bin`;
          flashAddress = 0x0000;
        }
      } else if (selectedDevice === 'Nerdaxe' || selectedDevice === 'NerdQaxe') {
        // For Nerdaxe and NerdQaxe, construct the path based on keep configuration setting
        const version = selectedFirmware;
        let deviceFileName;
        
        // Map display names to file names
        if (selectedDevice === 'Nerdaxe') {
          if (selectedBoardVersion === 'Ultra') {
            deviceFileName = 'NerdAxe';
          } else if (selectedBoardVersion === 'Gamma') {
            deviceFileName = 'NerdAxeGamma';
          }
        } else if (selectedDevice === 'NerdQaxe') {
          if (selectedBoardVersion === '++ (4.8THs)') {
            deviceFileName = 'NerdQAxe++';
          } else if (selectedBoardVersion === '+ (2.4THs)') {
            deviceFileName = 'NerdQAxe+';
          }
        }
        
        if (keepConfiguration) {
          // Use firmware-only file and flash to 0x10000
          firmwarePath = `${basePath}/firmware/nerdqaxe/${version}/${deviceFileName}_firmware.bin`;
          flashAddress = 0x10000;
        } else {
          // Use factory file and flash to 0x0000
          firmwarePath = `${basePath}/firmware/nerdqaxe/${version}/${deviceFileName}_factory.bin`;
          flashAddress = 0x0000;
        }
      } else if (selectedDevice === 'Bitaxe') {
        // For Bitaxe, construct the path based on keep configuration setting
        const version = selectedFirmware;
        let deviceFileName;
        
        // Map display names to file names
        if (selectedBoardVersion === 'Supra 401') {
          deviceFileName = 'Supra401';
        } else if (selectedBoardVersion === 'Gamma 601') {
          deviceFileName = 'Gamma601';
        }
        
        if (keepConfiguration) {
          // Use firmware-only file and flash to 0x10000
          firmwarePath = `${basePath}/firmware/bitaxe/${version}/${deviceFileName}_firmware.bin`;
          flashAddress = 0x10000;
        } else {
          // Use factory file and flash to 0x0000
          firmwarePath = `${basePath}/firmware/bitaxe/${version}/${deviceFileName}_factory.bin`;
          flashAddress = 0x0000;
        }
      } else {
        // For other devices, use the regular path
        firmwarePath = firmware.path;
        flashAddress = 0;
      }

      const firmwareResponse = await fetch(firmwarePath);
      if (!firmwareResponse.ok) {
        throw new Error('Failed to load firmware file');
      }

      const firmwareArrayBuffer = await firmwareResponse.arrayBuffer();
      const firmwareUint8Array = new Uint8Array(firmwareArrayBuffer);
      const firmwareBinaryString = Array.from(firmwareUint8Array, (byte) =>
        String.fromCharCode(byte)
      ).join('');

      setStatus(t('status.flashing', { percent: 0 }));

      await loader.writeFlash({
        fileArray: [
          {
            data: firmwareBinaryString,
            address: flashAddress,
          },
        ],
        flashSize: 'keep',
        flashMode: 'keep',
        flashFreq: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex, written, total) => {
          const percent = Math.round((written / total) * 100);
          if (percent == 100) {
            setStatus(t('status.completed'));
          } else {
            setStatus(t('status.flashing', { percent: percent }));
          }
        },
        calculateMD5Hash: () => '',
      });

      setStatus(t('status.completed'));

      // Flash custom AP name if enabled for Nerdminer - only for specific boards
      if (selectedDevice === 'Nerdminer' && 
          customAPName && 
          apName && 
          validateSSID(apName) &&
          supportsCustomAPName()) {
        setStatus('Writing custom AP name...');
        try {
          await flashSimpleConfig(loader, 'apname', apName);
          setStatus('Custom AP name written successfully');
        } catch (error) {
          console.warn('Failed to write custom AP name:', error);
          setStatus('Warning: Failed to write custom AP name, but firmware was flashed successfully');
        }
      }

      await loader.hardReset();
      setStatus(t('status.success'));
    } catch (error) {
      console.error('Flashing failed:', error);
      setStatus(
        `${t('status.flashingFailed')}: ${
          error instanceof Error ? error.message : String(error)
        }. Please try again.`
      );
    } finally {
      setIsFlashing(false);
    }
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  const selectDevice = (name: string) => {
    setSelectedDevice(name);
    setSelectedBoardVersion('');
    setSelectedFirmware('');
    setIsModalOpen(false);
    
    // Change background for Nerdminer
    if (name === 'Nerdminer') {
      document.body.style.background = `linear-gradient(rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.85)), url('${basePath}/pictures/fondoNM3.png')`;
      document.body.classList.remove('nerdminer-bg');
    } else {
      document.body.style.background = `linear-gradient(rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.85)), url('${basePath}/pictures/Bitronics_hw.png')`;
      document.body.classList.remove('nerdminer-bg');
    }
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
  };

  if (!isChromiumBased) {
    return (
      <div className="container px-4 md:px-6 py-12 text-center">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none mb-4">
          {t('errors.browserCompatibility.title')}
        </h1>
        <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
          {t('errors.browserCompatibility.description')}
        </p>
      </div>
    );
  }

  return (
    <>
      <Header onOpenPanel={() => setIsPanelOpen(true)} />
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center gap-8">
            <div className="space-y-2 mb-14">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                {selectedDevice === 'Nerdminer' 
                  ? 'Flash, play and learn with nerdminer'
                  : t('hero.title')
                }
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                {t('hero.description')}
              </p>
            </div>
            <div className="flex flex-col justify-between items-center w-3/4 gap-y-20 md:flex-row">
              <div className="flex flex-col justify-center w-52">
                {selectedDevice === '' ? (
                  <RadioReceiver
                    className="h-25 w-25 md:h-29 md:w-29 lg:h-37 lg:w-37 mb-4 m-auto"
                    color="#6B7280"
                    strokeWidth={1}
                  />
                ) : (
                  <img
                    src={`${basePath}/${devices.find(d => d.name === selectedDevice)?.picture}`}
                    alt={selectedDevice}
                    className="h-25 w-25 md:h-29 md:w-29 lg:h-37 lg:w-37 mb-4 m-auto object-contain rounded-lg"
                  />
                )}
                <Button onClick={openModal} disabled={isConnecting || isFlashing}>
                  {selectedDevice === '' ? t('hero.selectDevice') : selectedDevice}
                </Button>
              </div>
              <div className="flex flex-col justify-center w-52">
                <Cpu
                  className="h-25 w-25 md:h-29 md:w-29 lg:h-37 lg:w-37 mb-4 m-auto"
                  color="#6B7280"
                  strokeWidth={1}
                />
                <Selector
                  placeholder={t('hero.selectBoard')}
                  values={device.boards.map((b) => b.name)}
                  onValueChange={(value) => {
                    setSelectedBoardVersion(value);
                    setSelectedFirmware('');
                  }}
                  disabled={isConnecting || isFlashing || selectedDevice === ''}
                />
              </div>
              <div className="flex flex-col justify-center w-52">
                <GitCompareIcon
                  className="h-25 w-25 md:h-29 md:w-29 lg:h-37 lg:w-37 mb-4 m-auto"
                  color="#6B7280"
                  strokeWidth={1}
                />
                <Selector
                  placeholder={t('hero.selectFirmware')}
                  values={board.supported_firmware.map((f: any) => f.version)}
                  onValueChange={setSelectedFirmware}
                  disabled={isConnecting || isFlashing || selectedBoardVersion === ''}
                />
              </div>
            </div>
            
            {/* Keep Configuration Checkbox (for Nerdminer, Nerdaxe, NerdQaxe, and Bitaxe - NOT for NerdNos) */}
            {(selectedDevice === 'Nerdminer' || selectedDevice === 'Nerdaxe' || selectedDevice === 'NerdQaxe' || selectedDevice === 'Bitaxe') && (
              <div className="flex flex-col items-center space-y-4 justify-center">
                <div className="flex items-center space-x-2 justify-center">
                  <input
                    type="checkbox"
                    id="keepConfiguration"
                    checked={keepConfiguration}
                    onChange={(e) => setKeepConfiguration(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label htmlFor="keepConfiguration" className="text-sm font-medium text-gray-900 dark:text-gray-300">
                    {t('hero.keepConfiguration')}
                  </label>
                </div>
                {/* Custom AP Name checkbox - only for specific boards */}
                {supportsCustomAPName() && (
                  <div className="flex items-center space-x-2 justify-center">
                    <input
                      type="checkbox"
                      id="customAPName"
                      checked={customAPName}
                      onChange={(e) => setCustomAPName(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <label htmlFor="customAPName" className="text-sm font-medium text-gray-900 dark:text-gray-300">
                      Custom Access Point Name
                    </label>
                  </div>
                )}
                {customAPName && supportsCustomAPName() && (
                  <div className="flex flex-col items-center space-y-2">
                    <input
                      type="text"
                      id="apName"
                      value={apName}
                      onChange={(e) => setApName(e.target.value)}
                      placeholder="Enter AP name (max 31 chars)"
                      maxLength={31}
                      className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    />
                    {apName && !validateSSID(apName) && (
                      <p className="text-xs text-red-500">
                        {apName.length > 31 ? 'Max 31 characters allowed' :
                         /\s/.test(apName) ? 'No spaces allowed' :
                         !/^[a-zA-Z0-9_-]+$/.test(apName) ? 'Only letters, numbers, underscore and hyphen allowed' :
                         'Invalid AP name'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="w-full max-w-sm space-y-4">
              <Button
                className="w-full"
                onClick={isConnected ? handleDisconnect : handleConnect}
                disabled={isConnecting || isFlashing || !selectedDevice || !selectedBoardVersion || !selectedFirmware}
              >
                {isConnected ? t('hero.disconnect') : t('hero.connect')}
                <Usb className="ml-2 h-4 w-4" />
              </Button>
              <Button
                className="w-full mb-4"
                onClick={handleStartFlashing}
                disabled={
                  !selectedDevice ||
                  !selectedBoardVersion ||
                  !selectedFirmware ||
                  isConnecting ||
                  isFlashing ||
                  !isConnected
                }
              >
                {isFlashing ? t('hero.flashing') : t('hero.startFlashing')}
                <Zap className="ml-2 h-4 w-4" />
              </Button>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={isLogging ? stopSerialLogging : startSerialLogging}
                  disabled={!isConnected || isFlashing}
                >
                  {isLogging ? t('hero.stopLogging') : t('hero.startLogging')}
                  <ComputerIcon className="ml-2 h-4 w-4" />
                </Button>
                <Button className="flex-1" onClick={downloadLogs} disabled={!logsRef.current}>
                  {t('hero.downloadLogs')}
                  <Download className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <p className="mx-auto max-w-[400px] text-gray-500 md:text-m dark:text-gray-400">
                {t('hero.loggingDescription')}
              </p>
              {status && <p className="mt-2 text-sm font-medium">{status}</p>}
            </div>
            {isLogging && (
              <div
                ref={terminalContainerRef}
                className="w-full max-w-4xl h-[400px] bg-black rounded-lg overflow-hidden mt-8 border border-gray-700 text-left"
              />
            )}
          </div>
        </div>
      </section>
      <InstructionPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
      <DeviceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectDevice={(name: string) => selectDevice(name)}
      />
    </>
  );
}
