import GLib from 'gi://GLib';

import {
    parseCpuStat,
    parseDefaultRouteInterface,
    parseMemInfo,
    parseNetDev,
    type CpuTimes,
} from './proc.js';

export interface Snapshot {
    /** CPU usage, 0-100. */
    cpuPercent: number;
    /** RAM usage, 0-100. */
    ramPercent: number;
    ramUsedBytes: number;
    ramTotalBytes: number;
    /** Download and upload speed of the default-route interface, bytes per second. */
    netDownBps: number;
    netUpBps: number;
    /** Name of the default-route interface, or null when offline. */
    netInterface: string | null;
}

const EMPTY: Snapshot = {
    cpuPercent: 0,
    ramPercent: 0,
    ramUsedBytes: 0,
    ramTotalBytes: 0,
    netDownBps: 0,
    netUpBps: 0,
    netInterface: null,
};

interface Baseline {
    timeUs: number;
    cpu: CpuTimes | null;
    iface: string | null;
    rxBytes: number;
    txBytes: number;
}

const decoder = new TextDecoder();

function readProc(path: string): string | null {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        return ok ? decoder.decode(bytes) : null;
    } catch {
        return null;
    }
}

/**
 * Reads CPU, RAM and network usage from /proc. CPU and network are rates, so
 * each call to sample() reports the change since the previous call.
 */
export class Sampler {
    private _baseline: Baseline | null = null;
    private _last: Snapshot = {...EMPTY};

    /**
     * Forget the previous reading. Call after sampling was paused, so the first
     * sample after the pause does not average over the whole gap.
     */
    resetBaseline(): void {
        this._baseline = null;
    }

    sample(): Snapshot {
        const timeUs = GLib.get_monotonic_time();

        const cpu = parseCpuStat(readProc('/proc/stat') ?? '');
        const mem = parseMemInfo(readProc('/proc/meminfo') ?? '');
        const iface = parseDefaultRouteInterface(readProc('/proc/net/route') ?? '');
        const counters = iface ? parseNetDev(readProc('/proc/net/dev') ?? '').get(iface) : undefined;

        const next: Baseline = {
            timeUs,
            cpu,
            iface: counters ? iface : null,
            rxBytes: counters?.rxBytes ?? 0,
            txBytes: counters?.txBytes ?? 0,
        };

        const snapshot: Snapshot = {...this._last};

        if (mem) {
            snapshot.ramTotalBytes = mem.totalBytes;
            snapshot.ramUsedBytes = mem.totalBytes - mem.availableBytes;
            snapshot.ramPercent = (snapshot.ramUsedBytes / mem.totalBytes) * 100;
        }

        snapshot.netInterface = next.iface;

        const prev = this._baseline;
        if (prev) {
            if (cpu && prev.cpu && cpu.total > prev.cpu.total) {
                snapshot.cpuPercent = clamp(
                    ((cpu.busy - prev.cpu.busy) / (cpu.total - prev.cpu.total)) * 100, 0, 100);
            }

            const seconds = (timeUs - prev.timeUs) / 1_000_000;
            // A different interface (or none) means the counters are not comparable.
            if (next.iface !== null && next.iface === prev.iface && seconds > 0) {
                snapshot.netDownBps = Math.max(0, (next.rxBytes - prev.rxBytes) / seconds);
                snapshot.netUpBps = Math.max(0, (next.txBytes - prev.txBytes) / seconds);
            } else {
                snapshot.netDownBps = 0;
                snapshot.netUpBps = 0;
            }
        }

        this._baseline = next;
        this._last = snapshot;
        return snapshot;
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
