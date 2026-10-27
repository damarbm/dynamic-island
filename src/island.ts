import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Graph, type Series} from './graph.js';

/** How long the pointer must rest on the Pill before the Island expands. */
const EXPAND_DELAY_MS = 300;
const EXPAND_DURATION_MS = 260;
const COLLAPSE_DURATION_MS = 220;
const RESIZE_DURATION_MS = 150;

export type RowId = 'cpu' | 'ram' | 'network';

interface Row {
    box: St.BoxLayout;
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
    private readonly _pill: St.BoxLayout;
    private readonly _time: St.Label;
    private readonly _pillMetric: St.Label;
    private readonly _details: St.BoxLayout;
    private readonly _rows = new Map<RowId, Row>();

    private _expanded = false;
    /** True from the start of a collapse animation until it finishes. */
    private _collapsing = false;
    /** Height of the collapsed Island, border included. */
    private _collapsedHeight = 0;
    private _expandTimeoutId = 0;
    private _signalIds: number[] = [];
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

        this._pill = new St.BoxLayout({
            style_class: 'dynamic-island-pill',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._pill.add_child(this._time);
        this._pill.add_child(separator);
        this._pill.add_child(this._pillMetric);

        this._details = new St.BoxLayout({
            style_class: 'dynamic-island-details',
            vertical: true,
            visible: false,
            opacity: 0,
        });

        const specs: Record<RowId, RowSpec> = {
            cpu: {name: 'CPU', graph: {capacity: _options.historyCapacity, fixedMax: 100, minMax: 100}},
            ram: {name: 'RAM', graph: {capacity: _options.historyCapacity, fixedMax: 100, minMax: 100}},
            // Auto-scaled, with a floor so a quiet connection stays a flat line.
            network: {name: 'Network', graph: {capacity: _options.historyCapacity, fixedMax: null, minMax: 100 * 1024}},
        };
        for (const id of ['cpu', 'ram', 'network'] as const)
            this._rows.set(id, this._buildRow(specs[id]));

        this._actor = new St.BoxLayout({
            style_class: 'dynamic-island',
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
        );
        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => this._reposition());

        Main.layoutManager.addTopChrome(this._actor, {trackFullscreen: true});
        this._collapsedHeight = this._actor.get_preferred_size()[3];
        this._reposition();
    }

    get expanded(): boolean {
        return this._expanded;
    }

    setPill(time: string, metric: string): void {
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
        row.graph.setSeries(series);
    }

    destroy(): void {
        this._cancelExpandTimeout();
        this._actor.remove_all_transitions();
        this._details.remove_all_transitions();
        for (const id of this._signalIds)
            this._actor.disconnect(id);
        this._signalIds = [];
        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = 0;
        }
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

        const box = new St.BoxLayout({style_class: 'dynamic-island-row', vertical: true});
        box.add_child(header);
        box.add_child(graph.actor);
        this._details.add_child(box);

        return {box, value, graph};
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
            if (this._expanded)
                this._collapse();
        }
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
