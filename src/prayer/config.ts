export const PRAYER_METHODS = [
    {id: 'muslim-world-league', label: 'Muslim World League'},
    {id: 'egyptian', label: 'Egyptian General Authority'},
    {id: 'karachi', label: 'University of Islamic Sciences, Karachi'},
    {id: 'umm-al-qura', label: 'Umm al-Qura University, Makkah'},
    {id: 'dubai', label: 'Dubai'},
    {id: 'qatar', label: 'Qatar'},
    {id: 'kuwait', label: 'Kuwait'},
    {id: 'moonsighting-committee', label: 'Moonsighting Committee'},
    {id: 'singapore', label: 'Singapore'},
    {id: 'turkey', label: 'Turkey'},
    {id: 'tehran', label: 'Tehran'},
    {id: 'north-america', label: 'North America'},
] as const;

export const PRAYER_MADHABS = [
    {id: 'shafi', label: 'Shafi, Maliki, Hanbali'},
    {id: 'hanafi', label: 'Hanafi'},
] as const;

export const PRAYER_HIGH_LATITUDE_RULES = [
    {id: 'middle-of-night', label: 'Middle of the night'},
    {id: 'seventh-of-night', label: 'Seventh of the night'},
    {id: 'twilight-angle', label: 'Twilight angle'},
] as const;

export type PrayerMethodId = typeof PRAYER_METHODS[number]['id'];
export type PrayerMadhabId = typeof PRAYER_MADHABS[number]['id'];
export type PrayerHighLatitudeRuleId = typeof PRAYER_HIGH_LATITUDE_RULES[number]['id'];

export interface PrayerConfig {
    configured: boolean;
    latitude: number;
    longitude: number;
    method: PrayerMethodId;
    madhab: PrayerMadhabId;
    highLatitudeRule: PrayerHighLatitudeRuleId;
}

export function isPrayerMethodId(value: string): value is PrayerMethodId {
    return PRAYER_METHODS.some(option => option.id === value);
}

export function isPrayerMadhabId(value: string): value is PrayerMadhabId {
    return PRAYER_MADHABS.some(option => option.id === value);
}

export function isPrayerHighLatitudeRuleId(value: string): value is PrayerHighLatitudeRuleId {
    return PRAYER_HIGH_LATITUDE_RULES.some(option => option.id === value);
}
