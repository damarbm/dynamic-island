import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Controller} from './controller.js';

export default class DynamicIslandExtension extends Extension {
    private _controller: Controller | null = null;
    private _clockWasOpaque = 255;

    enable(): void {
        this._controller = new Controller(this.getSettings());

        // The Island overlays the clock and shows the time itself, so hide the
        // clock underneath. Opacity (not visibility) keeps the top bar layout.
        const clock = Main.panel.statusArea.dateMenu?.container;
        if (clock) {
            this._clockWasOpaque = clock.opacity;
            clock.opacity = 0;
        }
    }

    disable(): void {
        const clock = Main.panel.statusArea.dateMenu?.container;
        if (clock)
            clock.opacity = this._clockWasOpaque;

        this._controller?.destroy();
        this._controller = null;
    }
}
