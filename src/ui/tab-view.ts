import Clutter from 'gi://Clutter';
import Atk from 'gi://Atk';
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
    private readonly _panelIds: string[];
    private _selectedId: string;

    constructor(panels: TabPanel[], defaultId: string) {
        if (panels.length === 0)
            throw new Error('TabView requires at least one panel');

        this._panelIds = panels.map(panel => panel.id);
        this._selectedId = panels.some(panel => panel.id === defaultId)
            ? defaultId
            : panels[0].id;

        const tabs = new St.BoxLayout({
            style_class: 'dynamic-island-tabs',
            accessible_name: 'Island sections',
            accessible_role: Atk.Role.PAGE_TAB_LIST,
        });
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
                accessible_role: Atk.Role.PAGE_TAB,
                can_focus: panel.id === this._selectedId,
                child: tabContent,
                x_expand: true,
            });
            button.connect('clicked', () => {
                this.select(panel.id);
                button.grab_key_focus();
            });
            button.connect('key-press-event',
                (_actor, event) => this._onTabKeyPress(panel.id, event));
            this._buttons.set(panel.id, button);
            tabs.add_child(button);

            panel.actor.accessible_name = `${panel.label} panel`;
            panel.actor.accessible_role = Atk.Role.PANEL;
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

    focusSelected(): void {
        this._buttons.get(this._selectedId)?.grab_key_focus();
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
            const selected = id === this._selectedId;
            button.can_focus = selected;
            if (selected) {
                button.add_style_class_name('dynamic-island-tab-active');
                button.add_style_pseudo_class('selected');
            } else {
                button.remove_style_class_name('dynamic-island-tab-active');
                button.remove_style_pseudo_class('selected');
            }
        }
    }

    private _onTabKeyPress(id: string, event: Clutter.Event): boolean {
        const currentIndex = this._panelIds.indexOf(id);
        let targetIndex: number;

        switch (event.get_key_symbol()) {
        case Clutter.KEY_Left:
            targetIndex = (currentIndex - 1 + this._panelIds.length) % this._panelIds.length;
            break;
        case Clutter.KEY_Right:
            targetIndex = (currentIndex + 1) % this._panelIds.length;
            break;
        case Clutter.KEY_Home:
            targetIndex = 0;
            break;
        case Clutter.KEY_End:
            targetIndex = this._panelIds.length - 1;
            break;
        case Clutter.KEY_Return:
        case Clutter.KEY_KP_Enter:
        case Clutter.KEY_space:
            this.select(id);
            return Clutter.EVENT_STOP;
        default:
            return Clutter.EVENT_PROPAGATE;
        }

        const targetId = this._panelIds[targetIndex];
        this.select(targetId);
        this._buttons.get(targetId)?.grab_key_focus();
        return Clutter.EVENT_STOP;
    }
}
