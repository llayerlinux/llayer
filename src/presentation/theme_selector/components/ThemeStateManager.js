export class ThemeStateManager {
    constructor(deps) {
        this.getThemeItems = deps.getThemeItems || (() => ({}));
        this.getController = deps.getController || (() => null);
        this.showInstallProgress = deps.showInstallProgress || (() => {
        });
        this.hideInstallProgress = deps.hideInstallProgress || (() => {
        });
        this.activeDownloadStates = new Map();
        this.activeDownloadContainers = [];
    }

    setDownloadState(themeName, state) {
        if (!themeName) return;

        const normalizedState = state || {status: 'start', progress: 0};
        if (normalizedState.status === 'complete' || normalizedState.status === 'error') {
            this.activeDownloadStates.delete(themeName);
        } else {
            this.activeDownloadStates.set(themeName, normalizedState);
        }
        this.applyStateToCard(themeName, normalizedState);
    }

    updateProgress(themeName, progress) {
        const prev = this.activeDownloadStates.get(themeName) || {status: 'start', progress: 0};
        const p = typeof progress === 'number' ? progress : (progress?.percentage ?? 0);
        const next = {...prev, progress: p};
        this.activeDownloadStates.set(themeName, next);
        this.applyStateToCard(themeName, next);
    }

    collectDownloads() {
        let allDownloads = new Map(),
            controllerDownloading = this.getController()?.downloading;
        if (controllerDownloading instanceof Map) {
            controllerDownloading.forEach((state, name) => {
            state && name && allDownloads.set(name, {status: 'progress', progress: state.progress || 0});
            });
        }

        this.activeDownloadStates.forEach((state, name) => {
            (state && state.status !== 'complete' && name && !allDownloads.has(name)) && allDownloads.set(name, state);
        });
        this.activeDownloadContainers.forEach(c => {
            (c.themeName && !allDownloads.has(c.themeName)) && allDownloads.set(c.themeName, {status: 'progress', progress: 0});
        });
        return allDownloads;
    }

    applyToAllCards() {
        const allDownloads = this.collectDownloads();
        allDownloads.forEach((state, name) => this.applyStateToCard(name, state));
    }

    setProgressVisibility(container, progressBar, label, visible) {
        if (!container?.get_parent?.()) return;

        const ctx = container.get_style_context();
        ctx.remove_class(visible ? 'install-progress-hidden' : 'install-progress-visible');
        ctx.add_class(visible ? 'install-progress-visible' : 'install-progress-hidden');
        container.visible = visible;
        visible ? container.show() : container.hide();

        progressBar?.get_parent?.() && (
            visible ? progressBar.show?.() : progressBar.hide?.(),
            progressBar.set_fraction?.(0)
        );

        visible ? label?.show?.() : label?.hide?.();
    }

    getCardByThemeName(themeItems, themeName) {
        return !(themeItems && themeName)
            ? null
            : themeItems[themeName]
                || (() => {
                    const lowerName = themeName.toLowerCase();
                    const key = Object.keys(themeItems).find((candidate) => candidate.toLowerCase() === lowerName);
                    return key ? themeItems[key] : null;
                })();
    }

    applyStateToCard(themeName, state) {
        const card = this.getCardByThemeName(this.getThemeItems(), themeName);
        const prop = ((fb) => name => card?.[name] || fb?.[name])(card?.get_child?.());
        const [overlay, bar, label] = ['_installProgressContainer', '_installProgressBar', '_installingLabel'].map(prop);
        if (!(card && overlay && bar)) return;
        const show = !state || ['start', 'progress'].includes(state.status);
        this.setProgressVisibility(overlay, bar, label, show);
        show && bar.set_fraction?.((state?.progress ?? 0) / 100);
    }

    addContainer(container) {
        if (!container || this.activeDownloadContainers.includes(container)) return;
        this.activeDownloadContainers.push(container);
    }

    removeContainer(container) {
        const index = this.activeDownloadContainers.indexOf(container);
        if (index === -1) return;
        this.activeDownloadContainers.splice(index, 1);
    }
}
