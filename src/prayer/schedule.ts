import {
    CalculationMethod,
    Coordinates,
    HighLatitudeRule,
    Madhab,
    PolarCircleResolution,
    PrayerTimes,
} from 'adhan';
import type {CalculationParameters} from 'adhan';

import type {
    PrayerConfig,
    PrayerHighLatitudeRuleId,
    PrayerMethodId,
} from './config.js';

export const PRAYER_IDS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerId = typeof PRAYER_IDS[number];

export interface PrayerEntry {
    id: PrayerId;
    label: string;
    time: Date;
}

export interface PrayerSchedule {
    dateKey: string;
    entries: PrayerEntry[];
}

export interface PrayerDisplay {
    schedule: PrayerSchedule | null;
    nextId: PrayerId | null;
}

const LABELS: Record<PrayerId, string> = {
    fajr: 'Fajr',
    sunrise: 'Sunrise',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
};

const METHOD_FACTORIES: Record<PrayerMethodId, () => ReturnType<typeof CalculationMethod.Other>> = {
    'muslim-world-league': CalculationMethod.MuslimWorldLeague,
    egyptian: CalculationMethod.Egyptian,
    karachi: CalculationMethod.Karachi,
    'umm-al-qura': CalculationMethod.UmmAlQura,
    dubai: CalculationMethod.Dubai,
    qatar: CalculationMethod.Qatar,
    kuwait: CalculationMethod.Kuwait,
    'moonsighting-committee': CalculationMethod.MoonsightingCommittee,
    singapore: CalculationMethod.Singapore,
    turkey: CalculationMethod.Turkey,
    tehran: CalculationMethod.Tehran,
    'north-america': CalculationMethod.NorthAmerica,
};

const HIGH_LATITUDE_RULES: Record<PrayerHighLatitudeRuleId, CalculationParameters['highLatitudeRule']> = {
    'middle-of-night': HighLatitudeRule.MiddleOfTheNight,
    'seventh-of-night': HighLatitudeRule.SeventhOfTheNight,
    'twilight-angle': HighLatitudeRule.TwilightAngle,
};

export function localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function systemTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function formatPrayerTime(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone,
    }).format(date);
}

export function calculatePrayerSchedule(config: PrayerConfig, date: Date): PrayerSchedule | null {
    if (!config.configured ||
        !Number.isFinite(config.latitude) ||
        !Number.isFinite(config.longitude) ||
        config.latitude < -90 ||
        config.latitude > 90 ||
        config.longitude < -180 ||
        config.longitude > 180)
        return null;

    const parameters = METHOD_FACTORIES[config.method]();
    parameters.madhab = config.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
    parameters.highLatitudeRule = HIGH_LATITUDE_RULES[config.highLatitudeRule];
    parameters.polarCircleResolution = PolarCircleResolution.AqrabBalad;

    const times = new PrayerTimes(
        new Coordinates(config.latitude, config.longitude),
        date,
        parameters,
    );
    const entries = PRAYER_IDS.map(id => ({
        id,
        label: LABELS[id],
        time: times[id],
    }));
    if (entries.some(entry => Number.isNaN(entry.time.getTime())))
        return null;

    return {dateKey: localDateKey(date), entries};
}

export function nextPrayerId(schedule: PrayerSchedule, now: Date): PrayerId | null {
    return schedule.entries.find(entry => entry.id !== 'sunrise' && entry.time > now)?.id ?? null;
}

export function selectPrayerDisplay(
    today: PrayerSchedule | null,
    tomorrow: PrayerSchedule | null,
    now: Date,
): PrayerDisplay {
    if (!today)
        return {schedule: null, nextId: null};

    const nextId = nextPrayerId(today, now);
    if (nextId)
        return {schedule: today, nextId};

    return tomorrow
        ? {schedule: tomorrow, nextId: 'fajr'}
        : {schedule: today, nextId: null};
}
