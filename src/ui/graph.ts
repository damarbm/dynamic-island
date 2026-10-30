import St from 'gi://St';

export interface Series {
    values: readonly number[];
    /** RGB, each 0-1. */
    color: [number, number, number];
    /** Fill the area under the line. */
    fill: boolean;
}

export interface GraphOptions {
    /** Number of samples that fit across the full width. */
    capacity: number;
    /** Fixed top of the scale, or null to scale to the largest value. */
    fixedMax: number | null;
    /** Smallest top of the scale when auto-scaling, so idle noise stays flat. */
    minMax: number;
}

/** A small line graph drawn from the right edge, newest sample last. */
export class Graph {
    readonly actor: St.DrawingArea;
    private _series: Series[] = [];

    constructor(private readonly _options: GraphOptions) {
        this.actor = new St.DrawingArea({
            style_class: 'dynamic-island-graph',
            x_expand: true,
        });
        this.actor.connect('repaint', area => this._repaint(area));
    }

    setSeries(series: Series[]): void {
        this._series = series;
        this.actor.queue_repaint();
    }

    private _repaint(area: St.DrawingArea): void {
        const cr = area.get_context();
        const [width, height] = area.get_surface_size();
        const {capacity, fixedMax, minMax} = this._options;

        let top = fixedMax ?? minMax;
        if (fixedMax === null) {
            for (const s of this._series)
                for (const v of s.values)
                    top = Math.max(top, v);
        }

        // Faint baseline so an empty graph still reads as a graph.
        cr.setSourceRGBA(1, 1, 1, 0.12);
        cr.setLineWidth(1);
        cr.moveTo(0, height - 0.5);
        cr.lineTo(width, height - 0.5);
        cr.stroke();

        const step = width / (capacity - 1);
        const pad = 2;
        const plotHeight = height - pad * 2;

        for (const s of this._series) {
            const n = s.values.length;
            if (n < 2)
                continue;

            const xs = (i: number) => width - (n - 1 - i) * step;
            const ys = (v: number) => pad + plotHeight * (1 - Math.min(v, top) / top);

            cr.moveTo(xs(0), ys(s.values[0]));
            for (let i = 1; i < n; i++)
                cr.lineTo(xs(i), ys(s.values[i]));

            const [r, g, b] = s.color;
            cr.setSourceRGBA(r, g, b, 1);
            cr.setLineWidth(1.5);
            if (s.fill) {
                cr.strokePreserve();
                cr.lineTo(xs(n - 1), height);
                cr.lineTo(xs(0), height);
                cr.closePath();
                cr.setSourceRGBA(r, g, b, 0.18);
                cr.fill();
            } else {
                cr.stroke();
            }
        }

        cr.$dispose();
    }
}
