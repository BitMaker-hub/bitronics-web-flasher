'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ComputerIcon,
  Download,
  Usb,
  Zap,
  Cpu,
  GitCompareIcon,
  RadioReceiver,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from './ui/button';
import { ESPLoader, Transport } from 'esptool-js';
import { useTranslation } from 'react-i18next';
import Header from './Header';
import InstructionPanel from './InstructionPanel';
import DeviceModal from './DeviceModal';
import Selector from './Selector';
import device_data from './firmware_data.json';
import { Board, DEVICE_SOURCES, DeviceSource, Firmware, sourceFor } from '@/lib/devices';
import { Chip, chipFromEsptool } from '@/lib/boards';
import BoardPicker from './BoardPicker';
import DeviceIntro from './DeviceIntro';

import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

const basePath = '';

// The Bitronics signature: a white headline with exactly one word in gold.
function Headline({ text }: { text: string }) {
  const words = text.trim().split(' ');
  const accent = words.pop();

  return (
    <>
      {words.join(' ')} <span className="text-bitronics">{accent}</span>
    </>
  );
}

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
  const [isBoardPickerOpen, setIsBoardPickerOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [verification, setVerification] = useState<{
    digest: string;
    upstream: { repo: string; asset: string } | null;
  } | null>(null);
  const [isChromiumBased, setIsChromiumBased] = useState(true);
  const [keepConfiguration, setKeepConfiguration] = useState(false);
  const [customAPName, setCustomAPName] = useState(false);
  const [apName, setApName] = useState('');
  const [boardsByDevice, setBoardsByDevice] = useState<Record<string, Board[]>>({});
  const serialPortRef = useRef<any>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const textDecoderRef = useRef<TextDecoderStream | null>(null);
  const readableStreamClosedRef = useRef<Promise<void> | null>(null);
  const logsRef = useRef<string>('');

  // One loader for every device: read the main manifest for the versions, then
  // each version's manifest for the boards it was built for.
  const loadBoards = async (source: DeviceSource): Promise<Board[]> => {
    // The main manifest is the only source of versions. It comes from this same
    // site, so if it cannot be read then neither can the per-version manifests
    // and there is nothing sensible to fall back to.
    let versions: string[] = [];

    try {
      const response = await fetch(`${basePath}/firmware/${source.slug}/manifest.json`);
      if (response.ok) {
        versions = (await response.json()).versions || [];
      } else {
        console.warn(`No manifest for ${source.slug}: it will have no versions to offer`);
      }
    } catch (error) {
      console.warn(`Could not read the ${source.slug} manifest:`, error);
    }

    const boards = new Map<string, Board>();

    for (const version of versions) {
      try {
        const response = await fetch(
          `${basePath}/firmware/${source.slug}/${version}/manifest.json`,
        );
        if (!response.ok) continue;

        const manifest = await response.json();
        if (!Array.isArray(manifest.boards)) continue;

        for (const boardName of manifest.boards) {
          if (source.includes && !source.includes(boardName)) continue;

          const displayName = source.label?.[boardName] ?? boardName;

          if (!boards.has(displayName)) {
            boards.set(displayName, { name: displayName, file: boardName, supported_firmware: [] });
          }

          const asset = manifest.upstream?.assets?.[boardName];

          // Newest first, because the versions arrive in that order.
          boards.get(displayName)!.supported_firmware.push({
            version: version,
            path: `${basePath}/firmware/${source.slug}/${version}/${boardName}_factory.bin`,
            sha256: manifest.sha256?.[boardName],
            upstream:
              manifest.upstream && asset
                ? { repo: manifest.upstream.repo, tag: manifest.upstream.tag, asset }
                : undefined,
          });
        }
      } catch (error) {
        console.error(`Error loading the ${source.slug} manifest for ${version}:`, error);
      }
    }

    const loaded = Array.from(boards.values());
    return source.sort ? loaded.sort(source.sort) : loaded;
  };

  const loadAllBoards = async () => {
    const results = await Promise.all(DEVICE_SOURCES.map((source) => loadBoards(source)));

    const byDevice: Record<string, Board[]> = {};
    DEVICE_SOURCES.forEach((source, index) => {
      byDevice[source.device] = results[index];
    });

    setBoardsByDevice(byDevice);
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

    // Load every device's boards from its manifests
    loadAllBoards();
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

  // A device shows the boards its manifests advertise; the static entry in
  // firmware_data.json is only the fallback for a device with no manifests yet.
  const getDeviceData = () => {
    if (selectedDevice === '') return { boards: [] };

    const device = devices.find((d) => d.name == selectedDevice);
    if (!device) return { boards: [] };

    return { ...device, boards: boardsByDevice[device.name] ?? device.boards ?? [] };
  };

  const device = getDeviceData();
  const heroSource = sourceFor(selectedDevice);

  // The state of play, worked out from what is already known rather than
  // from reading the message back, which would not survive a translation.
  const finished = status !== '' && status === t('status.completed');
  const failed = status.startsWith(t('status.connectionFailed')) || status.startsWith('Error');
  const statusKind =
    isFlashing || isConnecting
      ? 'busy'
      : failed
        ? 'error'
        : finished
          ? 'done'
          : status
            ? 'info'
            : null;

  // Finishing a flash and being told nothing is the worst part of the old
  // flow: the device has just rebooted into something and you are on your own.
  const nextStep = !finished
    ? null
    : heroSource?.category === 'tools'
      ? 'Unplug it and plug it back in. To check the chip really holds this build, run the verify command from the project README.'
      : 'Unplug it and plug it back in. It will come up as its own WiFi access point: join that to set your pool and wallet.';
  const board =
    selectedBoardVersion !== ''
      ? device.boards.find((b) => b.name == selectedBoardVersion)!
      : { name: '', file: '', supported_firmware: [] };
  const firmware =
    selectedFirmware !== ''
      ? board.supported_firmware.find((f: any) => f.version == selectedFirmware)!
      : { path: '' };

  // Ask the chip what it is, so a device with more boards than anyone can
  // scan can narrow itself down. Reuses the open port when there is one and
  // gives it back untouched; otherwise it borrows one and hands it back.
  const detectChip = async (): Promise<Chip | null> => {
    const existing = serialPortRef.current;
    const port = existing ?? (await navigator.serial.requestPort());

    if (!existing) {
      await port.open({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
      });
    } else if (isLogging) {
      // esptool needs the raw streams, so stop reading them first
      await stopSerialLogging();
    }

    const transport = new Transport(port);
    const loader = new ESPLoader({
      transport,
      baudrate: 115200,
      romBaudrate: 115200,
      terminal: { clean() {}, writeLine() {}, write() {} },
    });

    try {
      const described = await loader.main();
      return chipFromEsptool(loader.chip?.CHIP_NAME ?? described ?? '');
    } finally {
      if (existing) {
        serialPortRef.current = port; // the user opened it on purpose, leave it
      } else {
        await transport.disconnect().catch(() => {});
      }
    }
  };

  // Confirm the bytes about to be written are the ones upstream published.
  //
  // Hashing the download against a hash this same site serves only proves the
  // transfer was clean: a site serving a bad file would serve a matching bad
  // hash. The check that means something is the second one, where the expected
  // hash is fetched from GitHub — the file comes from here, the answer comes
  // from somewhere else, and both would have to be compromised to agree.
  //
  // Only images we could match to a published asset carry that pointer.
  const verifyFirmware = async (bytes: ArrayBuffer, firmware: Firmware) => {
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (firmware.sha256 && digest !== firmware.sha256) {
      throw new Error(
        'The downloaded file does not match the hash recorded for it. Nothing was written.',
      );
    }

    if (!firmware.upstream) return { digest, upstream: null };

    const { repo, tag, asset } = firmware.upstream;

    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`);
      if (!response.ok) return { digest, upstream: null };

      const release = await response.json();
      const published = release.assets?.find((a: any) => a.name === asset);
      const expected = published?.digest?.replace(/^sha256:/, '');

      // GitHub not answering is not evidence of anything, so it is reported
      // as "not checked" rather than treated as a failure.
      if (!expected) return { digest, upstream: null };

      if (expected !== digest) {
        throw new Error(
          `This file does not match what ${repo} published as ${asset}. Nothing was written.`,
        );
      }

      return { digest, upstream: { repo, asset } };
    } catch (error) {
      if (error instanceof Error && error.message.includes(repo)) throw error;
      return { digest, upstream: null };
    }
  };

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
        `${t('status.connectionFailed')}: ${error instanceof Error ? error.message : String(error)}`,
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
        `${t('status.disconnectError')}: ${error instanceof Error ? error.message : String(error)}`,
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
        `${t('status.loggingError')}: ${error instanceof Error ? error.message : String(error)}`,
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

  const createNVSPartition = (
    entries: { key: string; value: string }[],
    hasStateNamespace: boolean = false,
  ): string => {
    // NVS partition structure for ESP32
    // NVS uses pages of 4096 bytes, first page is header
    const PAGE_SIZE = 4096;
    const NVS_SIZE = 0x6000; // 24KB NVS partition (3 pages)

    // Create empty NVS partition filled with 0xFF
    const nvsBuffer = new Uint8Array(NVS_SIZE);
    nvsBuffer.fill(0xff);

    // Page 0: NVS Header
    let offset = 0;

    // NVS Page Header (32 bytes)
    nvsBuffer[offset++] = 0xfe; // Page state: Active
    nvsBuffer[offset++] = 0xff;
    nvsBuffer[offset++] = 0xff;
    nvsBuffer[offset++] = 0xff;

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

      console.log(
        `Entry ${i + 1}: "${entry.key}" = "${entry.value}" (${keyBytes.length + valueBytes.length + 32} bytes)`,
      );

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
      nvsBuffer[offset++] = valueBytes.length & 0xff;
      nvsBuffer[offset++] = (valueBytes.length >> 8) & 0xff;

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

  const parseExistingNVS = (
    nvsData: Uint8Array,
  ): { hasStateNamespace: boolean; entries: { key: string; value: string }[] } => {
    const entries: { key: string; value: string }[] = [];
    let hasStateNamespace = false;

    // Skip NVS page header (32 bytes) and start reading entries
    let offset = 32;

    while (offset < nvsData.length - 32) {
      // Check if we're at an empty entry (all 0xFF)
      if (nvsData[offset] === 0xff) break;

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
    image.fill(0xff); // Estado borrado

    console.log(`Creating SPIFFS image with file: ${fileName}`);

    // SPIFFS Header Block (bloque 0)
    let offset = 0;

    // SPIFFS Magic numbers y configuración
    image[offset++] = 0x20;
    image[offset++] = 0x16; // Magic
    image[offset++] = 0x05;
    image[offset++] = 0x19; // Version

    // Configuración SPIFFS
    image[offset++] = (SPIFFS_PAGE_SIZE >> 0) & 0xff;
    image[offset++] = (SPIFFS_PAGE_SIZE >> 8) & 0xff;
    image[offset++] = (SPIFFS_BLOCK_SIZE >> 0) & 0xff;
    image[offset++] = (SPIFFS_BLOCK_SIZE >> 8) & 0xff;
    image[offset++] = (SPIFFS_BLOCK_SIZE >> 16) & 0xff;
    image[offset++] = (SPIFFS_BLOCK_SIZE >> 24) & 0xff;

    // Saltar al bloque 1 para datos
    offset = SPIFFS_BLOCK_SIZE;

    // Object Index Header (ID de archivo)
    const fileId = 1;
    image[offset++] = fileId & 0xff;
    image[offset++] = (fileId >> 8) & 0xff;

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
    image[offset++] = (fileSize >> 0) & 0xff;
    image[offset++] = (fileSize >> 8) & 0xff;
    image[offset++] = (fileSize >> 16) & 0xff;
    image[offset++] = (fileSize >> 24) & 0xff;

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
      const configAddress = 0x3f0000;

      console.log(`📝 Writing simple config data to safe area: 0x${configAddress.toString(16)}`);
      console.log(`This method is simple and safe - no SPIFFS complexity`);

      // Crear estructura simple: MARCA + JSON
      const configJson = { [key]: value };
      const jsonString = JSON.stringify(configJson);
      const marker = 'WEBFLASHER_CONFIG:';
      const fullData = marker + jsonString;

      console.log(`Config data: "${fullData}"`);
      console.log(`Total size: ${fullData.length} bytes`);

      // Convertir a binary string para esptool
      const dataBytes = new TextEncoder().encode(fullData);
      const binaryString = Array.from(dataBytes, (byte) => String.fromCharCode(byte)).join('');

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
        const readString = Array.from(readBytes.slice(0, fullData.length), (byte) =>
          String.fromCharCode(byte),
        ).join('');

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
    return (
      selectedBoardVersion === 'NERDMINERV2 ORIGINAL BOARD (TDISPLAY-S3)' ||
      selectedBoardVersion === 'ESP32-devKitv1' ||
      selectedBoardVersion === 'ESP32-S3-mini-wemos' ||
      selectedBoardVersion === 'ESP32-S3-devKitv1' ||
      selectedBoardVersion === 'esp32-s3-devkitc1-n32r8' ||
      selectedBoardVersion === 'ESP32-C3-devKitmv1' ||
      selectedBoardVersion === 'ESP32-D0WD-V3-weact'
    );
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
    if (selectedDevice === 'NerdMiner' && customAPName) {
      if (!validateSSID(apName)) {
        setStatus(
          'Invalid AP name. Must be 1-31 characters, no spaces, only letters, numbers, underscore and hyphen.',
        );
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

      // Every device resolves the same way now that a board remembers the file
      // it came from: the factory image at 0x0, or the firmware-only image at
      // 0x10000 when the user asked to keep their configuration.
      let firmwarePath: string;
      let flashAddress: number;

      const source = sourceFor(selectedDevice);
      const boardFile = (board as Board).file;

      if (source && boardFile) {
        const keeping = keepConfiguration && source.keepsConfiguration === true;
        const image = keeping ? 'firmware' : 'factory';
        firmwarePath = `${basePath}/firmware/${source.slug}/${selectedFirmware}/${boardFile}_${image}.bin`;
        flashAddress = keeping ? 0x10000 : 0x0000;
      } else {
        firmwarePath = firmware.path;
        flashAddress = 0;
      }

      const firmwareResponse = await fetch(firmwarePath);
      if (!firmwareResponse.ok) {
        throw new Error('Failed to load firmware file');
      }

      const firmwareArrayBuffer = await firmwareResponse.arrayBuffer();

      setStatus('Checking the firmware…');
      const checked = await verifyFirmware(firmwareArrayBuffer, firmware as Firmware);
      setVerification(checked);

      const firmwareUint8Array = new Uint8Array(firmwareArrayBuffer);
      const firmwareBinaryString = Array.from(firmwareUint8Array, (byte) =>
        String.fromCharCode(byte),
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
          setProgress(percent);
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
      if (
        selectedDevice === 'NerdMiner' &&
        customAPName &&
        apName &&
        validateSSID(apName) &&
        supportsCustomAPName()
      ) {
        setStatus('Writing custom AP name...');
        try {
          await flashSimpleConfig(loader, 'apname', apName);
          setStatus('Custom AP name written successfully');
        } catch (error) {
          console.warn('Failed to write custom AP name:', error);
          setStatus(
            'Warning: Failed to write custom AP name, but firmware was flashed successfully',
          );
        }
      }

      await loader.hardReset();
      setStatus(t('status.success'));
    } catch (error) {
      console.error('Flashing failed:', error);
      setStatus(
        `${t('status.flashingFailed')}: ${
          error instanceof Error ? error.message : String(error)
        }. Please try again.`,
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
    setVerification(null);
    // The checkbox is hidden for devices that ship no firmware-only image, so
    // leaving it ticked from a previous device would quietly ask for a file
    // that does not exist.
    setKeepConfiguration(false);
    setIsModalOpen(false);

    // A device paints the page behind it. Its own banner if it has one, the
    // NerdMiner keeps the picture it always had, everything else the default.
    // Doing it as a backdrop rather than a band costs no vertical space, which
    // is what was pushing the rest of the page below the fold.
    const source = sourceFor(name);
    const backdrop =
      source?.banner ??
      (name === 'NerdMiner' ? '/pictures/fondoNM3.png' : '/pictures/Bitronics_hw.png');

    const paint = (image: string) => {
      document.body.style.background = `linear-gradient(rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.85)), url('${basePath}${image}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    };

    // A banner that has not been added yet should not leave the page bare.
    const probe = new Image();
    probe.onload = () => paint(backdrop);
    probe.onerror = () => paint('/pictures/Bitronics_hw.png');
    probe.src = `${basePath}${backdrop}`;

    document.body.classList.remove('nerdminer-bg');
  };

  if (!isChromiumBased) {
    return (
      <div className="container px-4 md:px-6 py-12 text-center">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none mb-4">
          {t('errors.browserCompatibility.title')}
        </h1>
        <p className="mx-auto max-w-[700px] text-white/60 md:text-xl">
          {t('errors.browserCompatibility.description')}
        </p>
      </div>
    );
  }

  return (
    <>
      <Header onOpenPanel={() => setIsPanelOpen(true)} />
      {/* The hero always sits on a dark photograph, whatever the page theme is
          set to, so its contents always render in the dark palette. Without
          this the headline turns near-black on a near-black background. */}
      <section className="dark w-full py-10 text-white md:py-14">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center gap-8">
            {selectedDevice === '' ? (
              <div className="mb-10 space-y-2">
                <h1 className="font-display text-3xl font-bold tracking-tighter text-white sm:text-4xl md:text-5xl">
                  <Headline text={t('hero.title')} />
                </h1>
                <p className="mx-auto max-w-[700px] text-white/60 md:text-lg">
                  {t('hero.description')}
                </p>
              </div>
            ) : (
              <div className="mb-9 space-y-1">
                <p className="brand-kicker">
                  {heroSource?.intro?.kicker ?? heroSource?.tagline ?? selectedDevice}
                </p>
                <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {selectedDevice}
                </h1>
              </div>
            )}
            <div className="flex w-full max-w-4xl flex-col items-center justify-between gap-y-8 md:flex-row">
              <div className="flex flex-col justify-center w-52">
                {selectedDevice === '' ? (
                  <RadioReceiver
                    className="mb-3 m-auto h-14 w-14 md:h-16 md:w-16"
                    color="#6B7280"
                    strokeWidth={1}
                  />
                ) : (
                  <img
                    src={`${basePath}/${devices.find((d) => d.name === selectedDevice)?.picture}`}
                    alt={selectedDevice}
                    className="mb-3 m-auto h-14 w-14 object-contain md:h-16 md:w-16"
                  />
                )}
                <Button onClick={openModal} disabled={isConnecting || isFlashing}>
                  {selectedDevice === '' ? t('hero.selectDevice') : selectedDevice}
                </Button>
              </div>
              <div className="flex flex-col justify-center w-52">
                <Cpu
                  className="mb-3 m-auto h-14 w-14 md:h-16 md:w-16"
                  color="#6B7280"
                  strokeWidth={1}
                />
                <Button
                  onClick={() => setIsBoardPickerOpen(true)}
                  disabled={isConnecting || isFlashing || selectedDevice === ''}
                >
                  {selectedBoardVersion === '' ? t('hero.selectBoard') : selectedBoardVersion}
                </Button>
              </div>
              <div className="flex flex-col justify-center w-52">
                <GitCompareIcon
                  className="mb-3 m-auto h-14 w-14 md:h-16 md:w-16"
                  color="#6B7280"
                  strokeWidth={1}
                />
                <Selector
                  placeholder={t('hero.selectFirmware')}
                  values={board.supported_firmware.map((f: any) => f.version)}
                  onValueChange={setSelectedFirmware}
                  disabled={isConnecting || isFlashing || selectedBoardVersion === ''}
                  mono
                  markFirstAsLatest
                />
              </div>
            </div>

            {/* Only for devices that publish a firmware-only image */}
            {sourceFor(selectedDevice)?.keepsConfiguration && (
              <div className="flex flex-col items-center space-y-4 justify-center">
                <div className="flex items-center space-x-2 justify-center">
                  <input
                    type="checkbox"
                    id="keepConfiguration"
                    checked={keepConfiguration}
                    onChange={(e) => setKeepConfiguration(e.target.checked)}
                    className="w-4 h-4 accent-bitronics bg-gray-100 border-gray-300 rounded focus:ring-bitronics dark:focus:ring-bitronics dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label
                    htmlFor="keepConfiguration"
                    className="text-sm font-medium text-gray-900 dark:text-gray-300"
                  >
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
                      className="w-4 h-4 accent-bitronics bg-gray-100 border-gray-300 rounded focus:ring-bitronics dark:focus:ring-bitronics dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <label
                      htmlFor="customAPName"
                      className="text-sm font-medium text-gray-900 dark:text-gray-300"
                    >
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
                      className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitronics focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                    />
                    {apName && !validateSSID(apName) && (
                      <p className="text-xs text-red-500">
                        {apName.length > 31
                          ? 'Max 31 characters allowed'
                          : /\s/.test(apName)
                            ? 'No spaces allowed'
                            : !/^[a-zA-Z0-9_-]+$/.test(apName)
                              ? 'Only letters, numbers, underscore and hyphen allowed'
                              : 'Invalid AP name'}
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
                disabled={
                  isConnecting ||
                  isFlashing ||
                  !selectedDevice ||
                  !selectedBoardVersion ||
                  !selectedFirmware
                }
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
              <p className="mx-auto max-w-[400px] text-white/50 md:text-m">
                {t('hero.loggingDescription')}
              </p>
              {statusKind && (
                <div
                  className={`mx-auto mt-6 w-full max-w-md rounded-xl border p-4 text-left ${
                    statusKind === 'error'
                      ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10'
                      : statusKind === 'done'
                        ? 'border-[var(--color-success)]/40 bg-[var(--color-success)]/10'
                        : 'border-[var(--color-hairline)] bg-[var(--color-surface)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {statusKind === 'busy' && (
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[var(--color-bitronics)]" />
                    )}
                    {statusKind === 'done' && (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success)]" />
                    )}
                    {statusKind === 'error' && (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
                    )}
                    <p className="text-sm font-medium leading-snug text-white">{status}</p>
                  </div>

                  {isFlashing && progress !== null && (
                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[var(--color-bitronics)] transition-all duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}

                  {verification && (
                    <div className="mt-3 border-t border-white/10 pt-2.5">
                      {verification.upstream ? (
                        <p className="text-xs leading-relaxed text-white/60">
                          <span className="text-[var(--color-success)]">Verified.</span> This file
                          hashes to what{' '}
                          <span className="font-data">{verification.upstream.repo}</span> published
                          as <span className="font-data">{verification.upstream.asset}</span>. The
                          binary came from this site, the hash it was checked against came from
                          GitHub.
                        </p>
                      ) : (
                        <p className="text-xs leading-relaxed text-white/60">
                          The download matches the hash on file. The published release could not be
                          reached, so it was not cross-checked against it.
                        </p>
                      )}
                      <p className="font-data mt-1.5 break-all text-[10px] text-white/30">
                        {verification.digest}
                      </p>
                    </div>
                  )}

                  {nextStep && (
                    <p className="mt-2.5 text-xs leading-relaxed text-white/50">{nextStep}</p>
                  )}
                </div>
              )}
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

      {/* A device that has something to explain says it here, on a light band,
          right under the controls it belongs to. */}
      {heroSource?.intro && (
        <DeviceIntro
          intro={heroSource.intro}
          device={selectedDevice}
          picture={devices.find((d) => d.name === selectedDevice)?.picture}
          shop={heroSource.shop}
        />
      )}

      <InstructionPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
      <DeviceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectDevice={(name: string) => selectDevice(name)}
      />
      <BoardPicker
        isOpen={isBoardPickerOpen}
        onClose={() => setIsBoardPickerOpen(false)}
        source={sourceFor(selectedDevice)}
        boards={device.boards as Board[]}
        selected={selectedBoardVersion}
        onSelect={(board) => {
          setSelectedBoardVersion(board);
          setSelectedFirmware('');
          setVerification(null);
          setIsBoardPickerOpen(false);
        }}
        onDetect={sourceFor(selectedDevice)?.detectChip ? detectChip : undefined}
      />
    </>
  );
}
