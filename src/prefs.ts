import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Soup from 'gi://Soup';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    PRAYER_HIGH_LATITUDE_RULES,
    PRAYER_MADHABS,
    PRAYER_METHODS,
} from './prayer/config.js';
import {
    buildLocationSearchUrl,
    parseLocationSearchResults,
    type LocationSearchResult,
} from './prayer/geocoder.js';

const METRICS = [
    {id: 'cpu', label: 'CPU usage'},
    {id: 'ram', label: 'RAM usage'},
    {id: 'network', label: 'Network speed'},
] as const;

export default class DynamicIslandPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        const settings = this.getSettings();
        const settingsChangedIds: number[] = [];

        const metricRow = new Adw.ComboRow({
            title: 'Pill Metric',
            subtitle: 'The Metric shown in the Pill next to the time',
            model: Gtk.StringList.new(METRICS.map(m => m.label)),
        });

        const syncMetric = () => {
            const index = METRICS.findIndex(m => m.id === settings.get_string('pill-metric'));
            metricRow.selected = Math.max(0, index);
        };
        syncMetric();
        metricRow.connect('notify::selected', () => {
            settings.set_string('pill-metric', METRICS[metricRow.selected].id);
        });
        settingsChangedIds.push(settings.connect('changed::pill-metric', syncMetric));

        const prayerEnabled = new Adw.SwitchRow({
            title: 'Enable Prayer Times',
            subtitle: 'Calculate offline using the saved location below',
            active: settings.get_boolean('prayer-location-configured'),
        });
        prayerEnabled.connect('notify::active', () => {
            settings.set_boolean('prayer-location-configured', prayerEnabled.active);
        });

        const locationStatus = new Adw.ActionRow({
            title: 'Saved Location',
            subtitle: settings.get_string('prayer-location-name') || 'No location selected',
        });
        const searchEntry = new Adw.EntryRow({
            title: 'Search Kecamatan or Area',
            text: '',
        });
        const searchButton = new Gtk.Button({
            label: 'Search',
            valign: Gtk.Align.CENTER,
        });
        searchEntry.add_suffix(searchButton);

        let searchResults: LocationSearchResult[] = [];
        const resultRow = new Adw.ComboRow({
            title: 'Search Results',
            subtitle: 'Choose the matching kecamatan, city/regency, and province',
            model: Gtk.StringList.new([]),
            visible: false,
        });
        const useResultButton = new Gtk.Button({
            label: 'Use Selected Location',
            valign: Gtk.Align.CENTER,
        });
        const useResultRow = new Adw.ActionRow({visible: false});
        useResultRow.add_suffix(useResultButton);

        const session = new Soup.Session({
            user_agent: 'DynamicIsland-GNOME-Extension/0.1 (dynamic-island@damar.local)',
        });
        let closed = false;
        let lastSearchMs = 0;
        const search = async () => {
            const url = buildLocationSearchUrl(searchEntry.text);
            if (!url) {
                locationStatus.subtitle = 'Enter at least 3 characters';
                return;
            }
            const now = Date.now();
            if (now - lastSearchMs < 1000) {
                locationStatus.subtitle = 'Wait a moment before searching again';
                return;
            }
            lastSearchMs = now;
            searchButton.sensitive = false;
            resultRow.visible = false;
            useResultRow.visible = false;
            locationStatus.subtitle = 'Searching Indonesia…';
            try {
                const message = Soup.Message.new('GET', url);
                const bytes = await new Promise<GLib.Bytes>((resolve, reject) => {
                    session.send_and_read_async(
                        message,
                        GLib.PRIORITY_DEFAULT,
                        null,
                        (_session, result) => {
                            try {
                                resolve(session.send_and_read_finish(result));
                            } catch (error) {
                                reject(error);
                            }
                        },
                    );
                });
                if (closed)
                    return;
                if (message.status_code !== Soup.Status.OK)
                    throw new Error(`HTTP ${message.status_code}`);
                const data = bytes.get_data();
                if (!data)
                    throw new Error('Empty response');
                searchResults = parseLocationSearchResults(new TextDecoder().decode(data));
                if (searchResults.length === 0) {
                    locationStatus.subtitle =
                        'No results. Include kecamatan, kabupaten/kota, and province.';
                    return;
                }
                resultRow.model = Gtk.StringList.new(searchResults.map(result => result.label));
                resultRow.selected = 0;
                resultRow.visible = true;
                useResultRow.visible = true;
                locationStatus.subtitle = `${searchResults.length} result(s) found`;
            } catch (error) {
                if (!closed)
                    locationStatus.subtitle = `Search failed: ${String(error)}`;
            } finally {
                if (!closed)
                    searchButton.sensitive = true;
            }
        };
        searchButton.connect('clicked', () => void search());
        useResultButton.connect('clicked', () => {
            const result = searchResults[resultRow.selected];
            if (!result)
                return;
            settings.set_string('prayer-location-name', result.label);
            settings.set_double('prayer-latitude', result.latitude);
            settings.set_double('prayer-longitude', result.longitude);
            settings.set_boolean('prayer-location-configured', true);
            locationStatus.subtitle = result.label;
            prayerEnabled.active = true;
        });

        const method = this._choiceRow(
            'Calculation Method',
            'Choose the authority used in your region',
            PRAYER_METHODS,
            settings.get_string('prayer-calculation-method'),
            id => settings.set_string('prayer-calculation-method', id),
        );
        const madhab = this._choiceRow(
            'Asr Method',
            'Juristic shadow-length method',
            PRAYER_MADHABS,
            settings.get_string('prayer-madhab'),
            id => settings.set_string('prayer-madhab', id),
        );
        const highLatitude = this._choiceRow(
            'High-Latitude Rule',
            'Fallback when twilight does not occur normally',
            PRAYER_HIGH_LATITUDE_RULES,
            settings.get_string('prayer-high-latitude-rule'),
            id => settings.set_string('prayer-high-latitude-rule', id),
        );

        const metricGroup = new Adw.PreferencesGroup({title: 'Pill'});
        metricGroup.add(metricRow);
        const prayerGroup = new Adw.PreferencesGroup({
            title: 'Prayer Times',
            description: 'Search uses OpenStreetMap Nominatim. Times are calculated offline after saving a result and use your system time zone. © OpenStreetMap contributors.',
        });
        prayerGroup.add(prayerEnabled);
        prayerGroup.add(locationStatus);
        prayerGroup.add(searchEntry);
        prayerGroup.add(resultRow);
        prayerGroup.add(useResultRow);
        prayerGroup.add(method);
        prayerGroup.add(madhab);
        prayerGroup.add(highLatitude);

        const page = new Adw.PreferencesPage();
        page.add(metricGroup);
        page.add(prayerGroup);
        window.add(page);

        settingsChangedIds.push(
            settings.connect('changed::prayer-location-configured', () => {
                prayerEnabled.active = settings.get_boolean('prayer-location-configured');
            }),
            settings.connect('changed::prayer-location-name', () => {
                locationStatus.subtitle =
                    settings.get_string('prayer-location-name') || 'No location selected';
            }),
            settings.connect('changed::prayer-calculation-method', () => {
                method.selected = Math.max(0, PRAYER_METHODS.findIndex(
                    choice => choice.id === settings.get_string('prayer-calculation-method'),
                ));
            }),
            settings.connect('changed::prayer-madhab', () => {
                madhab.selected = Math.max(0, PRAYER_MADHABS.findIndex(
                    choice => choice.id === settings.get_string('prayer-madhab'),
                ));
            }),
            settings.connect('changed::prayer-high-latitude-rule', () => {
                highLatitude.selected = Math.max(0, PRAYER_HIGH_LATITUDE_RULES.findIndex(
                    choice => choice.id === settings.get_string('prayer-high-latitude-rule'),
                ));
            }),
        );
        window.connect('close-request', () => {
            closed = true;
            for (const id of settingsChangedIds)
                settings.disconnect(id);
            return false;
        });

        return Promise.resolve();
    }

    private _choiceRow<T extends readonly {id: string; label: string}[]>(
        title: string,
        subtitle: string,
        choices: T,
        selectedId: string,
        onSelected: (id: T[number]['id']) => void,
    ): Adw.ComboRow {
        const row = new Adw.ComboRow({
            title,
            subtitle,
            model: Gtk.StringList.new(choices.map(choice => choice.label)),
            selected: Math.max(0, choices.findIndex(choice => choice.id === selectedId)),
        });
        row.connect('notify::selected', () => {
            const choice = choices[row.selected];
            if (choice)
                onSelected(choice.id);
        });
        return row;
    }
}
