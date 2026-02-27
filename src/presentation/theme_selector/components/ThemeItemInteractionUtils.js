import Gdk from 'gi://Gdk?version=3.0';
import { tryRun } from '../../../infrastructure/utils/ErrorUtils.js';

const liveThemeItems = new Map();
let themeItemIdCounter = 0;
let currentHoveredItemId = null;
const MENU_CLICK_BLOCK_MS = 500;
const MENU_HITBOX_SIZE = 40;

function setWidgetDisposedFlag(widget, disposed) {
    widget && (widget._llayerDisposed = disposed);
}

const markWidgetDisposed = (widget) => setWidgetDisposedFlag(widget, true);
const markWidgetAlive = (widget) => setWidgetDisposedFlag(widget, false);

function isThemeItemLive(item) {
    const itemId = item?._themeItemId;
    return !!itemId && liveThemeItems.has(itemId) && item?._llayerDisposed !== true;
}

function shouldIgnoreThemeClick(widget, event, isRunning) {
    const timeSince = widget?._menuClickTimestamp ? Date.now() - widget._menuClickTimestamp : null,
          allocation = widget?.get_allocation?.(),
          hasHitboxCoords = allocation && typeof event?.x === 'number' && typeof event?.y === 'number';
    return Boolean(
        isRunning
        || widget?._menuClicked
        || (typeof timeSince === 'number' && timeSince < MENU_CLICK_BLOCK_MS)
        || (hasHitboxCoords && event.x >= allocation.width - MENU_HITBOX_SIZE && event.y >= allocation.height - MENU_HITBOX_SIZE)
    );
}

function showApplyingProgress(ctx, progressContainer, progressBar, progressLabel, itemBox) {
    ctx.showProgress(progressContainer, progressBar, progressLabel, itemBox, 'applying');
}

function createProgressHandler(ctx, item, itemBox, progressContainer, progressBar, progressLabel) {
    const handlers = {
        start: ({phase}) => {
            ctx.showProgress(progressContainer, progressBar, progressLabel, itemBox, phase);
        },
        progress: ({phase, progress}) => {
            typeof progress === 'number' && progressBar.set_fraction(progress / 100);
            switch (phase) {
                case 'applying':
                    showApplyingProgress(ctx, progressContainer, progressBar, progressLabel, itemBox);
                    break;
                case '':
                case null:
                case undefined:
                    break;
                default:
                    ctx.updateProgressLabel(progressLabel, phase);
                    break;
            }
        },
        applying: () => {
            showApplyingProgress(ctx, progressContainer, progressBar, progressLabel, itemBox);
        },
        extracting: () => {
            ctx.updateProgressLabel(progressLabel, 'installing');
        },
        complete: () => {
            ctx.hideProgress(progressContainer, progressBar, progressLabel, itemBox);
        },
        error: () => {
            ctx.hideProgress(progressContainer, progressBar, progressLabel, itemBox);
        }
    };

    return (progressData = {}) => {
        isThemeItemLive(item) && (() => {
            const status = progressData.status;
            const phase = progressData.phase || 'downloading';
            handlers[status]?.({...progressData, phase});
        })();
    };
}

function releaseThemeItemTracking(itemId) {
    itemId && (
        currentHoveredItemId === itemId && (currentHoveredItemId = null),
        liveThemeItems.delete(itemId)
    );
}

function clearHoverFromItem(itemId) {
    const entry = ((raw) => raw && typeof raw === 'object' ? raw : {})(liveThemeItems.get(itemId));
    const { item, itemBox, themeItem } = entry;
    tryRun('clearHoverFromItem', () => {
        item?.get_style_context?.()?.remove_class?.('hover');
        itemBox?.get_style_context?.()?.remove_class?.('hover');
        themeItem?.removeDynamicGlow?.(itemBox);
        themeItem?.setPointerCursor?.(item, false);
    });
}

function clearOtherHovers(exceptItemId) {
    currentHoveredItemId && currentHoveredItemId !== exceptItemId && clearHoverFromItem(currentHoveredItemId);
    currentHoveredItemId = exceptItemId;
}

export function setPointerCursor(widget, enable) {
    const window = widget?.get_window?.();
    window?.set_cursor(enable ? Gdk.Cursor.new_from_name(window.get_display(), 'pointer') : null);
}

export function handleHoverEnter(ctx, widget, getItemBox, getItem) {
    const itemBox = getItemBox(),
          item = getItem?.(),
          itemId = item?._themeItemId;
    itemId && clearOtherHovers(itemId);

    item?.get_style_context().add_class('hover');
    itemBox?.get_style_context().add_class('hover');
    setPointerCursor(widget, true);
    return false;
}

export function connectIconHover(ctx, container, getItemBox, getItem) {
    container.connect('enter-notify-event', (widget) => handleHoverEnter(ctx, widget, getItemBox, getItem));
    container.connect('leave-notify-event', (widget) => {
        setPointerCursor(widget, false);
        return false;
    });
}

export function connectFocusLossHandler(ctx, item, itemBox) {
    const themeItemRef = ctx;
    const ensureTrackedItem = () => {
        item._themeItemId ||= ++themeItemIdCounter;
        markWidgetAlive(item);
        markWidgetAlive(itemBox);
        markWidgetAlive(itemBox?._snakeOverlay || item?._snakeOverlay);
        liveThemeItems.set(item._themeItemId, { item, itemBox, themeItem: themeItemRef });
    };

    item.connect('realize', () => {
        ensureTrackedItem();
    });
    item.connect('map', ensureTrackedItem);

    item.connect('unmap', () => {
        releaseThemeItemTracking(item._themeItemId);
        markWidgetDisposed(item);
        markWidgetDisposed(itemBox);
        markWidgetDisposed(itemBox?._snakeOverlay || item?._snakeOverlay);
        tryRun('connectFocusLossHandler.unmap', () => {
            themeItemRef.stopSnakeAnimation?.(itemBox?._snakeOverlay || item?._snakeOverlay);
            item.get_style_context?.()?.remove_class?.('hover');
            itemBox?.get_style_context?.()?.remove_class?.('hover');
            themeItemRef.removeDynamicGlow?.(itemBox);
        });
    });
}

export function connectHoverEvents(ctx, item, itemBox) {
    item.connect('enter-notify-event', (widget) => {
        const itemId = item._themeItemId;
        clearOtherHovers(itemId);

        item.get_style_context().add_class('hover');
        itemBox.get_style_context().add_class('hover');
        ctx.applyDynamicGlow(itemBox);
        setPointerCursor(widget, true);
        ctx.playHoverSound();
        return false;
    });

    item.connect('leave-notify-event', (widget, event) => {
        const detail = event?.get_detail?.() ?? event?.detail;
        return detail === Gdk.NotifyType.INFERIOR
            ? false
            : (
                item.get_style_context().remove_class('hover'),
                itemBox.get_style_context().remove_class('hover'),
                ctx.removeDynamicGlow(itemBox),
                setPointerCursor(widget, false),
                currentHoveredItemId === item._themeItemId && (currentHoveredItemId = null),
                false
            );
    });
}

export function connectClickEvent(ctx, item, theme, itemBox, progressContainer, progressBar, progressLabel) {
    markWidgetAlive(progressContainer);
    markWidgetAlive(progressBar);
    markWidgetAlive(progressLabel);
    item.connect('map', () => {
        markWidgetAlive(progressContainer);
        markWidgetAlive(progressBar);
        markWidgetAlive(progressLabel);
    });

    item.connect('unmap', () => {
        markWidgetDisposed(progressContainer);
        markWidgetDisposed(progressBar);
        markWidgetDisposed(progressLabel);
    });

    item.connect('button-release-event', async (widget, event) => {
        const isRunning = ctx.themeClickStates.get(theme.name) || false;
        if (shouldIgnoreThemeClick(widget, event, isRunning)) {
            return false;
        }

        ctx.themeClickStates.set(theme.name, true);
        const onInstallProgress = createProgressHandler(
            ctx,
            item,
            itemBox,
            progressContainer,
            progressBar,
            progressLabel
        );

        try {
            await ctx.onThemeClick(theme, { onInstallProgress });
        } finally {
            ctx.themeClickStates.set(theme.name, false);
        }
        return false;
    });
}
