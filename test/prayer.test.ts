import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
    isPrayerHighLatitudeRuleId,
    isPrayerMadhabId,
    isPrayerMethodId,
    type PrayerConfig,
} from '../src/prayer/config.ts';
import {
    calculatePrayerSchedule,
    formatPrayerTime,
    nextPrayerId,
    selectPrayerDisplay,
} from '../src/prayer/schedule.ts';

const JAKARTA: PrayerConfig = {
    configured: true,
    latitude: -6.2,
    longitude: 106.816666,
    method: 'muslim-world-league',
    madhab: 'shafi',
    highLatitudeRule: 'middle-of-night',
};
const DATE = new Date(2026, 9, 31, 12);

test('calculates a stable offline schedule', () => {
    const schedule = calculatePrayerSchedule(JAKARTA, DATE);
    assert.ok(schedule);
    assert.deepEqual(schedule.entries.map(entry => entry.time.toISOString()), [
        '2026-10-30T21:15:00.000Z',
        '2026-10-30T22:27:00.000Z',
        '2026-10-31T04:37:00.000Z',
        '2026-10-31T07:52:00.000Z',
        '2026-10-31T10:46:00.000Z',
        '2026-10-31T11:54:00.000Z',
    ]);
    for (let i = 1; i < schedule.entries.length; i++)
        assert.ok(schedule.entries[i].time > schedule.entries[i - 1].time);
});

test('madhab and calculation method affect the schedule', () => {
    const shafi = calculatePrayerSchedule(JAKARTA, DATE);
    const hanafi = calculatePrayerSchedule({...JAKARTA, madhab: 'hanafi'}, DATE);
    const singapore = calculatePrayerSchedule({...JAKARTA, method: 'singapore'}, DATE);
    assert.ok(shafi && hanafi && singapore);
    assert.ok(hanafi.entries[3].time > shafi.entries[3].time);
    assert.notEqual(singapore.entries[0].time.getTime(), shafi.entries[0].time.getTime());
});

test('handles unconfigured and invalid coordinates', () => {
    assert.equal(calculatePrayerSchedule({...JAKARTA, configured: false}, DATE), null);
    assert.equal(calculatePrayerSchedule({...JAKARTA, latitude: 91}, DATE), null);
    assert.equal(calculatePrayerSchedule({...JAKARTA, longitude: Number.NaN}, DATE), null);
});

test('resolves high-latitude schedules and finds the next actual prayer', () => {
    const schedule = calculatePrayerSchedule({
        ...JAKARTA,
        latitude: 69.6492,
        longitude: 18.9553,
        highLatitudeRule: 'seventh-of-night',
    }, new Date(2026, 5, 21, 12));
    assert.ok(schedule);
    assert.equal(schedule.entries.every(entry => Number.isFinite(entry.time.getTime())), true);
    assert.equal(nextPrayerId(schedule, new Date(schedule.entries[0].time.getTime() - 1)), 'fajr');
    assert.equal(nextPrayerId(schedule, schedule.entries[0].time), 'dhuhr');
    assert.equal(nextPrayerId(schedule, new Date(schedule.entries[5].time.getTime() + 1)), null);
});

test('advances to tomorrow after the final prayer', () => {
    const today = calculatePrayerSchedule(JAKARTA, DATE);
    const tomorrow = calculatePrayerSchedule(JAKARTA, new Date(2026, 10, 1, 12));
    assert.ok(today && tomorrow);
    const display = selectPrayerDisplay(
        today,
        tomorrow,
        new Date(today.entries[5].time.getTime() + 1),
    );
    assert.equal(display.schedule?.dateKey, '2026-11-01');
    assert.equal(display.nextId, 'fajr');
});

test('formats prayer times in an explicit time zone across DST', () => {
    assert.equal(formatPrayerTime(new Date('2026-01-15T12:00:00Z'), 'America/New_York'), '07:00');
    assert.equal(formatPrayerTime(new Date('2026-07-15T12:00:00Z'), 'America/New_York'), '08:00');
});

test('rejects unknown stored prayer options', () => {
    assert.equal(isPrayerMethodId('unknown'), false);
    assert.equal(isPrayerMadhabId('unknown'), false);
    assert.equal(isPrayerHighLatitudeRuleId('unknown'), false);
});
