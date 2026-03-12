#!/usr/bin/env gjs -m

import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import System from 'system';

import { MODULES } from '../../../app/AppModules.js';
import { applyAppInitialization } from '../../../app/AppInitialization.js';
import { applyAppOverrides } from '../../../app/AppOverrides.js';
import { applyAppRuntime } from '../../../app/AppRuntime.js';

class PopupSmokeApp {
    constructor() {
        this.initialized = false;
        this.container = new MODULES.DIContainer();
        this.eventBus = new MODULES.EventBusClass();
        this.eventBus.Events = MODULES.Events;
        this.notifier = null;
        this.settingsManager = null;
        this.themeSelectorView = null;
    }
}

applyAppInitialization(PopupSmokeApp.prototype);
applyAppOverrides(PopupSmokeApp.prototype);
applyAppRuntime(PopupSmokeApp.prototype);

function parseArgs(argv) {
    const args = {
        themes: [],
        cycles: 2,
        reportPath: `${GLib.get_home_dir()}/.cache/lastlayer-theme-context-menu-smoke.json`
    };

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        switch (token) {
            case '--theme':
                argv[i + 1] && args.themes.push(argv[++i]);
                break;
            case '--cycles':
                args.cycles = Math.max(1, parseInt(argv[i + 1] || '2', 10) || 2);
                i++;
                break;
            case '--report':
                args.reportPath = argv[i + 1] || args.reportPath;
                i++;
                break;
            case '--help':
            case '-h':
                print([
                    'Usage:',
                    '  gjs -m RunThemeContextMenuSmoke.js [--theme <name>] [--cycles <n>] [--report <path>]'
                ].join('\n'));
                System.exit(0);
                break;
        }
    }

    return args;
}

function writeJson(path, payload) {
    const parent = GLib.path_get_dirname(path);
    GLib.mkdir_with_parents(parent, parseInt('0755', 8));
    GLib.file_set_contents(path, JSON.stringify(payload, null, 2));
}

function sleep(ms) {
    return new Promise((resolve) => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

async function settleGtk(ms = 250) {
    const deadline = GLib.get_monotonic_time() + (ms * 1000);
    while (GLib.get_monotonic_time() < deadline) {
        while (Gtk.events_pending()) {
            Gtk.main_iteration_do(false);
        }
        await sleep(20);
    }
}

function isEligibleTheme(theme) {
    const name = String(theme?.name || '');
    return Boolean(
        name
        && name !== 'default'
        && !name.startsWith('.')
        && String(theme?.path || '').length > 0
    );
}

async function loadThemes(themeRepository, requestedThemes = []) {
    const localThemes = await themeRepository.getLocalThemes();
    const eligibleThemes = localThemes
        .filter(isEligibleTheme)
        .sort((left, right) => left.name.localeCompare(right.name));

    if (requestedThemes.length === 0) {
        return eligibleThemes;
    }

    const requested = new Set(requestedThemes);
    return eligibleThemes.filter((theme) => requested.has(theme.name));
}

function getStyleContext(widget) {
    return typeof widget?.get_style_context === 'function'
        ? widget.get_style_context()
        : null;
}

function findThemeMenuButton(widget) {
    if (!widget) {
        return null;
    }

    const style = getStyleContext(widget);
    if (widget instanceof Gtk.Button && style?.has_class?.('theme-menu-btn-overlay')) {
        return widget;
    }

    const candidates = [];
    const singleChild = widget.get_child?.();
    singleChild && candidates.push(singleChild);
    const children = widget.get_children?.() || [];
    children.forEach((child) => candidates.push(child));

    for (const candidate of candidates) {
        const found = findThemeMenuButton(candidate);
        if (found) {
            return found;
        }
    }

    return null;
}

function getThemeCard(view, themeName) {
    return view?.themeItems?.[themeName] || null;
}

function inspectPopup({popup, menuButton, mainWindow}) {
    const transientFor = popup?.get_transient_for?.() || null;
    const attachedTo = popup?.get_attached_to?.() || null;
    const gdkWindow = popup?.get_window?.() || null;
    const [width, height] = popup?.get_size?.() || [0, 0];

    return {
        popupExists: popup instanceof Gtk.Window,
        popupVisible: popup?.get_visible?.() === true,
        popupMapped: Boolean(gdkWindow),
        transientMatchesMainWindow: transientFor === mainWindow,
        attachedToTrigger: attachedTo == null ? null : attachedTo === menuButton,
        width,
        height
    };
}

async function runCycle({view, theme, cycle}) {
    const card = getThemeCard(view, theme.name);
    const menuButton = findThemeMenuButton(card);

    if (!card || !menuButton) {
        return {
            cycle,
            theme: theme.name,
            success: false,
            error: !card ? 'Theme card not found in rendered grid' : 'Burger menu button not found',
            inspection: null
        };
    }

    let thrownError = null;
    try {
        await view.themeContextMenuController.showContextMenu(theme.name, false, menuButton, null, theme);
    } catch (error) {
        thrownError = error;
    }
    await settleGtk(350);

    const popup = view.themeContextMenuView?.popup || null;
    const inspection = inspectPopup({
        popup,
        menuButton,
        mainWindow: view.window
    });

    const success = inspection.popupExists
        && inspection.popupVisible
        && inspection.popupMapped
        && inspection.transientMatchesMainWindow;

    view.themeContextMenuView?.hideMenu?.();
    await settleGtk(220);

    return {
        cycle,
        theme: theme.name,
        success,
        error: success
            ? null
            : (thrownError?.message || 'Popup failed visibility/transient checks'),
        inspection
    };
}

async function main(argv) {
    const args = parseArgs(argv);
    const app = new PopupSmokeApp();

    await app.initialize();
    await app.loadSupporterModules?.();
    await app.runMainThemeSelector();
    await settleGtk(900);

    const themeRepository = app.container.get('themeRepository');
    const themes = await loadThemes(themeRepository, args.themes);

    const report = {
        generatedAt: new Date().toISOString(),
        cycles: args.cycles,
        themes: [],
        success: true
    };

    for (const theme of themes) {
        const themeReport = {
            theme: theme.name,
            cycles: [],
            success: true
        };

        for (let cycle = 1; cycle <= args.cycles; cycle++) {
            const cycleReport = await runCycle({
                view: app.themeSelectorView,
                theme,
                cycle
            });
            themeReport.cycles.push(cycleReport);
            if (!cycleReport.success) {
                themeReport.success = false;
                report.success = false;
            }
        }

        report.themes.push(themeReport);
    }

    writeJson(args.reportPath, report);
    print(JSON.stringify(report, null, 2));
    return report.success ? 0 : 1;
}

System.exit(await main(ARGV));
