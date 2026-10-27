import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const METRICS = [
    {id: 'cpu', label: 'CPU usage'},
    {id: 'ram', label: 'RAM usage'},
    {id: 'network', label: 'Network speed'},
] as const;

export default class DynamicIslandPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        const settings = this.getSettings();

        const row = new Adw.ComboRow({
            title: 'Pill Metric',
            subtitle: 'The Metric shown in the Pill next to the time',
            model: Gtk.StringList.new(METRICS.map(m => m.label)),
        });

        const sync = () => {
            const index = METRICS.findIndex(m => m.id === settings.get_string('pill-metric'));
            row.selected = Math.max(0, index);
        };
        sync();
        row.connect('notify::selected', () => {
            settings.set_string('pill-metric', METRICS[row.selected].id);
        });
        const changedId = settings.connect('changed::pill-metric', sync);
        window.connect('close-request', () => {
            settings.disconnect(changedId);
            return false;
        });

        const group = new Adw.PreferencesGroup();
        group.add(row);
        const page = new Adw.PreferencesPage();
        page.add(group);
        window.add(page);

        return Promise.resolve();
    }
}
