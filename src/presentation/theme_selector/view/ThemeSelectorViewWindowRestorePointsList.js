import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import * as ViewUtils from '../../common/ViewUtils.js';
import { tryOrDefault } from '../../../infrastructure/utils/ErrorUtils.js';

export function applyThemeSelectorViewWindowRestorePointsList(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeSelectorViewWindowRestorePointsList.prototype);
}

class ThemeSelectorViewWindowRestorePointsList {
    getRestorePointDirSizeMB(rootDir, pointId) {
        return rootDir && pointId
            ? tryOrDefault('ThemeSelectorViewWindow.getRestorePointDirSizeMB', () => {
                if (!GLib.file_test(`${rootDir}/${pointId}`, GLib.FileTest.IS_DIR)) return '';
                const [ok, stdout] = GLib.spawn_sync(null, ['du', '-sm', `${rootDir}/${pointId}`], null, GLib.SpawnFlags.SEARCH_PATH, null);
                return ok && stdout
                    ? ((mb) => isNaN(mb) ? '' : `${mb} MB`)(parseInt(new TextDecoder('utf-8').decode(stdout).trim().split('\t')[0], 10))
                    : '';
            }, '')
            : '';
    }

    buildTypewriterView(points, container, refreshList, options = {}) {
        const setInteractionGuard = typeof options.setInteractionGuard === 'function'
            ? options.setInteractionGuard
            : () => {};
        const quickApplyPointId = options.quickApplyPointId || null;
        const rpRootDir = options.restorePointsRootDir || '';
        const blinkingPointId = options.blinkingPointId || null;
        const selectedSlotIndex = typeof options.selectedSlotIndex === 'number' ? options.selectedSlotIndex : -1;

        this._twTypeAnimTimerId && GLib.source_remove(this._twTypeAnimTimerId);
        this._twTypeAnimTimerId = 0;
        if (blinkingPointId && this._twTypeAnimPointId !== blinkingPointId) {
            this._twTypeAnimPointId = blinkingPointId;
            this._twTypeAnimStart = Date.now();
        }

        const twSoundService = this.tryGetService?.('soundService') || null;

        const pointYears = points.filter(Boolean).map(p => (p.timestamp || '').slice(0, 4));
        const allSameYear = pointYears.length > 0 && pointYears.every(y => y === pointYears[0]);
        const fmtTime = (ts) => allSameYear ? (ts || '').replace(/^\d{4}-/, '') : (ts || '');

        const frame = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 0});
        frame.get_style_context().add_class('tw-frame');

        const headerRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 0});
        headerRow.get_style_context().add_class('tw-header');
        const rpLabel = this.translate('TW_COL_RESTORE_POINT');
        const createdLabel = this.translate('TW_COL_CREATED');
        const timeColW = allSameYear ? 110 : 140;
        const cols = [
            ['#', 32, false], [rpLabel, 0, true], ['Time', timeColW, false], [createdLabel, 80, false], ['Size', 70, false]
        ];
        cols.forEach(([label, width, expand]) => {
            const cell = new Gtk.Label({label, xalign: 0.5});
            width > 0 && cell.set_size_request(width, -1);
            cell.get_style_context().add_class('tw-header-cell');
            headerRow.pack_start(cell, expand, expand, 0);
        });
        frame.pack_start(headerRow, false, false, 0);

        const totalSlots = Math.max(points.length, 20);

        for (let i = 0; i < totalSlots; i++) {
            const point = points[i] || null;
            const isActive = selectedSlotIndex >= 0 ? i === selectedSlotIndex : (point && quickApplyPointId === point.id);
            const slotNum = String(i + 1).padStart(2, '0');

            const rowWrapper = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 0});
            rowWrapper.get_style_context().add_class('tw-row-wrapper');

            const row = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 0});
            row.get_style_context().add_class('tw-row');
            isActive && row.get_style_context().add_class('tw-row-active');
            !point && row.get_style_context().add_class('tw-row-empty');

            const numPlate = new Gtk.Label({label: slotNum, xalign: 0.5, yalign: 0.5});
            numPlate.get_style_context().add_class('tw-cell');
            numPlate.get_style_context().add_class('tw-slot-num');
            numPlate.set_size_request(32, -1);

            const chapterLabel = new Gtk.Label({label: point ? (point.sourceTheme || 'default') : '', xalign: 0, ellipsize: 3});
            chapterLabel.get_style_context().add_class('tw-cell');

            const timeLabel = new Gtk.Label({label: point ? fmtTime(point.timestamp) : '', xalign: 0.5});
            timeLabel.set_size_request(allSameYear ? 110 : 140, -1);
            timeLabel.get_style_context().add_class('tw-cell');

            const modeLabel = new Gtk.Label({label: point ? (point.type === 'automatic' ? 'AUTO' : 'MANUAL') : '', xalign: 0.5});
            modeLabel.set_size_request(80, -1);
            modeLabel.get_style_context().add_class('tw-cell');

            const sizeLabel = new Gtk.Label({label: point ? this.getRestorePointDirSizeMB(rpRootDir, point.id) : '', xalign: 1.0});
            sizeLabel.set_size_request(70, -1);
            sizeLabel.get_style_context().add_class('tw-cell');

            row.pack_start(numPlate, false, false, 0);
            row.pack_start(chapterLabel, true, true, 0);
            row.pack_start(timeLabel, false, false, 0);
            row.pack_start(modeLabel, false, false, 0);
            row.pack_start(sizeLabel, false, false, 0);
            rowWrapper.pack_start(row, true, true, 0);

            const isTyping = point && point.id === this._twTypeAnimPointId && this._twTypeAnimStart;
            if (isTyping) {
                const CHAR_MS = 150;
                const animTexts = [
                    point.sourceTheme || 'default',
                    fmtTime(point.timestamp),
                    point.type === 'automatic' ? 'AUTO' : 'MANUAL',
                    this.getRestorePointDirSizeMB(rpRootDir, point.id)
                ];
                const animLabels = [chapterLabel, timeLabel, modeLabel, sizeLabel];

                const applyTypedState = (elapsed) => {
                    let budget = Math.floor(elapsed / CHAR_MS);
                    for (let f = 0; f < animTexts.length; f++) {
                        const text = String(animTexts[f]);
                        if (budget >= text.length) {
                            animLabels[f].set_text(text);
                            budget -= text.length;
                        } else {
                            animLabels[f].set_text(text.substring(0, budget) + '\u2588');
                            for (let r = f + 1; r < animLabels.length; r++) {
                                animLabels[r].set_text('');
                            }
                            return false;
                        }
                    }
                    return true;
                };

                const elapsed = Date.now() - this._twTypeAnimStart;
                const done = applyTypedState(elapsed);

                if (done) {
                    this._twTypeAnimPointId = null;
                    this._twTypeAnimStart = null;
                } else {
                    let dead = false;
                    rowWrapper.connect('destroy', () => { dead = true; });
                    this._twTypeAnimTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, CHAR_MS, () => {
                        if (dead || !this._twTypeAnimStart) {
                            this._twTypeAnimTimerId = 0;
                            return GLib.SOURCE_REMOVE;
                        }
                        twSoundService?.playSound?.('tw_keystroke.wav');
                        const d = applyTypedState(Date.now() - this._twTypeAnimStart);
                        if (d) {
                            this._twTypeAnimTimerId = 0;
                            this._twTypeAnimPointId = null;
                            this._twTypeAnimStart = null;
                            return GLib.SOURCE_REMOVE;
                        }
                        return GLib.SOURCE_CONTINUE;
                    });
                }
            }

            {
                const slotIdx = i;
                const eventBox = new Gtk.EventBox();
                eventBox.set_visible_window(false);
                eventBox.add(rowWrapper);
                eventBox.add_events(
                    Gdk.EventMask.BUTTON_PRESS_MASK |
                    Gdk.EventMask.BUTTON_RELEASE_MASK |
                    Gdk.EventMask.POINTER_MOTION_MASK
                );
                ViewUtils.addPointerCursor?.(eventBox);

                let swipeOffset = 0;
                let swipeOpacity = 1;
                let pressX = -1;
                let dragging = false;

                rowWrapper.connect('draw', (widget, cr) => {
                    if (swipeOffset <= 0) return false;
                    const alloc = widget.get_allocation();
                    cr.save();
                    cr.translate(swipeOffset, 0);
                    cr.rectangle(-swipeOffset, 0, alloc.width, alloc.height);
                    cr.clip();
                    const ctx = widget.get_style_context();
                    Gtk.render_background(ctx, cr, 0, 0, alloc.width, alloc.height);
                    Gtk.render_frame(ctx, cr, 0, 0, alloc.width, alloc.height);
                    (widget.get_children?.() || []).forEach(child => {
                        widget.propagate_draw(child, cr);
                    });
                    cr.restore();
                    return true;
                });

                eventBox.connect('button-press-event', (_w, ev) => {
                    pressX = ev.get_coords()[1];
                    dragging = false;
                    return false;
                });
                eventBox.connect('motion-notify-event', (_w, ev) => {
                    if (pressX < 0 || !point) return false;
                    const curX = ev.get_coords()[1];
                    const dx = curX - pressX;
                    if (dx > 8) {
                        dragging = true;
                        swipeOffset = Math.round(dx);
                        swipeOpacity = Math.max(0.15, 1 - dx / 500);
                        rowWrapper.set_opacity(swipeOpacity);
                        rowWrapper.queue_draw();
                    } else if (dragging && dx <= 0) {
                        swipeOffset = 0;
                        swipeOpacity = 1;
                        rowWrapper.set_opacity(1);
                        rowWrapper.queue_draw();
                    }
                    return false;
                });
                eventBox.connect('button-release-event', (_w, ev) => {
                    const releaseX = ev.get_coords()[1];
                    const dx = pressX >= 0 ? releaseX - pressX : 0;
                    pressX = -1;

                    if (dragging && point && dx > 80) {
                        dragging = false;
                        setInteractionGuard(Date.now() + 3000);
                        twSoundService?.playSound?.('button_hover2.wav');
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
                            swipeOffset += 35;
                            swipeOpacity = Math.max(0, 1 - swipeOffset / 500);
                            rowWrapper.set_opacity(swipeOpacity);
                            rowWrapper.queue_draw();
                            if (swipeOffset >= 500) {
                                this.controller?.removeRestorePoint?.(point.id);
                                if (this._twSelectedSlotIndex === slotIdx) {
                                    this._twSelectedSlotIndex = Math.max(0, slotIdx - 1);
                                }
                                refreshList();
                                return GLib.SOURCE_REMOVE;
                            }
                            return GLib.SOURCE_CONTINUE;
                        });
                        return true;
                    }

                    if (dragging) {
                        dragging = false;
                        swipeOffset = 0;
                        swipeOpacity = 1;
                        rowWrapper.set_opacity(1);
                        rowWrapper.queue_draw();
                        return true;
                    }

                    if (point) {
                        const now = Date.now();
                        if (this._twLastClickPointId === point.id && (now - this._twLastClickTime) < 400) {
                            this._twLastClickPointId = null;
                            this._twLastClickTime = 0;
                            setInteractionGuard(Date.now() + 2000);
                            this.showRestorePointDetailsDialog(point.id);
                            return true;
                        }
                        this._twLastClickPointId = point.id;
                        this._twLastClickTime = now;
                        this.controller?.setActiveRestorePointId?.(point.id);
                    }
                    twSoundService?.playSound?.('tw_item_select.wav');
                    this._twSelectedSlotIndex = slotIdx;
                    setInteractionGuard(Date.now() + 2000);
                    this.markDefaultThemeStale();
                    refreshList();
                    return false;
                });
                frame.pack_start(eventBox, false, false, 0);
            }
        }

        container.pack_start(frame, true, true, 0);
    }

    buildRestorePointRow(point, container, refreshList, options = {}) {
        const quickApplyPointId = typeof options.quickApplyPointId === 'string'
            ? options.quickApplyPointId
            : null;
        const isQuickApplyTarget = !!quickApplyPointId && quickApplyPointId === point.id;
        const blinkingPointId = typeof options.blinkingPointId === 'string'
            ? options.blinkingPointId
            : null;
        const isBlinkingPoint = !!blinkingPointId && blinkingPointId === point.id;
        const setInteractionGuard = typeof options.setInteractionGuard === 'function'
            ? options.setInteractionGuard
            : () => {};
        const card = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            hexpand: true
        });
        card.set_opacity?.(1);
        card.get_style_context().add_class('restore-point-card');
        isQuickApplyTarget && card.get_style_context().add_class('restore-point-card-active');
        if (isBlinkingPoint) {
            card.get_style_context().add_class('restore-point-card-new-on');
            this._blinkingCard = card;
        }

        const row = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            hexpand: true
        });

        const infoBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            hexpand: true
        });

        const timestampLabel = new Gtk.Label({
            label: point.timestamp || this.translate('UNKNOWN'),
            xalign: 0
        });
        timestampLabel.get_style_context().add_class('repo-title');
        timestampLabel.set_line_wrap?.(true);

        const typeText = point.type === 'automatic'
            ? this.translate('RESTORE_POINT_TYPE_AUTOMATIC')
            : this.translate('RESTORE_POINT_TYPE_MANUAL');
        const typeLabel = new Gtk.Label({
            label: typeText,
            xalign: 1
        });
        typeLabel.get_style_context().add_class('restore-point-type-label');

        const metaLabel = new Gtk.Label({
            label: this.translate('RESTORE_POINT_META', {
                type: typeText,
                source: point.sourceTheme || 'default'
            }),
            xalign: 0
        });
        metaLabel.get_style_context().add_class('field-label');
        metaLabel.get_style_context().add_class('restore-point-source');
        metaLabel.set_line_wrap?.(true);

        const details = this.controller?.getRestorePointDetails?.(point.id);
        const sizeText = details?.totalSizeLabel || '';
        const sizeLabel = new Gtk.Label({
            label: sizeText,
            xalign: 0
        });
        sizeLabel.get_style_context().add_class('field-label');
        sizeLabel.get_style_context().add_class('restore-point-size-label');

        infoBox.pack_start(timestampLabel, false, false, 0);
        infoBox.pack_start(metaLabel, false, false, 0);
        sizeText.length && infoBox.pack_start(sizeLabel, false, false, 0);

        const restoreBtn = new Gtk.Button({
            label: this.translate('RESTORE_POINT_ACTION_RESTORE')
        });
        const detailsBtn = new Gtk.Button();
        const detailsIcon = new Gtk.Image({icon_name: 'document-edit-symbolic', icon_size: Gtk.IconSize.BUTTON});
        detailsBtn.set_image(detailsIcon);
        detailsBtn.set_tooltip_text(this.translate('RESTORE_POINT_ACTION_EDIT_SELECTED'));
        detailsBtn.get_style_context().add_class('circular');
        detailsBtn.get_style_context().add_class('flat');
        detailsBtn.get_style_context().add_class('restore-point-details-btn');
        const deleteBtn = new Gtk.Button();
        const deleteIcon = new Gtk.Image({icon_name: 'user-trash-symbolic', icon_size: Gtk.IconSize.BUTTON});
        deleteBtn.set_image(deleteIcon);
        deleteBtn.set_tooltip_text(this.translate('RESTORE_POINT_ACTION_DELETE'));
        deleteBtn.get_style_context().add_class('circular');
        deleteBtn.get_style_context().add_class('flat');
        deleteBtn.get_style_context().add_class('restore-point-delete-btn');
        restoreBtn.get_style_context().add_class('save-btn');
        ViewUtils.addPointerCursor?.(restoreBtn);
        ViewUtils.addPointerCursor?.(detailsBtn);
        ViewUtils.addPointerCursor?.(deleteBtn);

        restoreBtn.connect('clicked', async () => {
            setInteractionGuard(Date.now() + 2000);
            const result = await this.controller?.restoreDefaultFromPoint?.(point.id);
            const success = !!result?.success;
            !success && this.showNotification(this.translate('RESTORE_POINT_RESTORE_ERROR'), 'error');
            success && this.hideDefaultRestorePointsMenu();
        });

        detailsBtn.connect('clicked', () => {
            setInteractionGuard(Date.now() + 2000);
            this.showRestorePointDetailsDialog(point.id);
        });

        deleteBtn.connect('clicked', () => {
            setInteractionGuard(Date.now() + 2000);
            card.get_style_context().add_class('restore-point-card-deleting');
            const response = ViewUtils.runMessageDialog({
                parent: this.window,
                messageType: Gtk.MessageType.WARNING,
                buttons: Gtk.ButtonsType.YES_NO,
                title: this.translate('RESTORE_POINT_DELETE_CONFIRM_TITLE'),
                secondaryText: this.translate('RESTORE_POINT_DELETE_CONFIRM_TEXT', {
                    timestamp: point.timestamp || this.translate('UNKNOWN')
                })
            });
            if (response !== Gtk.ResponseType.YES) {
                card.get_style_context().remove_class('restore-point-card-deleting');
                return;
            }

            const removed = this.controller?.removeRestorePoint?.(point.id)?.success === true;
            if (!removed) {
                card.get_style_context().remove_class('restore-point-card-deleting');
                this.showNotification(this.translate('RESTORE_POINT_DELETE_ERROR'), 'error');
                return;
            }
            refreshList();
        });

        const actionsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6
        });
        actionsBox.get_style_context().add_class('restore-point-actions');

        actionsBox.pack_start(restoreBtn, false, false, 0);
        actionsBox.pack_start(detailsBtn, false, false, 0);
        actionsBox.pack_start(deleteBtn, false, false, 0);

        row.pack_start(infoBox, true, true, 0);
        let newBadge = null;
        if (isBlinkingPoint) {
            newBadge = new Gtk.Label({
                label: 'New',
                xalign: 0.5
            });
            newBadge.get_style_context().add_class('restore-point-new-badge');
            row.pack_start(newBadge, false, false, 0);
            this._blinkingBadge = newBadge;
        }
        if (isQuickApplyTarget) {
            const quickApplyIcon = new Gtk.Image({
                icon_name: 'object-select-symbolic',
                icon_size: Gtk.IconSize.MENU
            });
            quickApplyIcon.set_tooltip_text(this.translate('RESTORE_POINT_QUICK_APPLY_TARGET'));
            quickApplyIcon.get_style_context().add_class('restore-point-current-indicator');
            row.pack_start(quickApplyIcon, false, false, 0);
        }
        row.pack_start(typeLabel, false, false, 0);
        const infoEventBox = new Gtk.EventBox();
        infoEventBox.set_visible_window(false);
        infoEventBox.add(row);
        ViewUtils.addPointerCursor?.(infoEventBox);
        infoEventBox.connect('button-release-event', () => {
            setInteractionGuard(Date.now() + 2000);
            const currentActiveId = this.controller?.getActiveRestorePointId?.();
            if (currentActiveId === point.id) {
                return false;
            }
            this.controller?.setActiveRestorePointId?.(point.id);
            this.markDefaultThemeStale();
            refreshList();
            return false;
        });
        card.pack_start(infoEventBox, false, false, 0);
        card.pack_start(actionsBox, false, false, 0);
        ViewUtils.addPointerCursor?.(infoEventBox);
        container.pack_start(card, false, false, 0);
        isBlinkingPoint && card.queue_draw?.();
    }
}
