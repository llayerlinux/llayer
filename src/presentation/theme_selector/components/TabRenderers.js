export class TabRenderers {
    constructor(deps) {
        this.t = deps.t || ((k) => k);
        this.hideNetworkProgress = deps.hideNetworkProgress || (() => {
        });
        this.clearGridBox = deps.clearGridBox || (() => {
        });
        this.ensureThemeGridAttached = deps.ensureThemeGridAttached || (() => {
        });
        this.showPlaceholder = deps.showPlaceholder || (() => {
        });
        this.createPlaceholderInMainContent = deps.createPlaceholderInMainContent || (() => {
        });
        this.detachFromParent = deps.detachFromParent || (() => {
        });
        this.getMainContentBox = deps.getMainContentBox || (() => null);
        this.getGridBox = deps.getGridBox || (() => null);
        this.getScrollableGrid = deps.getScrollableGrid || (() => null);
        this.getDI = deps.getDI || (() => null);
        this.getMoreSectionsView = deps.getMoreSectionsView || (() => null);
        this.getAboutView = deps.getAboutView || (() => null);
    }

    resetGridView() {
        this.hideNetworkProgress();
        this.clearGridBox();
    }

    renderViewToGrid(getView, unavailableKey, errorKey) {
        this.resetGridView();
        this.ensureThemeGridAttached();
        let view = getView(),
            content = view?.createContent?.(),
            fallbackKey = !view ? unavailableKey : (!content ? errorKey : null);
        return fallbackKey
            ? this.showPlaceholder(this.t(fallbackKey))
            : (() => {
                const gridBox = this.getGridBox();
                this.detachFromParent(content);
                !content.get_parent?.() && gridBox && gridBox.pack_start(content, true, true, 0);
                view.show?.();
                gridBox?.show_all?.();
            })();
    }

    prepareMainContent() {
        this.resetGridView();
        const mainContentBox = this.getMainContentBox();
        return mainContentBox
            ? (() => {
                const scrollableGrid = this.getScrollableGrid();
                scrollableGrid && (this.detachFromParent(scrollableGrid), scrollableGrid.hide?.());
                mainContentBox.foreach?.(child => mainContentBox.remove(child));
                return mainContentBox;
            })()
            : null;
    }

    attachContent(mainContentBox, content) {
        this.detachFromParent(content);
        !content.get_parent?.() && mainContentBox.pack_start(content, true, true, 0);
        content.show_all?.();
        mainContentBox.show_all?.();
    }

    renderSettings() {
        const mainContentBox = this.prepareMainContent();
        return mainContentBox
            ? (() => {
                const DI = this.getDI(),
                      tweaksController = DI?.has?.('tweaksController') ? DI.get('tweaksController') : null,
                      content = tweaksController?.open?.() || tweaksController?.view?.tweaksNotebookGlobal,
                      placeholderKey = !tweaksController
                          ? 'TWEAKS_UNAVAILABLE'
                          : (!content ? 'TWEAKS_LOAD_ERROR' : null);
                return placeholderKey
                    ? this.createPlaceholderInMainContent(this.t(placeholderKey))
                    : this.attachContent(mainContentBox, content);
            })()
            : undefined;
    }

    renderMoreSections() {
        this.renderViewToGrid(
            () => this.getMoreSectionsView(),
            'MORE_SECTIONS_UNAVAILABLE',
            'MORE_SECTIONS_LOAD_ERROR'
        );
    }

    renderAbout() {
        this.renderViewToGrid(
            () => this.getAboutView(),
            'ABOUT_UNAVAILABLE',
            'ABOUT_LOAD_ERROR'
        );
    }
}
