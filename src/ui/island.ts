import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Calendar} from './calendar.js';
import {Graph, type Series} from './graph.js';
import {TabView} from './tab-view.js';

/** How long the pointer must rest on the Pill before the Island expands. */
const EXPAND_DELAY_MS = 300;
const EXPAND_DURATION_MS = 260;
const COLLAPSE_DURATION_MS = 220;
const RESIZE_DURATION_MS = 150;

export type RowId = 'cpu' | 'ram' | 'network';

interface Row {
    box: St.BoxLayout;
    name: string;
    value: St.Label;
    graph: Graph;
}

interface RowSpec {
    name: string;
    graph: ConstructorParameters<typeof Graph>[0];
}

export interface IslandOptions {
    /** Number of samples that fit across each graph. */
    historyCapacity: number;
    /** Called when the Island expands or collapses. */
    onExpandedChanged: (expanded: boolean) => void;
}

/**
 * The view: a black rounded shape centered over the top bar. Collapsed it is
 * the Pill; expanded it grows downward into the Expanded View.
 */
export class Island {
    private readonly _actor: St.BoxLayout;
    private readonly _pill: St.Button;
    private readonly _time: St.Label;
    private readonly _pillMetric: St.Label;
    private readonly _details: St.BoxLayout;
    private readonly _metrics: St.BoxLayout;
    private readonly _calendar: Calendar;
    private readonly _tabs: TabView;
    private readonly _rows = new Map<RowId, Row>();

    private _expanded = false;
    /** Keeps a keyboard-opened Island expanded while focus moves within it. */
    private _keyboardOpen = false;
    /** Keeps an explicitly clicked Island open after the pointer leaves. */
    private _clickOpen = false;
    /** True from the start of a collapse animation until it finishes. */
    private _collapsing = false;
    /** Height of the collapsed Island, border included. */
    private _collapsedHeight = 0;
    private _expandTimeoutId = 0;
    private _signalIds: number[] = [];
    private _pillSignalIds: number[] = [];
    private _stageKeyFocusChangedId = 0;
    private _monitorsChangedId = 0;

    constructor(private readonly _options: IslandOptions) {
        this._time = new St.Label({
            style_class: 'dynamic-island-time',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const separator = new St.Label({
            text: '·',
            style_class: 'dynamic-island-separator',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._pillMetric = new St.Label({
            style_class: 'dynamic-island-pill-metric',
            y_align: Clutter.ActorAlign.CENTER,
        });

        const pillContent = new St.BoxLayout({
            style_class: 'dynamic-island-pill-content',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        pillContent.add_child(this._time);
        pillContent.add_child(separator);
        pillContent.add_child(this._pillMetric);

        this._pill = new St.Button({
            style_class: 'dynamic-island-pill',
            accessible_name: 'Dynamic Island',
            accessible_role: Atk.Role.PUSH_BUTTON,
            can_focus: true,
            child: pillContent,
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._details = new St.BoxLayout({
            style_class: 'dynamic-island-details',
            vertical: true,
            visible: false,
            opacity: 0,
        });

        this._calendar = new Calendar();
        this._metrics = new St.BoxLayout({
            style_class: 'dynamic-island-metrics',
            vertical: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
        });

        const specs: Record<RowId, RowSpec> = {
            cpu: {name: 'CPU', graph: {capacity: _options.historyCapacity, fixedMax: 100, minMax: 100}},
            ram: {name: 'RAM', graph: {capacity: _options.historyCapacity, fixedMax: 100, minMax: 100}},
            // Auto-scaled, with a floor so a quiet connection stays a flat line.
            network: {name: 'Network', graph: {capacity: _options.historyCapacity, fixedMax: null, minMax: 100 * 1024}},
        };
        for (const id of ['cpu', 'ram', 'network'] as const)
            this._rows.set(id, this._buildRow(specs[id]));

        this._tabs = new TabView([
            {
                id: 'system',
                label: 'System',
                iconName: 'utilities-system-monitor-symbolic',
                actor: this._metrics,
            },
            {
                id: 'calendar',
                label: 'Calendar',
                iconName: 'x-office-calendar-symbolic',
                actor: this._calendar.actor,
            },
        ], 'system');
        this._details.add_child(this._tabs.actor);

        this._actor = new St.BoxLayout({
            style_class: 'dynamic-island',
            accessible_name: 'Dynamic Island',
            accessible_role: Atk.Role.PANEL,
            vertical: true,
            reactive: true,
            track_hover: true,
            // Keep the contents inside the rounded corners while resizing.
            clip_to_allocation: true,
        });
        this._actor.add_child(this._pill);
        this._actor.add_child(this._details);

        this._signalIds.push(
            this._actor.connect('notify::hover', () => this._onHoverChanged()),
            this._actor.connect('notify::width', () => this._reposition()),
            this._actor.connect('notify::height', () => this._reposition()),
            this._actor.connect('key-press-event',
                (_actor, event) => this._onIslandKeyPress(event)),
        );
        this._pillSignalIds.push(
            this._pill.connect('key-press-event',
                (_actor, event) => this._onPillKeyPress(event)),
            this._pill.connect('clicked', () => this._onPillClicked()),
        );
        this._stageKeyFocusChangedId = global.stage.connect(
            'notify::key-focus',
            () => this._onKeyFocusChanged(),
        );
        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => this._reposition());

        Main.layoutManager.addTopChrome(this._actor, {trackFullscreen: true});
        Main.ctrlAltTabManager.addGroup(
            this._actor,
            'Dynamic Island',
            'utilities-system-monitor-symbolic',
        );
        this._collapsedHeight = this._actor.get_preferred_size()[3];
        this._reposition();
    }

    get expanded(): boolean {
        return this._expanded;
    }

    setPill(time: string, metric: string): void {
        this._pill.accessible_name = `${time}; ${metric}`;

        // While expanded the card has a fixed size and the Pill row is centered
        // in it, so changing the text needs no resize.
        if (this._expanded || this._collapsing) {
            this._time.text = time;
            this._pillMetric.text = metric;
            return;
        }

        // The collapsed card is as wide as its text, so the time and the Pill
        // Metric stay centered together. Glide to the new width instead of jumping.
        const [fromWidth, fromHeight] = this._actor.get_size();
        this._time.text = time;
        this._pillMetric.text = metric;
        this._actor.set_size(-1, -1);
        const [, , toWidth] = this._actor.get_preferred_size();
        if (Math.abs(toWidth - fromWidth) < 1)
            return;

        this._actor.set_size(fromWidth, fromHeight);
        this._actor.ease({
            width: toWidth,
            duration: RESIZE_DURATION_MS,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                if (!this._expanded && !this._collapsing)
                    this._actor.set_size(-1, -1);
            },
        });
    }

    setRow(id: RowId, value: string, series: Series[]): void {
        const row = this._rows.get(id);
        if (!row)
            return;
        row.value.text = value;
        row.box.accessible_name = `${row.name}: ${value}`;
        row.graph.setSeries(series);
    }

    destroy(): void {
        this._cancelExpandTimeout();
        this._actor.remove_all_transitions();
        this._details.remove_all_transitions();
        for (const id of this._signalIds)
            this._actor.disconnect(id);
        this._signalIds = [];
        for (const id of this._pillSignalIds)
            this._pill.disconnect(id);
        this._pillSignalIds = [];
        if (this._stageKeyFocusChangedId) {
            global.stage.disconnect(this._stageKeyFocusChangedId);
            this._stageKeyFocusChangedId = 0;
        }
        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = 0;
        }
        Main.ctrlAltTabManager.removeGroup(this._actor);
        Main.layoutManager.removeChrome(this._actor);
        this._actor.destroy();
    }

    private _buildRow(spec: RowSpec): Row {
        const name = new St.Label({
            text: spec.name,
            style_class: 'dynamic-island-row-name',
            x_expand: true,
        });
        const value = new St.Label({style_class: 'dynamic-island-row-value'});
        const header = new St.BoxLayout();
        header.add_child(name);
        header.add_child(value);

        const graph = new Graph(spec.graph);
        graph.actor.accessible_role = Atk.Role.REDUNDANT_OBJECT;

        const box = new St.BoxLayout({
            style_class: 'dynamic-island-row',
            accessible_name: spec.name,
            accessible_role: Atk.Role.SECTION,
            vertical: true,
        });
        box.add_child(header);
        box.add_child(graph.actor);
        this._metrics.add_child(box);

        return {box, name: spec.name, value, graph};
    }

    private _onHoverChanged(): void {
        if (this._actor.hover) {
            if (!this._expanded && !this._expandTimeoutId) {
                this._expandTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, EXPAND_DELAY_MS, () => {
                    this._expandTimeoutId = 0;
                    this._expand();
                    return GLib.SOURCE_REMOVE;
                });
            }
        } else {
            this._cancelExpandTimeout();
            if (this._expanded && !this._keyboardOpen && !this._clickOpen)
                this._collapse();
        }
    }

    private _onPillClicked(): void {
        this._cancelExpandTimeout();

        if (this._clickOpen) {
            this._clickOpen = false;
            this._keyboardOpen = false;
            this._collapse();
            this._pill.grab_key_focus();
            return;
        }

        this._clickOpen = true;
        this._expand();
        this._tabs.focusSelected();
    }

    private _onPillKeyPress(event: Clutter.Event): boolean {
        switch (event.get_key_symbol()) {
        case Clutter.KEY_Return:
        case Clutter.KEY_KP_Enter:
        case Clutter.KEY_space:
        case Clutter.KEY_Down:
            this._cancelExpandTimeout();
            this._keyboardOpen = true;
            this._expand();
            this._tabs.focusSelected();
            return Clutter.EVENT_STOP;
        default:
            return Clutter.EVENT_PROPAGATE;
        }
    }

    private _onIslandKeyPress(event: Clutter.Event): boolean {
        if (event.get_key_symbol() !== Clutter.KEY_Escape || !this._expanded)
            return Clutter.EVENT_PROPAGATE;

        this._cancelExpandTimeout();
        this._keyboardOpen = false;
        this._clickOpen = false;
        this._collapse();
        this._pill.grab_key_focus();
        return Clutter.EVENT_STOP;
    }

    private _onKeyFocusChanged(): void {
        if (!this._keyboardOpen && !this._clickOpen)
            return;

        const focus = global.stage.get_key_focus();
        if (focus && (focus === this._actor || this._actor.contains(focus)))
            return;

        this._keyboardOpen = false;
        this._clickOpen = false;
        if (!this._actor.hover)
            this._collapse();
    }

    private _cancelExpandTimeout(): void {
        if (this._expandTimeoutId) {
            GLib.Source.remove(this._expandTimeoutId);
            this._expandTimeoutId = 0;
        }
    }

    private _expand(): void {
        if (this._expanded)
            return;
        this._expanded = true;
        this._collapsing = false;
        this._options.onExpandedChanged(true);
        this._calendar.reset();
        this._actor.add_style_class_name('dynamic-island-open');
        this._pill.add_accessible_state(Atk.StateType.EXPANDED);

        const [fromWidth, fromHeight] = this._actor.get_size();

        // Measure the natural size of the Expanded View, then animate to it.
        this._details.show();
        this._actor.set_size(-1, -1);
        const [, , toWidth, toHeight] = this._actor.get_preferred_size();
        this._actor.set_size(fromWidth, fromHeight);

        this._actor.remove_all_transitions();
        this._actor.ease({
            width: toWidth,
            height: toHeight,
            duration: EXPAND_DURATION_MS,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
        });
        this._details.remove_all_transitions();
        this._details.ease({
            opacity: 255,
            duration: EXPAND_DURATION_MS - 60,
            delay: 60,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    private _collapse(): void {
        if (!this._expanded)
            return;
        this._expanded = false;
        this._options.onExpandedChanged(false);

        this._collapsing = true;
        this._actor.remove_style_class_name('dynamic-island-open');
        this._pill.remove_accessible_state(Atk.StateType.EXPANDED);

        // Measure the collapsed card, border included, by briefly hiding the
        // Expanded View. Nothing is drawn between hiding and restoring.
        const [fromWidth, fromHeight] = this._actor.get_size();
        this._details.hide();
        this._actor.set_size(-1, -1);
        const [, , pillWidth, pillHeight] = this._actor.get_preferred_size();
        this._details.show();
        this._actor.set_size(fromWidth, fromHeight);
        this._collapsedHeight = pillHeight;

        this._details.remove_all_transitions();
        this._details.ease({
            opacity: 0,
            duration: 100,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        this._actor.remove_all_transitions();
        this._actor.ease({
            width: pillWidth,
            height: pillHeight,
            duration: COLLAPSE_DURATION_MS,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            onComplete: () => {
                // A new expansion may have started while this one was finishing.
                if (this._expanded)
                    return;
                this._collapsing = false;
                this._details.hide();
                this._actor.set_size(-1, -1);
            },
        });
    }

    /** Center horizontally on the primary monitor, and vertically within the top bar. */
    private _reposition(): void {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;
        const x = monitor.x + Math.round((monitor.width - this._actor.width) / 2);
        const y = monitor.y + Math.max(0, Math.round((Main.panel.height - this._collapsedHeight) / 2));
        this._actor.set_position(x, y);
    }
}
