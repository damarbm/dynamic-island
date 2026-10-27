import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKS_SHOWN = 6;

/**
 * A month calendar like the one in the default date menu: the full date on
 * top, a month header with previous/next buttons, and a Sunday-first grid
 * with today highlighted.
 */
export class Calendar {
    readonly actor: St.BoxLayout;

    private readonly _weekday: St.Label;
    private readonly _fullDate: St.Label;
    private readonly _monthLabel: St.Label;
    private readonly _cells: {circle: St.Bin; label: St.Label}[] = [];
    /** First day of the month being shown. */
    private _shown: GLib.DateTime;

    constructor() {
        this._shown = Calendar._firstOfMonth(GLib.DateTime.new_now_local());

        this._weekday = new St.Label({style_class: 'dynamic-island-cal-weekday'});
        this._fullDate = new St.Label({style_class: 'dynamic-island-cal-date'});

        const prev = this._navButton('‹', -1);
        const next = this._navButton('›', 1);
        this._monthLabel = new St.Label({
            style_class: 'dynamic-island-cal-month',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const nav = new St.BoxLayout({style_class: 'dynamic-island-cal-nav'});
        nav.add_child(prev);
        nav.add_child(this._monthLabel);
        nav.add_child(next);

        const grid = new St.BoxLayout({style_class: 'dynamic-island-cal-grid', vertical: true});
        grid.add_child(this._buildRow(WEEKDAY_LETTERS, 'dynamic-island-cal-header'));
        for (let week = 0; week < WEEKS_SHOWN; week++) {
            const row = new St.BoxLayout({style_class: 'dynamic-island-cal-row'});
            for (let day = 0; day < 7; day++) {
                // The circle is a fixed-size Bin with the number centered inside it.
                // Sizing the label itself would pin its text to the top left.
                const label = new St.Label({
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                });
                const circle = new St.Bin({
                    style_class: 'dynamic-island-cal-day',
                    x_align: Clutter.ActorAlign.CENTER,
                    child: label,
                });
                const cell = new St.Bin({x_expand: true, child: circle});
                this._cells.push({circle, label});
                row.add_child(cell);
            }
            grid.add_child(row);
        }

        this.actor = new St.BoxLayout({style_class: 'dynamic-island-calendar', vertical: true});
        this.actor.add_child(this._weekday);
        this.actor.add_child(this._fullDate);
        this.actor.add_child(nav);
        this.actor.add_child(grid);

        this._render();
    }

    /** Jump back to the current month and refresh today's highlight. */
    reset(): void {
        this._shown = Calendar._firstOfMonth(GLib.DateTime.new_now_local());
        this._render();
    }

    private static _firstOfMonth(date: GLib.DateTime): GLib.DateTime {
        return GLib.DateTime.new_local(date.get_year(), date.get_month(), 1, 0, 0, 0) ?? date;
    }

    private _navButton(label: string, delta: number): St.Button {
        const button = new St.Button({
            label,
            style_class: 'dynamic-island-cal-button',
            can_focus: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        button.connect('clicked', () => {
            this._shown = this._shown.add_months(delta) ?? this._shown;
            this._render();
        });
        return button;
    }

    private _buildRow(texts: string[], styleClass: string): St.BoxLayout {
        const row = new St.BoxLayout({style_class: 'dynamic-island-cal-row'});
        for (const text of texts) {
            row.add_child(new St.Label({
                text,
                style_class: styleClass,
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
            }));
        }
        return row;
    }

    private _render(): void {
        const now = GLib.DateTime.new_now_local();
        this._weekday.text = now.format('%A') ?? '';
        this._fullDate.text = now.format('%B %-d %Y') ?? '';

        const shown = this._shown;
        const sameYear = shown.get_year() === now.get_year();
        this._monthLabel.text = shown.format(sameYear ? '%B' : '%B %Y') ?? '';

        // get_day_of_week is 1 (Monday) to 7 (Sunday); the grid starts on Sunday.
        const offset = shown.get_day_of_week() % 7;
        const start = shown.add_days(-offset) ?? shown;
        for (let i = 0; i < this._cells.length; i++) {
            const day = start.add_days(i) ?? start;
            const {circle, label} = this._cells[i];
            label.text = day.format('%d') ?? '';

            const classes = ['dynamic-island-cal-day'];
            if (day.get_month() !== shown.get_month())
                classes.push('dynamic-island-cal-other');
            if (day.get_year() === now.get_year() && day.get_day_of_year() === now.get_day_of_year())
                classes.push('dynamic-island-cal-today');
            circle.style_class = classes.join(' ');
        }
    }
}
