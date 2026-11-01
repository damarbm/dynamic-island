export interface LocationSearchResult {
    label: string;
    latitude: number;
    longitude: number;
}

interface NominatimResult {
    display_name?: unknown;
    lat?: unknown;
    lon?: unknown;
    address?: {
        country_code?: unknown;
    };
}

export function buildLocationSearchUrl(query: string): string | null {
    const normalized = query.trim();
    if (normalized.length < 3)
        return null;

    const queryValue = encodeURIComponent(`${normalized}, Indonesia`);
    return 'https://nominatim.openstreetmap.org/search' +
        `?q=${queryValue}` +
        '&format=jsonv2' +
        '&addressdetails=1' +
        '&countrycodes=id' +
        '&limit=5' +
        '&accept-language=id%2Cen';
}

export function parseLocationSearchResults(json: string): LocationSearchResult[] {
    let value: unknown;
    try {
        value = JSON.parse(json);
    } catch {
        return [];
    }
    if (!Array.isArray(value))
        return [];

    const results: LocationSearchResult[] = [];
    for (const item of value as NominatimResult[]) {
        if (typeof item.display_name !== 'string' ||
            item.address?.country_code !== 'id')
            continue;
        const latitude = typeof item.lat === 'string' ? Number(item.lat) : Number.NaN;
        const longitude = typeof item.lon === 'string' ? Number(item.lon) : Number.NaN;
        if (!Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180)
            continue;
        results.push({label: item.display_name, latitude, longitude});
    }
    return results;
}
