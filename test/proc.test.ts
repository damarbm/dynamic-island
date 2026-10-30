import assert from 'node:assert/strict';
import {test} from 'node:test';

import {formatBytes, formatPercent, formatSpeed, formatTime} from '../src/util/format.ts';
import {RingBuffer} from '../src/metrics/history.ts';
import {
    parseCpuStat,
    parseDefaultRouteInterface,
    parseMemInfo,
    parseNetDev,
} from '../src/metrics/proc.ts';

test('parseCpuStat splits busy from idle time', () => {
    const t = parseCpuStat('cpu  100 10 50 800 40 5 5 0 0 0\ncpu0 1 1 1 1 1 1 1 0 0 0\n');
    assert.deepEqual(t, {busy: 170, total: 1010});
});

test('parseCpuStat rejects garbage', () => {
    assert.equal(parseCpuStat(''), null);
    assert.equal(parseCpuStat('cpu  a b c d\n'), null);
});

test('parseMemInfo converts kB to bytes', () => {
    const m = parseMemInfo('MemTotal:       2048 kB\nMemFree:  1 kB\nMemAvailable:   1024 kB\n');
    assert.deepEqual(m, {totalBytes: 2048 * 1024, availableBytes: 1024 * 1024});
    assert.equal(parseMemInfo('MemTotal: 1 kB\n'), null);
});

const ROUTE = [
    'Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT',
    'tun0\t00000000\t0100000A\t0003\t0\t0\t50\t00000000\t0\t0\t0',
    'wlp2s0\t00000000\t0100A8C0\t0003\t0\t0\t600\t00000000\t0\t0\t0',
    'enp3s0\t00000000\t0100A8C0\t0003\t0\t0\t100\t00000000\t0\t0\t0',
    'docker0\t000011AC\t00000000\t0001\t0\t0\t0\t0000FFFF\t0\t0\t0',
].join('\n');

test('parseDefaultRouteInterface picks the lowest-metric default route', () => {
    assert.equal(parseDefaultRouteInterface(ROUTE), 'tun0');
});

test('parseDefaultRouteInterface ignores non-default and down routes', () => {
    const route = [
        'Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT',
        'docker0\t000011AC\t00000000\t0001\t0\t0\t0\t0000FFFF\t0\t0\t0',
        'wlp2s0\t00000000\t0100A8C0\t0002\t0\t0\t600\t00000000\t0\t0\t0',
    ].join('\n');
    assert.equal(parseDefaultRouteInterface(route), null);
    assert.equal(parseDefaultRouteInterface('Iface\tDestination\n'), null);
});

test('parseNetDev reads rx and tx bytes per interface', () => {
    const dev = [
        'Inter-|   Receive                                                |  Transmit',
        ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
        '    lo:    10       1    0    0    0     0          0         0       10       1    0    0    0     0       0          0',
        'wlp2s0: 123456     100    0    0    0     0          0         0   654321     90    0    0    0     0       0          0',
    ].join('\n');
    const m = parseNetDev(dev);
    assert.deepEqual(m.get('wlp2s0'), {rxBytes: 123456, txBytes: 654321});
    assert.deepEqual(m.get('lo'), {rxBytes: 10, txBytes: 10});
});

test('RingBuffer keeps the newest values', () => {
    const b = new RingBuffer(3);
    for (const v of [1, 2, 3, 4, 5])
        b.push(v);
    assert.deepEqual([...b.toArray()], [3, 4, 5]);
    assert.equal(b.length, 3);
});

test('formatters', () => {
    assert.equal(formatPercent(12.4), '12%');
    assert.equal(formatSpeed(0), '0 B/s');
    assert.equal(formatSpeed(1536), '1.5 KB/s');
    assert.equal(formatSpeed(12 * 1024 * 1024), '12 MB/s');
    assert.equal(formatBytes(5.1 * 1024 ** 3), '5.1 GB');
    assert.equal(formatTime(new Date(2026, 9, 26, 7, 5)), '07:05');
});
