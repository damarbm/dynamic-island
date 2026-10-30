/** Fixed-capacity buffer that keeps the most recent values, oldest first. */
export class RingBuffer {
    private readonly _values: number[] = [];

    readonly capacity: number;

    constructor(capacity: number) {
        this.capacity = capacity;
    }

    push(value: number): void {
        this._values.push(value);
        if (this._values.length > this.capacity)
            this._values.shift();
    }

    /** Values from oldest to newest. */
    toArray(): readonly number[] {
        return this._values;
    }

    get length(): number {
        return this._values.length;
    }

    clear(): void {
        this._values.length = 0;
    }
}
