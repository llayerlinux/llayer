import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import {ViewTabName} from '../../common/Constants.js';

export class ThemesGrid {
    constructor(deps) {
        this.Box = deps.Box;
        this.createThemeItem = deps.createThemeItem;
        this.getCurrentTab = deps.getCurrentTab || (() => ViewTabName.INSTALLED);
        this.onRenderComplete = deps.onRenderComplete || (() => {
        });
        this.cardsByTab = Object.create(null);
        this.themeItems = Object.create(null);
    }

    createThemeCard(theme, tab) {
        const card = this.createThemeItem(theme);
        this.cardsByTab[tab].set(theme.name, card);
        this.themeItems[theme.name] = card;
        return card;
    }

    buildRow(themes, startIdx, tab) {
        const items = [];
        for (let j = 0; j < 2; j++) {
            const theme = themes[startIdx + j];
            theme && items.push(this.createThemeCard(theme, tab));
        }
        return this.Box({
            spacing: 16,
            margin_end: 24,
            children: items,
            className: 'my-theme-selector-grid-row',
            hexpand: true,
            halign: Gtk.Align.CENTER
        });
    }

    getActiveTabKey() {
        return this.getCurrentTab() === ViewTabName.NETWORK ? ViewTabName.NETWORK : ViewTabName.INSTALLED;
    }

    render(themes, gridBox) {
        const hasRenderableInput = Array.isArray(themes) && gridBox;
        return hasRenderableInput
            ? (() => {
                const tab = this.getActiveTabKey();
                this.cardsByTab[tab] = new Map();
                this.themeItems = Object.create(null);
                this.clearGrid(gridBox);
                return themes.length === 0
                    ? (gridBox.show_all?.(), gridBox.queue_draw?.(), this.getState())
                    : (() => {
                        for (let i = 0; i < themes.length; i += 2) {
                            gridBox.pack_start(this.buildRow(themes, i, tab), false, false, 0);
                        }
                        gridBox.show_all();
                        gridBox.queue_draw();
                        this.onRenderComplete(this.cardsByTab, this.themeItems);
                        return this.getState();
                    })();
            })()
            : this.getState();
    }

    clearGrid(gridBox) {
        gridBox?.get_children && (() => {
            for (const child of gridBox.get_children()) {
                child._pulseTimer && (GLib.source_remove(child._pulseTimer), child._pulseTimer = null);
                gridBox.remove(child);
            }
        })();
    }

    getState() {
        return {cardsByTab: this.cardsByTab, themeItems: this.themeItems};
    }
}
