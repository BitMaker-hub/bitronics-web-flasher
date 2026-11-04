'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, Wifi } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Sets the WiFi of an Open Source Badge that already runs its firmware, with
 * nothing flashed. The badge takes its network over the serial port as one
 * line, `W<network>|<password>`, and reports what it holds when sent `i`, so
 * what ends up on screen is what the badge says it saved, not what was sent.
 */

type Props = {
  /** The port the page already has open. Without one, it asks for a port and gives it back. */
  port: any | null;
  disabled?: boolean;
};

type Saved = { number: string; firmware: string | null; network: string; withPassword: boolean };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The answer to `i` opens with "Badge #042 Name, firmware v1.0.0 (0d61bf7)" and
// further down says "  WiFi:  Network (con contraseña)". Builds older than
// 1.0.0 print no firmware, so that part is optional.
const HEADER = /Badge #(\d+)[^\r\n]*?(?:, firmware v(\S+) \(([^)]*)\))?\r?\n/;
const WIFI = /WiFi:\s+([^\r\n]*?)\r?\n/;

// The badge trims both fields and splits the line at the first bar, so
// anything that would not survive that is refused here instead.
function problemWith(network: string, password: string): string | null {
  if (!network) return 'Type the network name.';
  if (new TextEncoder().encode(network).length > 32) return 'A network name is 32 characters at most.';
  if (network.includes('|')) return 'The badge cannot take a network name with a | in it.';
  if (password !== password.trim())
    return 'The badge drops spaces at the start and end of a password, so this one would not match.';
  if (password && (password.length < 8 || password.length > 63))
    return 'A WiFi password is 8 to 63 characters, or empty for an open network.';
  return null;
}

export default function BadgeWifi({ port: openPort, disabled }: Props) {
  const [network, setNetwork] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);

  const write = async () => {
    const name = network.trim();
    const problem = problemWith(name, password);
    setSaved(null);
    setError(problem);
    if (problem) return;

    setBusy(true);
    let port = openPort;
    const borrowed = !port;
    let text = '';
    let reader: ReadableStreamDefaultReader<string> | null = null;
    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    let piped: Promise<void> | null = null;

    try {
      if (borrowed) {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
      } else if (port.readable?.locked || port.writable?.locked) {
        throw new Error('The port is still held by the last flash. Press Disconnect above and try again.');
      }

      const decoder = new TextDecoderStream();
      piped = port.readable.pipeTo(decoder.writable).catch(() => {});
      reader = decoder.readable.getReader();
      writer = port.writable.getWriter();
      (async () => {
        try {
          for (;;) {
            const { value, done } = await reader!.read();
            if (done) break;
            text += value;
          }
        } catch {
          // Cancelled on the way out
        }
      })();

      const encoder = new TextEncoder();
      const send = (line: string) => writer!.write(encoder.encode(line));

      // Asks again every so often, because a badge that is still booting
      // drops whatever reaches it before it is listening.
      const waitFor = async (pattern: RegExp, ms: number, ask: string) => {
        const end = Date.now() + ms;
        let next = 0;
        while (Date.now() < end) {
          const match = text.match(pattern);
          if (match) return match;
          if (Date.now() >= next) {
            await send(ask);
            next = Date.now() + 1500;
          }
          await sleep(100);
        }
        return null;
      };

      // Opening the port can reboot the badge, so it is given time to come up.
      setStep('Waiting for the badge to answer…');
      let header = await waitFor(HEADER, 6000, 'i');
      if (!header) {
        // Still silent: it may be sitting in its bootloader. Restart it into
        // the firmware, with BOOT released, and ask again.
        await port.setSignals({ dataTerminalReady: false, requestToSend: true });
        await sleep(100);
        await port.setSignals({ dataTerminalReady: false, requestToSend: false });
        header = await waitFor(HEADER, 14000, 'i');
      }
      if (!header)
        throw new Error(
          'No badge answered on this port. Check it is an Open Source Badge running its firmware and try again.',
        );

      setStep('Saving the network…');
      await send(`W${name}|${password}\n`);
      await sleep(800);

      // The proof is the badge reading it back, not the line having gone out.
      text = '';
      const answer = await waitFor(new RegExp(HEADER.source + '[\\s\\S]*?' + WIFI.source), 5000, 'i');
      if (!answer) throw new Error('The badge stopped answering before it confirmed the network.');

      const reply = answer[0].slice(answer[0].lastIndexOf('WiFi:'));
      const reported = reply.match(WIFI)?.[1] ?? '';
      const withPassword = reported.startsWith(`${name} (`);
      if (reported !== name && !withPassword)
        throw new Error(`The badge did not keep the network. It reports: ${reported || 'nothing'}.`);
      if (withPassword !== password.length > 0)
        throw new Error(
          password ? 'The badge kept the network but not its password.' : 'The badge still holds an old password.',
        );

      setSaved({
        number: answer[1],
        firmware: answer[2] ? `v${answer[2]} (${answer[3]})` : null,
        network: name,
        withPassword,
      });
    } catch (e) {
      // Closing the port picker is a change of mind, not a failure.
      if (!(e instanceof DOMException && e.name === 'NotFoundError'))
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      try {
        writer?.releaseLock();
      } catch {}
      try {
        await reader?.cancel();
      } catch {}
      if (piped) await piped;
      if (borrowed && port) {
        try {
          await port.close();
        } catch {}
      }
      setBusy(false);
      setStep('');
    }
  };

  const field =
    'w-full rounded-md border border-[var(--color-hairline)] bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-bitronics';

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-5 text-left">
      <div className="flex items-center gap-2">
        <Wifi className="h-4 w-4 text-bitronics" />
        <h2 className="text-sm font-semibold text-white">Already flashed? Just set its WiFi</h2>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-white/50">
        Writes the network straight to a badge running its firmware. Nothing is flashed and
        nothing else changes: the profile, the wallet and the people met stay as they are.
      </p>

      <div className="mt-4 space-y-2.5">
        <input
          type="text"
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          placeholder="Network name"
          autoComplete="off"
          spellCheck={false}
          className={field}
          disabled={busy}
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (empty for an open network)"
            autoComplete="off"
            spellCheck={false}
            className={`${field} pr-10`}
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-white/40 hover:text-white/70"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button className="mt-4 w-full" onClick={write} disabled={busy || disabled || !network.trim()}>
        {busy ? step : 'Write WiFi to the badge'}
        {busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Wifi className="ml-2 h-4 w-4" />}
      </Button>

      <p className="mt-2.5 text-[11px] leading-relaxed text-white/40">
        2.4 GHz only. A network that opens a login page before letting you online will not work.
      </p>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-white/80">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-[var(--color-danger)]" />
          {error}
        </div>
      )}

      {saved && (
        <div className="mt-3 rounded-lg border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-success)]" />
            <span className="text-sm font-semibold text-white">
              Saved on badge <span className="font-data">#{saved.number}</span>
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            It joins <span className="font-data">{saved.network}</span>
            {saved.withPassword ? ' with its password' : ' as an open network'}
            {saved.firmware && (
              <>
                , running firmware <span className="font-data">{saved.firmware}</span>
              </>
            )}
            . Plug in the next badge and press again: the fields stay filled.
          </p>
        </div>
      )}
    </div>
  );
}
