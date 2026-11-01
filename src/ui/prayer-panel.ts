import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {
    formatPrayerTime,
    type PrayerId,
    type PrayerSchedule,
} from '../prayer/schedule.js';

interface PrayerRow {
    actor: St.BoxLayout;
    label: St.Label;
    next: St.Label;
    time: St.Label;
}

export class PrayerPanel {
    readonly actor: St.BoxLayout;

    private readonly _date: St.Label;
    private readonly _location: St.Label;
    private readonly _setup: St.BoxLayout;
    private readonly _schedule: St.BoxLayout;
    private readonly _rows = new Map<PrayerId, PrayerRow>();

    constructor() {
        const title = new St.Label({
            text: 'Prayer Times',
            style_class: 'dynamic-island-prayer-title',
        });
        this._date = new St.Label({style_class: 'dynamic-island-prayer-date'});
        this._location = new St.Label({style_class: 'dynamic-island-prayer-location'});

        this._setup = new St.BoxLayout({
            style_class: 'dynamic-island-prayer-setup',
            accessible_name: 'Prayer location is not configured. Open extension preferences to set coordinates.',
            accessible_role: Atk.Role.STATUSBAR,
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        });
        this._setup.add_child(new St.Icon({
            icon_name: 'find-location-symbolic',
            icon_size: 32,
            x_align: Clutter.ActorAlign.CENTER,
        }));
        this._setup.add_child(new St.Label({
            text: 'Set your location in Preferences',
            x_align: Clutter.ActorAlign.CENTER,
        }));

        this._schedule = new St.BoxLayout({
            style_class: 'dynamic-island-prayer-list',
            vertical: true,
            visible: false,
        });
        for (const id of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
            const label = new St.Label({
                style_class: 'dynamic-island-prayer-name',
                x_expand: true,
            });
            const next = new St.Label({
                text: 'Next',
                style_class: 'dynamic-island-prayer-next-label',
                visible: false,
            });
            const time = new St.Label({style_class: 'dynamic-island-prayer-time'});
            const row = new St.BoxLayout({
                style_class: 'dynamic-island-prayer-row',
                accessible_role: Atk.Role.SECTION,
            });
            row.add_child(label);
            row.add_child(next);
            row.add_child(time);
            this._rows.set(id, {actor: row, label, next, time});
            this._schedule.add_child(row);
        }

        this.actor = new St.BoxLayout({
            style_class: 'dynamic-island-prayer',
            accessible_name: 'Prayer Times',
            accessible_role: Atk.Role.PANEL,
            vertical: true,
            x_expand: true,
            y_expand: true,
        });
        this.actor.add_child(title);
        this.actor.add_child(this._location);
        this.actor.add_child(this._date);
        this.actor.add_child(this._setup);
        this.actor.add_child(this._schedule);
    }

    setSchedule(
        schedule: PrayerSchedule | null,
        nextId: PrayerId | null,
        timeZone: string,
        now: Date,
        locationName: string,
    ): void {
        if (!schedule) {
            this._location.text = '';
            this._date.text = '';
            this._setup.show();
            this._schedule.hide();
            return;
        }

        const scheduleDate = schedule.entries.find(entry => entry.id === 'dhuhr')?.time ?? now;
        this._location.text = locationName;
        this._date.text = new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            timeZone,
        }).format(scheduleDate);
        this._setup.hide();
        this._schedule.show();

        for (const entry of schedule.entries) {
            const row = this._rows.get(entry.id);
            if (!row)
                continue;
            const isNext = entry.id === nextId;
            const time = formatPrayerTime(entry.time, timeZone);
            row.label.text = entry.label;
            row.time.text = time;
            row.next.visible = isNext;
            row.actor.accessible_name = `${entry.label}, ${time}${isNext ? ', next prayer' : ''}`;
            if (isNext)
                row.actor.add_style_class_name('dynamic-island-prayer-next');
            else
                row.actor.remove_style_class_name('dynamic-island-prayer-next');
        }
    }
}
