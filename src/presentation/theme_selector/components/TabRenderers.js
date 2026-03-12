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
        this.getAIDynamicView = deps.getAIDynamicView || (() => null);
    }

    resetGridView() {
        this.hideNetworkProgress();
        this.clearGridBox();
    }

    attachGridContent(gridBox, content) {
        this.detachFromParent(content);
        if (!content.get_parent?.() && gridBox) {
            gridBox.pack_start(content, true, true, 0);
        }
        gridBox?.show_all?.();
    }

    renderViewToGrid(getView, unavailableKey, errorKey) {
        this.resetGridView();
        this.ensureThemeGridAttached();
        const entry = this.resolveViewEntry(getView);
        if (!entry) {
            return this.showPlaceholder(this.t(unavailableKey));
        }

        if (!entry.content) {
            return this.showPlaceholder(this.t(errorKey));
        }

        const gridBox = this.getGridBox();
        this.attachGridContent(gridBox, entry.content);
        entry.show?.();
    }

    prepareMainContent() {
        this.resetGridView();
        const mainContentBox = this.getMainContentBox();
        if (!mainContentBox) {
            return null;
        }

        const scrollableGrid = this.getScrollableGrid();
        if (scrollableGrid) {
            this.detachFromParent(scrollableGrid);
            scrollableGrid.hide?.();
        }
        mainContentBox.foreach?.(child => mainContentBox.remove(child));
        return mainContentBox;
    }

    attachContent(mainContentBox, content) {
        this.detachFromParent(content);
        !content.get_parent?.() && mainContentBox.pack_start(content, true, true, 0);
        content.show_all?.();
        mainContentBox.show_all?.();
    }

    showMainContentPlaceholder(key) {
        return this.createPlaceholderInMainContent(this.t(key));
    }

    renderMainContent(resolveEntry, unavailableKey, errorKey) {
        const mainContentBox = this.prepareMainContent();
        if (!mainContentBox) return;

        const entry = resolveEntry?.();
        if (!entry) {
            return this.showMainContentPlaceholder(unavailableKey);
        }

        if (!entry.content) {
            return this.showMainContentPlaceholder(errorKey);
        }

        this.attachContent(mainContentBox, entry.content);
        entry.show?.();
    }

    resolveTweaksEntry() {
        const DI = this.getDI();
        const tweaksController = DI?.has?.('tweaksController') ? DI.get('tweaksController') : null;
        return tweaksController && {
            content: tweaksController.open?.() || tweaksController.view?.tweaksNotebookGlobal
        };
    }

    resolveViewEntry(getView) {
        const view = getView?.();
        return view && {
            content: view.createContent?.(),
            show: () => view.show?.()
        };
    }

    renderSettings() {
        return this.renderMainContent(
            () => this.resolveTweaksEntry(),
            'TWEAKS_UNAVAILABLE',
            'TWEAKS_LOAD_ERROR'
        );
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

    renderAIDynamic() {
        return this.renderMainContent(
            () => this.resolveViewEntry(() => this.getAIDynamicView()),
            'AI_DYNAMIC_UNAVAILABLE',
            'AI_DYNAMIC_LOAD_ERROR'
        );
    }
}
