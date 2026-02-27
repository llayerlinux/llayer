import Gtk from 'gi://Gtk?version=3.0';

export function createItemBox(iconWidget, overlayElements, themeName, nameLabel, snakeOverlay) {
    const itemBox = new Gtk.Overlay();
    itemBox.add(iconWidget);
    overlayElements.forEach(el => itemBox.add_overlay(el));
    itemBox.get_style_context().add_class('my-theme-selector-item-box');
    itemBox._themeName = themeName;
    itemBox._iconWidget = iconWidget;
    itemBox._nameLabel = nameLabel;
    itemBox._snakeOverlay = snakeOverlay;
    return itemBox;
}

export function createItemContainer(itemBox) {
    const item = new Gtk.EventBox();
    item.get_style_context().add_class('my-theme-selector-item');
    item.add(itemBox);
    return item;
}

export function attachProgressRefs(item, itemBox, container, bar, label, snakeOverlay) {
    item._installProgressContainer = container;
    item._installProgressBar = bar;
    item._installingLabel = label;
    item._snakeOverlay = snakeOverlay;
    itemBox._installProgressContainer = container;
    itemBox._installProgressBar = bar;
    itemBox._installingLabel = label;
}
