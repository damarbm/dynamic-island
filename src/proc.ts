// Pure parsers for the /proc files we read. No GNOME imports, so they can be
// unit-tested with plain Node.

export interface CpuTimes {
    busy: number;
    total: number;
}

export interface MemInfo {
    totalBytes: number;
    availableBytes: number;
}

export interface NetCounters {
    rxBytes: number;
    txBytes: number;
}

/** Parses the aggregate "cpu" line of /proc/stat. */
export function parseCpuStat(text: string): CpuTimes | null {
    const line = text.split('\n').find(l => l.startsWith('cpu '));
    if (!line)
        return null;
    const f = line.trim().split(/\s+/).slice(1).map(Number);
    if (f.length < 4 || f.some(Number.isNaN))
        return null;
    // user nice system idle iowait irq softirq steal ...
    // guest and guest_nice are already included in user and nice.
    const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0, steal = 0] = f;
    const idleAll = idle + iowait;
    const total = user + nice + system + idleAll + irq + softirq + steal;
    return {busy: total - idleAll, total};
}

/** Parses MemTotal and MemAvailable (reported in kB) from /proc/meminfo. */
export function parseMemInfo(text: string): MemInfo | null {
    const read = (key: string): number | null => {
        const m = text.match(new RegExp(`^${key}:\\s+(\\d+)\\s*kB`, 'm'));
        return m ? Number(m[1]) * 1024 : null;
    };
    const totalBytes = read('MemTotal');
    const availableBytes = read('MemAvailable');
    if (totalBytes === null || availableBytes === null)
        return null;
    return {totalBytes, availableBytes};
}

/**
 * Finds the interface that carries the default route in /proc/net/route.
 * When several default routes exist, the one with the lowest metric wins.
 */
export function parseDefaultRouteInterface(text: string): string | null {
    let best: {iface: string; metric: number} | null = null;
    for (const line of text.split('\n').slice(1)) {
        const f = line.trim().split(/\s+/);
        if (f.length < 8)
            continue;
        const [iface, destination, , flags, , , metric, mask] = f;
        const isUp = (Number.parseInt(flags, 16) & 0x1) !== 0;
        if (destination !== '00000000' || mask !== '00000000' || !isUp)
            continue;
        const m = Number(metric);
        if (best === null || m < best.metric)
            best = {iface, metric: m};
    }
    return best ? best.iface : null;
}

/** Parses /proc/net/dev into per-interface byte counters. */
export function parseNetDev(text: string): Map<string, NetCounters> {
    const result = new Map<string, NetCounters>();
    for (const line of text.split('\n').slice(2)) {
        const colon = line.indexOf(':');
        if (colon < 0)
            continue;
        const iface = line.slice(0, colon).trim();
        const f = line.slice(colon + 1).trim().split(/\s+/).map(Number);
        if (f.length < 9 || f.some(Number.isNaN))
            continue;
        result.set(iface, {rxBytes: f[0], txBytes: f[8]});
    }
    return result;
}
