const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

function scale(value: number): string {
    let v = Math.max(0, value);
    let i = 0;
    while (v >= 1024 && i < UNITS.length - 1) {
        v /= 1024;
        i++;
    }
    const text = i === 0 || v >= 10 ? v.toFixed(0) : v.toFixed(1);
    return `${text} ${UNITS[i]}`;
}

export function formatPercent(percent: number): string {
    return `${Math.round(percent)}%`;
}

export function formatSpeed(bytesPerSecond: number): string {
    return `${scale(bytesPerSecond)}/s`;
}

export function formatBytes(bytes: number): string {
    return scale(bytes);
}

export function formatTime(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(date: Date): string {
    return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}
