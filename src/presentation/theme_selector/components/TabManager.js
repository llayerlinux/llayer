import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk?version=3.0';
import {ViewTabName} from '../../common/Constants.js';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';
import { STORE_TAB_TO_VIEW_TAB } from '../ThemeSelectorContracts.js';

const LAYOUT_MAP = {
    [ViewTabName.INSTALLED]: 'theme',
    [ViewTabName.NETWORK]: 'theme',
    [ViewTabName.MORE_SECTIONS]: 'special',
    [ViewTabName.ABOUT]: 'special'
};

export class TabManager {
    constructor(deps) {
        const safeDeps = deps && typeof deps === 'object' ? deps : {};
        this.buttons = safeDeps.buttons ?? {};
        this.onTabChange = safeDeps.onTabChange || (() => {
        });
        this.getMainContentBox = safeDeps.getMainContentBox || (() => null);
        this.getScrollableGrid = safeDeps.getScrollableGrid || (() => null);
        this.getGridBox = safeDeps.getGridBox || (() => null);
        this.detachFromParent = safeDeps.detachFromParent || (() => {
        });
        this.clearGridBox = safeDeps.clearGridBox || (() => {
        });
        this.hideNetworkProgress = safeDeps.hideNetworkProgress || (() => {
        });
        this.attachScrollHandler = safeDeps.attachScrollHandler || (() => {
        });
        this.getWindow = safeDeps.getWindow || (() => null);
        this.currentTab = ViewTabName.INSTALLED;
        this.tabRenderers = {};
    }

    mapStoreTab(tab) {
        return STORE_TAB_TO_VIEW_TAB[tab] || null;
    }

    setRenderers(renderers) {
        this.tabRenderers = renderers ?? {};
    }

    setButtons(buttons) {
        this.buttons = buttons ?? {};
    }

    setActiveButton(tabName) {
        const mapping = {
            installed: this.buttons.installed,
            network: this.buttons.network,
            settings: this.buttons.settings,
            'more-sections': this.buttons.moreSections,
            about: this.buttons.about
        };
        Object.values(mapping).forEach(btn => btn?.get_style_context?.()?.remove_class?.('active'));
        mapping[tabName]?.get_style_context?.()?.add_class?.('active');
    }

    getCurrentTab() {
        return this.currentTab;
    }

    switchTo(tabName) {
        this.setActiveButton(tabName);
        this.currentTab = tabName;
        tabName !== ViewTabName.NETWORK && this.hideNetworkProgress();
        this.rebuildContent(tabName);
    }

    getLayoutType(tabName) {
        return LAYOUT_MAP[tabName] || 'settings';
    }

    rebuildContent(tabName) {
        const mainContentBox = this.getMainContentBox(),
              scrollableGrid = this.getScrollableGrid(),
              canRebuild = Boolean(mainContentBox && this.getGridBox());
        if (!canRebuild) return;

        const layoutType = this.getLayoutType(tabName);
        switch (layoutType) {
        case 'theme':
            this.setupThemeTabLayout(mainContentBox, scrollableGrid);
            break;
        case 'special':
            this.setupSpecialTabLayout(mainContentBox, scrollableGrid);
            break;
        default:
            break;
        }

        this.renderTabContent(tabName);
        layoutType !== 'settings' && this.scheduleWindowResize();
    }

    attachScrollableGrid(mainContentBox, scrollableGrid) {
        mainContentBox.foreach?.(child => mainContentBox.remove(child));
        this.detachFromParent(scrollableGrid);
        if (!scrollableGrid.get_parent?.()) {
            mainContentBox.pack_start(scrollableGrid, true, true, 0);
        }
        scrollableGrid.show_all?.();
        mainContentBox.show_all?.();
    }

    setupThemeTabLayout(mainContentBox, scrollableGrid) {
        if (!(mainContentBox && scrollableGrid)) return;
        this.attachScrollableGrid(mainContentBox, scrollableGrid);
        this.attachScrollHandler();
        this.clearGridBox();
    }

    setupSpecialTabLayout(mainContentBox, scrollableGrid) {
        if (!(mainContentBox && scrollableGrid)) return;
        const children = typeof mainContentBox.get_children === 'function' ? mainContentBox.get_children() : [];
        const hasScrollable = children.includes(scrollableGrid);
        if (!hasScrollable) {
            this.attachScrollableGrid(mainContentBox, scrollableGrid);
        }
        this.clearGridBox();
    }

    renderTabContent(tabName) {
        const renderer = this.tabRenderers[tabName];
        typeof renderer === 'function' && renderer();
    }

    scheduleWindowResize() {
        let window = this.getWindow();
        if (!window) return;

        GLib.idle_add(GLib.PRIORITY_HIGH_IDLE, () => {
            let defaultWidth = 400,
                defaultHeight = 640;
            if (window.set_geometry_hints) {
                let geom = new Gdk.Geometry();
                geom.min_width = defaultWidth;
                geom.min_height = defaultHeight;
                geom.max_width = defaultWidth;
                geom.max_height = defaultHeight;
                window.set_geometry_hints(null, geom, Gdk.WindowHints.MIN_SIZE | Gdk.WindowHints.MAX_SIZE);
            }

            window.set_resizable?.(true);
            window.set_default_size?.(defaultWidth, defaultHeight);
            window.resize?.(defaultWidth, defaultHeight);
            window.queue_resize?.();
            GLib.timeout_add(GLib.PRIORITY_HIGH, TIMEOUTS.UI_REFRESH_MS, () => {
                window.resize?.(defaultWidth, defaultHeight);
                window.set_resizable?.(false);
                return GLib.SOURCE_REMOVE;
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    handleStoreTabChange(storeTab) {
        const mapped = this.mapStoreTab(storeTab);
        mapped && mapped !== this.currentTab && this.switchTo(mapped);
    }
}
