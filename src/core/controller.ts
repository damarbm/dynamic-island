import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {RingBuffer} from '../metrics/history.js';
import {Sampler, type Snapshot} from '../metrics/sampler.js';
import {
    isPrayerHighLatitudeRuleId,
    isPrayerMadhabId,
    isPrayerMethodId,
    type PrayerConfig,
} from '../prayer/config.js';
import {
    calculatePrayerSchedule,
    localDateKey,
    selectPrayerDisplay,
    type PrayerSchedule,
    systemTimeZone,
} from '../prayer/schedule.js';
import {Island} from '../ui/island.js';
import {formatBytes, formatDate, formatPercent, formatSpeed, formatTime} from '../util/format.js';

/** The Pill refreshes this often while the Island is collapsed. */
const COLLAPSED_INTERVAL_MS = 2000;
/** The Expanded View refreshes this often while it is open. */
const EXPANDED_INTERVAL_MS = 1000;
/** History is recorded once per collapsed interval, however fast we sample. */
const HISTORY_INTERVAL_MS = COLLAPSED_INTERVAL_MS;
/** 2 minutes of History. */
const HISTORY_CAPACITY = 60;

type PillMetric = 'cpu' | 'ram' | 'network';

const CPU_COLOR: [number, number, number] = [0.35, 0.75, 1.0];
const RAM_COLOR: [number, number, number] = [0.68, 0.55, 1.0];
const DOWN_COLOR: [number, number, number] = [0.4, 0.9, 0.55];
const UP_COLOR: [number, number, number] = [1.0, 0.7, 0.3];

/**
 * Owns sampling, History and the Island view. Sampling only runs while the
 * screen is visible: it stops when the screen is locked or blanked.
 */
export class Controller {
    private readonly _sampler = new Sampler();
    private readonly _island: Island;

    private readonly _cpu = new RingBuffer(HISTORY_CAPACITY);
    private readonly _ram = new RingBuffer(HISTORY_CAPACITY);
    private readonly _down = new RingBuffer(HISTORY_CAPACITY);
    private readonly _up = new RingBuffer(HISTORY_CAPACITY);
    private _lastHistoryMs = 0;
    private _last: Snapshot;

    private _timeoutId = 0;
    private _screenSaverSubscription = 0;
    private _settingsChangedId = 0;
    private _prayerSettingsChangedIds: number[] = [];
    private _prayerSchedule: PrayerSchedule | null = null;
    private _tomorrowPrayerSchedule: PrayerSchedule | null = null;
    private _prayerCacheKey = '';

    constructor(private readonly _settings: Gio.Settings) {
        this._island = new Island({
            historyCapacity: HISTORY_CAPACITY,
            onExpandedChanged: () => {
                // Switch refresh rate right away, and show fresh numbers immediately.
                if (this._timeoutId) {
                    this._tick();
                    this._schedule();
                }
            },
        });

        this._last = this._sampler.sample();
        this._render();

        this._settingsChangedId = this._settings.connect('changed::pill-metric', () => this._render());
        const prayerSettingsChanged = () => this._render();
        for (const key of [
            'prayer-location-configured',
            'prayer-location-name',
            'prayer-latitude',
            'prayer-longitude',
            'prayer-calculation-method',
            'prayer-madhab',
            'prayer-high-latitude-rule',
        ]) {
            this._prayerSettingsChangedIds.push(
                this._settings.connect(`changed::${key}`, prayerSettingsChanged),
            );
        }
        this._screenSaverSubscription = Gio.DBus.session.signal_subscribe(
            null,
            'org.gnome.ScreenSaver',
            'ActiveChanged',
            '/org/gnome/ScreenSaver',
            null,
            Gio.DBusSignalFlags.NONE,
            (_conn, _sender, _path, _iface, _signal, params) => {
                const [active] = params.deepUnpack() as [boolean];
                if (active)
                    this._pause();
                else
                    this._resume();
            },
        );

        this._schedule();
    }

    destroy(): void {
        this._pause();
        if (this._screenSaverSubscription) {
            Gio.DBus.session.signal_unsubscribe(this._screenSaverSubscription);
            this._screenSaverSubscription = 0;
        }
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }
        for (const id of this._prayerSettingsChangedIds)
            this._settings.disconnect(id);
        this._prayerSettingsChangedIds = [];
        this._island.destroy();
    }

    private _schedule(): void {
        this._unschedule();
        const interval = this._island.expanded ? EXPANDED_INTERVAL_MS : COLLAPSED_INTERVAL_MS;
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        });
    }

    private _unschedule(): void {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }
    }

    private _pause(): void {
        this._unschedule();
    }

    private _resume(): void {
        if (this._timeoutId)
            return;
        // Rates measured across the time the screen was off would be meaningless.
        this._sampler.resetBaseline();
        this._sampler.sample();
        this._render();
        this._schedule();
    }

    private _tick(): void {
        this._last = this._sampler.sample();

        const nowMs = GLib.get_monotonic_time() / 1000;
        // Allow a little jitter so a 2s timer does not skip every other record.
        if (nowMs - this._lastHistoryMs >= HISTORY_INTERVAL_MS - 100) {
            this._lastHistoryMs = nowMs;
            this._cpu.push(this._last.cpuPercent);
            this._ram.push(this._last.ramPercent);
            this._down.push(this._last.netDownBps);
            this._up.push(this._last.netUpBps);
        }

        this._render();
    }

    private _render(): void {
        const s = this._last;

        const now = new Date();
        this._island.setPill(`${formatDate(now)} · ${formatTime(now)}`, this._pillMetricText(s));
        this._renderPrayer(now);

        this._island.setRow('cpu', formatPercent(s.cpuPercent), [
            {values: this._cpu.toArray(), color: CPU_COLOR, fill: true},
        ]);
        this._island.setRow('ram',
            `${formatBytes(s.ramUsedBytes)} / ${formatBytes(s.ramTotalBytes)}  ${formatPercent(s.ramPercent)}`, [
                {values: this._ram.toArray(), color: RAM_COLOR, fill: true},
            ]);
        this._island.setRow('network',
            `↓ ${formatSpeed(s.netDownBps)}   ↑ ${formatSpeed(s.netUpBps)}`, [
                {values: this._down.toArray(), color: DOWN_COLOR, fill: true},
                {values: this._up.toArray(), color: UP_COLOR, fill: false},
            ]);
    }

    private _renderPrayer(now: Date): void {
        const config = this._prayerConfig();
        const timeZone = systemTimeZone();
        const cacheKey = JSON.stringify([
            localDateKey(now),
            timeZone,
            config.configured,
            config.latitude,
            config.longitude,
            config.method,
            config.madhab,
            config.highLatitudeRule,
        ]);
        if (cacheKey !== this._prayerCacheKey) {
            this._prayerCacheKey = cacheKey;
            this._prayerSchedule = calculatePrayerSchedule(config, now);
            const tomorrow = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + 1,
                12,
            );
            this._tomorrowPrayerSchedule = calculatePrayerSchedule(config, tomorrow);
        }
        const display = selectPrayerDisplay(
            this._prayerSchedule,
            this._tomorrowPrayerSchedule,
            now,
        );
        this._island.setPrayerSchedule(
            display.schedule,
            display.nextId,
            timeZone,
            now,
            this._settings.get_string('prayer-location-name'),
        );
    }

    private _prayerConfig(): PrayerConfig {
        const method = this._settings.get_string('prayer-calculation-method');
        const madhab = this._settings.get_string('prayer-madhab');
        const highLatitudeRule = this._settings.get_string('prayer-high-latitude-rule');
        return {
            configured: this._settings.get_boolean('prayer-location-configured'),
            latitude: this._settings.get_double('prayer-latitude'),
            longitude: this._settings.get_double('prayer-longitude'),
            method: isPrayerMethodId(method) ? method : 'muslim-world-league',
            madhab: isPrayerMadhabId(madhab) ? madhab : 'shafi',
            highLatitudeRule: isPrayerHighLatitudeRuleId(highLatitudeRule)
                ? highLatitudeRule
                : 'middle-of-night',
        };
    }

    private _pillMetricText(s: Snapshot): string {
        switch (this._settings.get_string('pill-metric') as PillMetric) {
        case 'ram':
            return `RAM ${formatPercent(s.ramPercent)}`;
        case 'network':
            return `↓ ${formatSpeed(s.netDownBps)}`;
        case 'cpu':
        default:
            return `CPU ${formatPercent(s.cpuPercent)}`;
        }
    }
}
