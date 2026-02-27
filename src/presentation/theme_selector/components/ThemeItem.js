import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import {ViewTabName} from '../../common/Constants.js';
import {applyThemeItemEffects} from './ThemeItemEffects.js';
import { createItemBox, createItemContainer, attachProgressRefs } from './ThemeItemLayoutUtils.js';
import {
    extractEdgeColor,
    getIconPath,
    loadNetworkPreviewImage,
    loadLocalPreviewImage
} from './ThemeItemImageUtils.js';
import {
    createPropertyIcons,
    createPropertyIcon,
    createBadge,
    createHoverContainer,
    createVariantCircles,
    createVariantCircle,
    parseHexColor,
    createNameLabel,
    createMenuButton,
    handleMenuButtonPress
} from './ThemeItemOverlayUtils.js';
import {
    setPointerCursor,
    handleHoverEnter,
    connectIconHover,
    connectFocusLossHandler,
    connectHoverEvents,
    connectClickEvent
} from './ThemeItemInteractionUtils.js';

export class ThemeItem {
    static PREVIEW_WIDTH = 180;
    static PREVIEW_HEIGHT = 180;

    constructor(deps) {
        this.t = deps.t || ((key) => key);
        this.createIcon = deps.createIcon || (() => null);
        this.makeRoundedPixbuf = deps.makeRoundedPixbuf || (() => null);
        this.loadNetworkPreview = deps.loadNetworkPreview || (() => {
        });
        this.onThemeClick = deps.onThemeClick || (() => {
        });
        this.onMenuClick = deps.onMenuClick || (() => {
        });
        this.onVariantClick = deps.onVariantClick || (() => {
        });
        this.playHoverSound = deps.playHoverSound || (() => {
        });
        this.getCurrentTheme = deps.getCurrentTheme || (() => null);
        this.currentTab = deps.currentTab || ViewTabName.INSTALLED;
        this.currentDir = deps.currentDir || GLib.get_current_dir();
        this.themeClickStates = new Map();
    }

    extractEdgeColor(pixbuf) {
        return extractEdgeColor(pixbuf);
    }

    create(theme) {
        let PREVIEW_WIDTH = ThemeItem.PREVIEW_WIDTH, PREVIEW_HEIGHT = ThemeItem.PREVIEW_HEIGHT;
        let itemBox, item;
        let overlayElements = [], isInstalledTab = this.currentTab === ViewTabName.INSTALLED,
            isNetworkTab = this.currentTab === ViewTabName.NETWORK;
        let iconPath = this.getIconPath(theme, isInstalledTab, isNetworkTab);

        let iconWidget = new Gtk.Image();
        iconWidget.get_style_context().add_class('theme-preview-image');
        iconWidget.set_halign(Gtk.Align.CENTER);
        iconWidget.set_hexpand(true);
        iconWidget.set_size_request(PREVIEW_WIDTH, PREVIEW_HEIGHT);

        let loadPreview = isNetworkTab
            ? () => this.loadNetworkPreviewImage(theme, iconWidget, PREVIEW_WIDTH)
            : () => this.loadLocalPreviewImage(iconPath, iconWidget, PREVIEW_WIDTH);
        loadPreview();

        const iconsBox = this.createPropertyIcons(theme, isInstalledTab, isNetworkTab, () => itemBox, () => item);
        iconsBox && overlayElements.push(iconsBox);

        const variantCircles = this.createVariantCircles(theme, () => itemBox, () => item);
        variantCircles && overlayElements.push(variantCircles);

        const nameLabel = this.createNameLabel(theme.name);
        overlayElements.push(nameLabel);

        overlayElements.push(this.createMenuButton(theme, () => item, () => itemBox));

        const {
            container: installProgressContainer,
            bar: installProgressBar,
            label: installingLabel
        } = this.createInstallProgress();
        overlayElements.push(installProgressContainer);

        const snakeOverlay = this.createSnakeOverlay();
        overlayElements.push(snakeOverlay);

        itemBox = this.createItemBox(iconWidget, overlayElements, theme.name, nameLabel, snakeOverlay);

        this.isThemeActive(theme) && itemBox.get_style_context().add_class('my-theme-selector-item-selected');

        item = this.createItemContainer(itemBox);
        this.attachProgressRefs(item, itemBox, installProgressContainer, installProgressBar, installingLabel, snakeOverlay);

        this.connectHoverEvents(item, itemBox);
        this.connectClickEvent(item, theme, itemBox, installProgressContainer, installProgressBar, installingLabel);
        this.connectFocusLossHandler(item, itemBox);
        return item;
    }

    createItemBox(iconWidget, overlayElements, themeName, nameLabel, snakeOverlay) {
        return createItemBox(iconWidget, overlayElements, themeName, nameLabel, snakeOverlay);
    }

    createItemContainer(itemBox) {
        return createItemContainer(itemBox);
    }

    attachProgressRefs(item, itemBox, container, bar, label, snakeOverlay) {
        attachProgressRefs(item, itemBox, container, bar, label, snakeOverlay);
    }

    getIconPath(theme, isInstalledTab, isNetworkTab) {
        return getIconPath(theme, isInstalledTab, isNetworkTab, this.currentDir);
    }

    loadNetworkPreviewImage(theme, iconWidget, width) {
        loadNetworkPreviewImage(theme, iconWidget, width, this.createIcon, this.loadNetworkPreview);
    }

    loadLocalPreviewImage(iconPath, iconWidget, width) {
        loadLocalPreviewImage(iconPath, iconWidget, width, this.currentDir, this.makeRoundedPixbuf, this.extractEdgeColor.bind(this));
    }

    createPropertyIcons(theme, isInstalledTab, isNetworkTab, getItemBox, getItem) {
        return createPropertyIcons(this, theme, isInstalledTab, isNetworkTab, getItemBox, getItem);
    }

    createPropertyIcon(iconName, className, getItemBox, getItem) {
        return createPropertyIcon(this, iconName, className, getItemBox, getItem);
    }

    createBadge(letter, className, getItemBox, getItem) {
        return createBadge(this, letter, className, getItemBox, getItem);
    }

    createHoverContainer(child, getItemBox, getItem) {
        return createHoverContainer(this, child, getItemBox, getItem);
    }

    createVariantCircles(theme, getItemBox, getItem) {
        return createVariantCircles(this, theme, getItemBox, getItem);
    }

    createVariantCircle(theme, variantName, color, isActive, getItemBox, getItem) {
        return createVariantCircle(this, theme, variantName, color, isActive, getItemBox, getItem);
    }

    parseHexColor(hex) {
        return parseHexColor(hex);
    }

    setPointerCursor(widget, enable) {
        setPointerCursor(widget, enable);
    }

    handleHoverEnter(widget, getItemBox, getItem) {
        return handleHoverEnter(this, widget, getItemBox, getItem);
    }

    connectIconHover(container, getItemBox, getItem) {
        connectIconHover(this, container, getItemBox, getItem);
    }

    createNameLabel(name) {
        return createNameLabel(name);
    }

    createMenuButton(theme, getItem, getItemBox) {
        return createMenuButton(this, theme, getItem, getItemBox);
    }

    handleMenuButtonPress(item, theme, menuBtn) {
        return handleMenuButtonPress(this, item, theme, menuBtn);
    }

    isThemeActive(theme) {
        return this.getCurrentTheme() === theme.name;
    }

    connectFocusLossHandler(item, itemBox) {
        connectFocusLossHandler(this, item, itemBox);
    }

    connectHoverEvents(item, itemBox) {
        connectHoverEvents(this, item, itemBox);
    }

    connectClickEvent(item, theme, itemBox, progressContainer, progressBar, progressLabel) {
        connectClickEvent(this, item, theme, itemBox, progressContainer, progressBar, progressLabel);
    }

    clearClickStates() {
        this.themeClickStates.clear();
    }
}

applyThemeItemEffects(ThemeItem.prototype);
