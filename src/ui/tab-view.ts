import Clutter from 'gi://Clutter';
import St from 'gi://St';

export interface TabPanel {
    id: string;
    label: string;
    iconName: string;
    actor: St.Widget;
}

/**
 * Tab navigation and a single-panel content area for the Expanded View.
 * Panels stay mounted so their state is retained while switching tabs.
 */
export class TabView {
    readonly actor: St.BoxLayout;

    private readonly _buttons = new Map<string, St.Button>();
    private readonly _panels = new Map<string, TabPanel>();
    private _selectedId: string;

    constructor(panels: TabPanel[], defaultId: string) {
        if (panels.length === 0)
            throw new Error('TabView requires at least one panel');

        this._selectedId = panels.some(panel => panel.id === defaultId)
            ? defaultId
            : panels[0].id;

        const tabs = new St.BoxLayout({style_class: 'dynamic-island-tabs'});
        const content = new St.Widget({
            style_class: 'dynamic-island-tab-content',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
        });

        for (const panel of panels) {
            this._panels.set(panel.id, panel);

            const tabContent = new St.BoxLayout({
                style_class: 'dynamic-island-tab-label',
                x_align: Clutter.ActorAlign.CENTER,
            });
            tabContent.add_child(new St.Icon({
                icon_name: panel.iconName,
                icon_size: 16,
            }));
            tabContent.add_child(new St.Label({
                text: panel.label,
                y_align: Clutter.ActorAlign.CENTER,
            }));

            const button = new St.Button({
                style_class: 'dynamic-island-tab',
                accessible_name: panel.label,
                can_focus: true,
                child: tabContent,
                x_expand: true,
            });
            button.connect('clicked', () => this.select(panel.id));
            this._buttons.set(panel.id, button);
            tabs.add_child(button);

            panel.actor.visible = panel.id === this._selectedId;
            content.add_child(panel.actor);
        }

        this.actor = new St.BoxLayout({
            style_class: 'dynamic-island-tab-view',
            vertical: true,
        });
        this.actor.add_child(tabs);
        this.actor.add_child(content);
        this._syncSelection();
    }

    get selectedId(): string {
        return this._selectedId;
    }

    select(id: string): void {
        if (id === this._selectedId || !this._panels.has(id))
            return;

        this._selectedId = id;
        this._syncSelection();
    }

    private _syncSelection(): void {
        for (const [id, panel] of this._panels)
            panel.actor.visible = id === this._selectedId;

        for (const [id, button] of this._buttons) {
            if (id === this._selectedId)
                button.add_style_class_name('dynamic-island-tab-active');
            else
                button.remove_style_class_name('dynamic-island-tab-active');
        }
    }
}
