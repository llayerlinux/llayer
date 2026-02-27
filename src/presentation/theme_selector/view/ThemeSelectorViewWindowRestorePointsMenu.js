import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import * as ViewUtils from '../../common/ViewUtils.js';
import { Events } from '../../../app/eventBus.js';
import {ViewTabName} from '../../common/Constants.js';
import { tryOrNull, tryOrNullAsync, tryRun } from '../../../infrastructure/utils/ErrorUtils.js';

export function applyThemeSelectorViewWindowRestorePointsMenu(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeSelectorViewWindowRestorePointsMenu.prototype);
}

class ThemeSelectorViewWindowRestorePointsMenu {
    markDefaultThemeStale() {
        this._defaultThemeStale = true;
        const defaultCard = this.themeItems?.['default'];
        const itemBox = defaultCard?.get_child?.();
        itemBox?.get_style_context?.()?.remove_class?.('my-theme-selector-item-selected');
        this.updateCurrentThemeStyles?.(null);
        this.controller?.activeProcesses?.delete?.('default');
    }

    showDefaultRestorePointsMenu() {
        if (!this.window) return this.hideDefaultRestorePointsMenu();

        this.hideDefaultRestorePointsMenu();

        const dialog = new Gtk.Dialog({
            title: this.translate('RESTORE_POINTS_POPUP_TITLE'),
            transient_for: this.window,
            modal: true,
            window_position: Gtk.WindowPosition.CENTER,
            default_width: 560,
            default_height: 680,
            resizable: true
        });
        dialog.get_style_context().add_class('theme-repo-dialog');
        dialog.get_style_context().add_class('restore-points-shell');
        dialog.get_style_context().add_class('restore-points-dialog');
        dialog.connect('destroy', () => {
            stopAmbient();
            this.defaultRestorePointsDialog = null;
        });

        const root = dialog.get_content_area();
        root.get_style_context().add_class('restore-points-content');
        dialog.get_action_area?.()?.get_style_context?.()?.add_class('restore-points-content');
        root.set_spacing(12);
        root.set_margin_left(20);
        root.set_margin_right(20);
        root.set_margin_top(15);
        root.set_margin_bottom(15);

        const titleBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4
        });
        titleBox.get_style_context().add_class('restore-point-title-box');
        const title = new Gtk.Label({
            label: this.translate('RESTORE_POINTS_POPUP_TITLE'),
            xalign: 0
        });
        title.get_style_context().add_class('header-label');
        title.get_style_context().add_class('repo-title');

        const countLabel = new Gtk.Label({
            label: '',
            xalign: 0
        });
        countLabel.get_style_context().add_class('field-label');
        countLabel.get_style_context().add_class('restore-point-count-label');

        let ambientPlaying = false;
        let ambientLoopId = 0;
        const soundService = this.tryGetService?.('soundService') || null;
        const ambientFile = 'llsave.mp3';
        const ambientPath = soundService
            ? `${soundService.assetsDir}/${ambientFile}`
            : `${this.getCurrentDir?.() || GLib.get_current_dir()}/assets/${ambientFile}`;
        const hasAmbientFile = GLib.file_test(ambientPath, GLib.FileTest.EXISTS);

        let ambientPid = 0;
        let ambientWatchId = 0;

        const spawnAmbientLoop = () => {
            (ambientPlaying && hasAmbientFile) && tryRun('ThemeSelectorViewWindow.spawnAmbientLoop', () => {
                const [ok, pid] = GLib.spawn_async(
                    null,
                    ['ffplay', '-nodisp', '-autoexit', '-loglevel', 'quiet', '-volume', '10', ambientPath],
                    null,
                    GLib.SpawnFlags.SEARCH_PATH
                        | GLib.SpawnFlags.DO_NOT_REAP_CHILD
                        | GLib.SpawnFlags.STDOUT_TO_DEV_NULL
                        | GLib.SpawnFlags.STDERR_TO_DEV_NULL,
                    null
                );
                ok && pid && (
                    ambientPid = pid,
                    ambientWatchId = GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, () => {
                        ambientWatchId = 0;
                        ambientPid = 0;
                        ambientPlaying && spawnAmbientLoop();
                    })
                );
            });
        };

        const startAmbient = () => {
            (!ambientPlaying && hasAmbientFile) && (
                ambientPlaying = true,
                spawnAmbientLoop()
            );
        };

        const stopAmbient = () => {
            ambientPlaying = false;
            tryRun('ThemeSelectorViewWindow.stopAmbient', () => {
                ambientPid && GLib.spawn_sync(null, ['kill', String(ambientPid)], null, GLib.SpawnFlags.SEARCH_PATH, null);
            });
            ambientPid = 0;
            ambientWatchId = 0;
        };

        const musicBtn = new Gtk.Button();
        musicBtn.set_image(new Gtk.Image({icon_name: 'audio-volume-high-symbolic', icon_size: Gtk.IconSize.MENU}));
        musicBtn.get_style_context().add_class('circular');
        musicBtn.get_style_context().add_class('flat');
        musicBtn.get_style_context().add_class('tw-music-btn');
        musicBtn.set_tooltip_text('Ambient');
        musicBtn.set_no_show_all(true);
        ViewUtils.addPointerCursor?.(musicBtn);

        const setMusicBtnState = (playing) => {
            musicBtn.set_image(new Gtk.Image({
                icon_name: playing ? 'audio-volume-high-symbolic' : 'audio-volume-muted-symbolic',
                icon_size: Gtk.IconSize.MENU
            }));
            playing
                ? musicBtn.get_style_context().remove_class('tw-music-off')
                : musicBtn.get_style_context().add_class('tw-music-off');
        };

        musicBtn.connect('clicked', () => {
            ambientPlaying ? stopAmbient() : startAmbient();
            this._restorePointsMusicEnabled = ambientPlaying;
            setMusicBtnState(ambientPlaying);
        });

        const countRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
        countRow.pack_start(countLabel, false, false, 0);
        countRow.pack_start(musicBtn, false, false, 0);

        titleBox.pack_start(title, false, false, 0);
        titleBox.pack_start(countRow, false, false, 0);

        const infoBtn = new Gtk.Button();
        infoBtn.set_image(new Gtk.Image({icon_name: 'dialog-information-symbolic', icon_size: Gtk.IconSize.SMALL_TOOLBAR}));
        infoBtn.get_style_context().add_class('circular');
        infoBtn.get_style_context().add_class('flat');
        infoBtn.set_tooltip_text(this.translate('RESTORE_POINTS_INFO'));
        ViewUtils.addPointerCursor?.(infoBtn);
        infoBtn.connect('clicked', () => {
            const infoDialog = ViewUtils.showMessageDialog({
                parent: dialog,
                messageType: Gtk.MessageType.INFO,
                buttons: Gtk.ButtonsType.OK,
                title: this.translate('RESTORE_POINTS_POPUP_TITLE'),
                secondaryText: this.translate('RESTORE_POINTS_INFO')
            });
            infoDialog && (
                infoDialog.get_style_context().add_class('rp-info-dialog'),
                typewriterMode && infoDialog.get_style_context().add_class('tw-dialog'),
                infoDialog.get_action_area?.()?.set_layout?.(Gtk.ButtonBoxStyle.CENTER),
                (() => {
                    const okBtn = infoDialog.get_widget_for_response?.(Gtk.ResponseType.OK);
                    okBtn && (
                        okBtn.get_style_context().add_class('rp-info-ok-btn'),
                        okBtn.set_size_request(100, -1),
                        ViewUtils.addPointerCursor?.(okBtn)
                    );
                })()
            );
        });

        let typewriterMode = !!this._restorePointsTypewriterMode;
        const viewToggleBtn = new Gtk.Button();
        viewToggleBtn.set_image(new Gtk.Image({icon_name: typewriterMode ? 'view-grid-symbolic' : 'view-list-symbolic', icon_size: Gtk.IconSize.SMALL_TOOLBAR}));
        viewToggleBtn.get_style_context().add_class('circular');
        viewToggleBtn.get_style_context().add_class('flat');
        viewToggleBtn.set_tooltip_text('Typewriter');
        ViewUtils.addPointerCursor?.(viewToggleBtn);

        const headerRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 8});
        headerRow.pack_start(titleBox, true, true, 0);
        headerRow.pack_end(infoBtn, false, false, 0);
        headerRow.pack_end(viewToggleBtn, false, false, 0);

        const addPointBtn = new Gtk.Button();
        addPointBtn.set_image(new Gtk.Image({icon_name: 'list-add-symbolic', icon_size: Gtk.IconSize.MENU}));
        addPointBtn.set_tooltip_text(this.translate('ADD_RESTORE_POINT_BUTTON'));
        addPointBtn.set_size_request(32, 32);
        addPointBtn.get_style_context().add_class('my-theme-selector-icon-button');
        ViewUtils.addPointerCursor?.(addPointBtn);
        const cancelBtn = new Gtk.Button();
        cancelBtn.set_image(new Gtk.Image({icon_name: 'window-close-symbolic', icon_size: Gtk.IconSize.MENU}));
        cancelBtn.set_tooltip_text(this.translate('CANCEL'));
        cancelBtn.set_size_request(32, 32);
        cancelBtn.get_style_context().add_class('my-theme-selector-icon-button');
        ViewUtils.addPointerCursor?.(cancelBtn);
        cancelBtn.connect('clicked', () => dialog.destroy?.());
        root.pack_start(headerRow, false, false, 0);

        const listBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        listBox.get_style_context().add_class('restore-points-list');

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.ALWAYS,
            min_content_height: 470
        });
        scrolled.set_overlay_scrolling?.(false);
        scrolled.get_style_context().add_class('restore-point-scrolled');
        scrolled.add(listBox);

        const resolveRestoreService = () => (
            this.controller?.getRestorePointService?.()
            || (typeof this.controller?.container?.get === 'function'
                ? tryOrNull('ThemeSelectorViewWindow.resolveRestoreService', () => this.controller.container.get('restorePointService'))
                : null)
            || null
        );

        let currentPoints = [];
        const refreshList = () => {
            (listBox.get_children?.() || []).forEach((child) => listBox.remove(child));
            let restoreService = resolveRestoreService(),
                pointsFromController = this.controller?.listRestorePoints?.(1000) || [],
                pointsFromService = (typeof restoreService?.listRestorePoints === 'function')
                ? restoreService.listRestorePoints({limit: 1000})
                : [];
            let pendingSessionPoints = this.controller?.getSessionRestorePoints?.() || [],
                pointsById = new Map();
            [...pendingSessionPoints, ...pointsFromController, ...pointsFromService].forEach((point) => {
                const id = typeof point?.id === 'string' ? point.id : '';
                id.length && !pointsById.has(id) && pointsById.set(id, point);
            });
            let points = Array.from(pointsById.values());
            currentPoints = points;
            let activeId = this.controller?.getActiveRestorePointId?.()
                || restoreService?.getActiveRestorePointId?.()
                || null;
            let quickApplyPointId = points.some((point) => point.id === activeId)
                ? activeId
                : (points[0]?.id || null);
            !activeId && quickApplyPointId && this.controller?.setActiveRestorePointId?.(quickApplyPointId);
            let isBlinkActive = this.recentlyAddedRestorePointUntil > Date.now(),
                blinkingPointId = isBlinkActive
                ? (points.some((point) => point.id === this.recentlyAddedRestorePointId)
                    ? this.recentlyAddedRestorePointId
                    : (points[0]?.id || null))
                : null;
            !isBlinkActive && (
                this.recentlyAddedRestorePointId = null,
                this.recentlyAddedRestorePointUntil = 0
            );
            countLabel.set_text(this.translate('RESTORE_POINT_COUNT', {count: points.length}));

            let renderEmptyList = () => {
                const placeholder = new Gtk.Label({
                    label: this.translate('RESTORE_POINTS_EMPTY'),
                    xalign: 0
                });
                placeholder.get_style_context().add_class('field-label');
                listBox.pack_start(placeholder, false, false, 0);
            };
            let renderTypewriterList = () => {
                let rpRootDir = restoreService?.getRestorePointsRootDir?.() || `${GLib.get_home_dir()}/.config/themes/.restore_points`,
                    selectedIndex = typeof this._twSelectedSlotIndex === 'number' && this._twSelectedSlotIndex >= 0
                    ? this._twSelectedSlotIndex
                    : (() => {
                        const activeIdx = points.findIndex((point) => point.id === quickApplyPointId);
                        return activeIdx >= 0 ? activeIdx : 0;
                    })();
                this._twSelectedSlotIndex = selectedIndex;
                this.buildTypewriterView(points, listBox, refreshList, {
                    quickApplyPointId,
                    blinkingPointId,
                    selectedSlotIndex: selectedIndex,
                    setInteractionGuard: (ts) => { interactionGuard = ts; },
                    restorePointsRootDir: rpRootDir
                });
            };
            let renderClassicList = () => {
                points.forEach((point, index) => {
                    this.buildRestorePointRow(point, listBox, refreshList, {
                        quickApplyPointId,
                        blinkingPointId,
                        setInteractionGuard: (ts) => { interactionGuard = ts; }
                    });
                    index !== points.length - 1 && listBox.pack_start(
                        new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL}),
                        false,
                        false,
                        0
                    );
                });
            };
            let renderList = points.length === 0
                ? renderEmptyList
                : (typewriterMode ? renderTypewriterList : renderClassicList);
            renderList();
            listBox.show_all();
            scrolled.queue_draw?.();
        };

        const applyTypewriterStyle = (on) => {
            const ctx = dialog.get_style_context();
            on ? ctx.add_class('tw-dialog') : ctx.remove_class('tw-dialog');
            root.get_style_context()[on ? 'add_class' : 'remove_class']('tw-content');
            listBox.set_spacing(on ? 0 : 8);
            viewToggleBtn.set_image(new Gtk.Image({
                icon_name: on ? 'view-grid-symbolic' : 'view-list-symbolic',
                icon_size: Gtk.IconSize.SMALL_TOOLBAR
            }));
            const swapBtnChild = (widget) => {
                const old = addPointBtn.get_child();
                old && addPointBtn.remove(old);
                addPointBtn.add(widget);
                widget.show();
            };
            const swapLoadBtnChild = (widget) => {
                const old = loadPointBtn.get_child();
                old && loadPointBtn.remove(old);
                loadPointBtn.add(widget);
                widget.show();
            };
            const modeActions = {
                true: () => {
                    musicBtn.show();
                    (this._restorePointsMusicEnabled !== false ? startAmbient : stopAmbient)();
                    setMusicBtnState(ambientPlaying);
                    swapBtnChild(new Gtk.Label({label: 'SAVE'}));
                    addPointBtn.set_size_request(-1, 32);
                    addPointBtn.get_style_context().add_class('tw-save-btn');
                    swapLoadBtnChild(new Gtk.Label({label: 'LOAD'}));
                    loadPointBtn.set_size_request(-1, 32);
                    loadPointBtn.get_style_context().add_class('tw-save-btn');
                    loadPointBtn.show();
                },
                false: () => {
                    musicBtn.hide();
                    loadPointBtn.hide();
                    stopAmbient();
                    setMusicBtnState(false);
                    swapBtnChild(new Gtk.Image({icon_name: 'list-add-symbolic', icon_size: Gtk.IconSize.MENU}));
                    addPointBtn.set_size_request(32, 32);
                    addPointBtn.get_style_context().remove_class('tw-save-btn');
                    loadPointBtn.get_style_context().remove_class('tw-save-btn');
                }
            };
            modeActions[String(Boolean(on))]?.();
        };
        viewToggleBtn.connect('clicked', () => {
            typewriterMode = !typewriterMode;
            this._restorePointsTypewriterMode = typewriterMode;
            !typewriterMode && (this._twSelectedSlotIndex = -1);
            applyTypewriterStyle(typewriterMode);
            refreshList();
        });

        let blinkPulseId = 0;
        const startBlinkPulse = () => {
            blinkPulseId && GLib.source_remove(blinkPulseId);
            let glowOn = true;
            blinkPulseId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                const dialogClosed = !this.defaultRestorePointsDialog || this.defaultRestorePointsDialog !== dialog;
                const blinkExpired = this.recentlyAddedRestorePointUntil <= Date.now();
                if (dialogClosed || blinkExpired) {
                    blinkPulseId = 0;
                    blinkExpired && (
                        this._blinkingCard = null,
                        this._blinkingBadge = null,
                        this.recentlyAddedRestorePointId = null,
                        this.recentlyAddedRestorePointUntil = 0,
                        refreshList()
                    );
                    return GLib.SOURCE_REMOVE;
                }
                glowOn = !glowOn;
                const ctx = this._blinkingCard?.get_style_context?.();
                ctx && (glowOn ? ctx.add_class('restore-point-card-new-on') : ctx.remove_class('restore-point-card-new-on'));
                const badgeCtx = this._blinkingBadge?.get_style_context?.();
                badgeCtx && (glowOn ? badgeCtx.remove_class('restore-point-new-badge-dim') : badgeCtx.add_class('restore-point-new-badge-dim'));
                return GLib.SOURCE_CONTINUE;
            });
        };

        let interactionGuard = 0;
        let addPointInFlight = false;
        addPointBtn.connect('clicked', () => {
            if (addPointInFlight) return;
            typewriterMode && twNavSoundService?.playSound?.('tw_menu_click.wav');
            addPointInFlight = true;
            addPointBtn.set_sensitive?.(false);
            try {
                const pickerResult = this.askRestorePointFoldersSelection(
                    this.getRestorePointSelectedFoldersFromSettings()
                );
                if (!pickerResult) return;
                const selectedFolders = pickerResult.folders || pickerResult;
                const pointName = pickerResult.name || '';

                const restoreService = resolveRestoreService();
                let createdPoint = null;

                const canCreateSnapshot = Boolean(restoreService && typeof restoreService.createRestorePointSnapshot === 'function');
                canCreateSnapshot && (() => {
                    const defaultDir = restoreService.getDefaultThemeDir?.();
                    defaultDir && restoreService.regenerateEffective?.(defaultDir);
                    const sourceTheme = pointName
                        || this.controller?.settingsService?.getCurrentTheme?.()
                        || this.controller?.store?.get?.('currentTheme')
                        || 'default';
                    const snapshot = restoreService.createRestorePointSnapshot({
                        type: 'manual',
                        sourceTheme,
                        timestamp: restoreService.getCurrentLocalTimestamp?.(),
                        selectedFolders
                    });
                    snapshot?.id && (() => {
                        typeof restoreService.trimRestorePointConfigs === 'function'
                            && restoreService.trimRestorePointConfigs(snapshot.id, selectedFolders);
                        createdPoint = typeof restoreService.finalizeRestorePointSnapshot === 'function'
                            ? restoreService.finalizeRestorePointSnapshot(snapshot, 'ViewWindow.addPoint')
                            : snapshot;
                    })();
                })();

                const hasCreatedPoint = Boolean(createdPoint?.id);
                hasCreatedPoint
                    ? (
                        this.controller?.upsertSessionRestorePoint?.(createdPoint),
                        this.controller?.setActiveRestorePointId?.(createdPoint.id),
                        this.recentlyAddedRestorePointId = createdPoint.id,
                        this.recentlyAddedRestorePointUntil = Date.now() + 2200,
                        this._blinkingCard = null,
                        this._blinkingBadge = null,
                        refreshList(),
                        startBlinkPulse()
                    )
                    : (
                        this.showNotification(this.translate('RESTORE_POINT_CREATE_ERROR'), 'error'),
                        refreshList()
                    );
            } catch (_error) {
                this.showNotification(this.translate('RESTORE_POINT_CREATE_ERROR'), 'error');
            } finally {
                addPointInFlight = false;
                addPointBtn.set_sensitive?.(true);
            }
        });
        const loadPointBtn = new Gtk.Button();
        loadPointBtn.set_image(new Gtk.Image({icon_name: 'document-open-symbolic', icon_size: Gtk.IconSize.MENU}));
        loadPointBtn.set_tooltip_text(this.translate('RESTORE_POINT_ACTION_RESTORE'));
        loadPointBtn.set_size_request(32, 32);
        loadPointBtn.get_style_context().add_class('my-theme-selector-icon-button');
        loadPointBtn.set_no_show_all(true);
        ViewUtils.addPointerCursor?.(loadPointBtn);
        loadPointBtn.connect('clicked', () => {
            typewriterMode && twNavSoundService?.playSound?.('tw_menu_click.wav');
            const activeId = this.controller?.getActiveRestorePointId?.() || null;
            activeId && (
                loadPointBtn.set_sensitive(false),
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                    loadPointBtn.set_sensitive(true);
                    return GLib.SOURCE_REMOVE;
                }),
                this.controller?.restoreDefaultFromPoint?.(activeId)?.catch?.(() => {})
            );
        });

        dialog.get_action_area?.()?.hide?.();
        const bottomRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 0, hexpand: true});
        bottomRow.set_margin_top(8);
        const centerBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, halign: Gtk.Align.CENTER, hexpand: true, spacing: 8});
        centerBox.pack_start(loadPointBtn, false, false, 0);
        centerBox.pack_start(addPointBtn, false, false, 0);
        bottomRow.pack_start(centerBox, true, true, 0);
        bottomRow.pack_end(cancelBtn, false, false, 0);
        const footnote = new Gtk.Label({
            label: '* ' + this.translate('RESTORE_POINTS_FOOTNOTE'),
            xalign: 0,
            wrap: true,
            wrap_mode: 2
        });
        footnote.get_style_context().add_class('field-label');
        footnote.set_opacity(0.6);

        root.pack_end(footnote, false, false, 0);
        root.pack_end(bottomRow, false, false, 0);

        const eventBus = this.getEventBus?.();
        const listeners = [];
        const scheduleRefresh = () => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                refreshList();
                return GLib.SOURCE_REMOVE;
            });
        };
        eventBus && listeners.push(
            [Events.APPSETTINGS_RESTOREPOINT_DISPLAY, eventBus.on(Events.APPSETTINGS_RESTOREPOINT_DISPLAY, scheduleRefresh)],
            [Events.THEME_REPOSITORY_UPDATED, eventBus.on(Events.THEME_REPOSITORY_UPDATED, scheduleRefresh)]
        );
        const pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
            const isAlive = !!this.defaultRestorePointsDialog && this.defaultRestorePointsDialog === dialog;
            return !isAlive
                ? GLib.SOURCE_REMOVE
                : (interactionGuard > Date.now()
                    ? GLib.SOURCE_CONTINUE
                    : (refreshList(), GLib.SOURCE_CONTINUE));
        });

        typewriterMode && applyTypewriterStyle(true);
        refreshList();
        root.pack_start(scrolled, true, true, 0);

        this.defaultRestorePointsDialog = dialog;

        const twNavSoundService = this.tryGetService?.('soundService') || null;
        dialog.connect('key-press-event', (_w, event) => {
            if (!typewriterMode) return false;
            const keyval = event.get_keyval()[1];
            const totalSlots = Math.max(currentPoints.length, 20);
            const curIdx = typeof this._twSelectedSlotIndex === 'number' ? this._twSelectedSlotIndex : 0;

            const moveSelection = (direction) => {
                const nextIdx = direction < 0
                    ? (curIdx <= 0 ? totalSlots - 1 : curIdx - 1)
                    : (curIdx >= totalSlots - 1 ? 0 : curIdx + 1);
                this._twSelectedSlotIndex = nextIdx;
                const nextPoint = currentPoints[nextIdx];
                nextPoint && this.controller?.setActiveRestorePointId?.(nextPoint.id);
                twNavSoundService?.playSound?.('tw_item_select.wav');
                interactionGuard = Date.now() + 2000;
                this.markDefaultThemeStale();
                refreshList();
                return true;
            };
            const activateCurrentSlot = () => {
                const point = currentPoints[curIdx];
                twNavSoundService?.playSound?.('soft_apply.wav');
                point
                    ? (
                        loadPointBtn.set_sensitive(false),
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                            loadPointBtn.set_sensitive(true);
                            return GLib.SOURCE_REMOVE;
                        }),
                        this.controller?.restoreDefaultFromPoint?.(point.id)?.catch?.(() => {})
                    )
                    : addPointBtn.clicked();
                return true;
            };
            const showCurrentDetails = () => {
                const point = currentPoints[curIdx];
                if (!point) return false;
                twNavSoundService?.playSound?.('button_hover.wav');
                interactionGuard = Date.now() + 2000;
                this.showRestorePointDetailsDialog(point.id);
                return true;
            };

            const keyHandlers = {
                [Gdk.KEY_Up]: () => moveSelection(-1),
                [Gdk.KEY_Down]: () => moveSelection(1),
                [Gdk.KEY_Return]: activateCurrentSlot,
                [Gdk.KEY_KP_Enter]: activateCurrentSlot,
                [Gdk.KEY_space]: showCurrentDetails
            };
            const handler = keyHandlers[keyval];
            return handler ? handler() : false;
        });

        dialog.connect('destroy', () => {
            listeners.forEach(([eventName, listenerId]) => eventBus?.off?.(eventName, listenerId));
            blinkPulseId && GLib.source_remove(blinkPulseId);
            pollId && GLib.source_remove(pollId);
        });
        dialog.show_all();
        ViewUtils.setupPointerCursors?.(dialog);
    }

    async showThemeContextMenu(theme, tw, ev = null) {
        await tryOrNullAsync('showThemeContextMenu', () =>
            this.themeContextMenuController.showContextMenu(theme.name, this.currentTab === ViewTabName.NETWORK, tw, ev, theme)
        );
    }
}
