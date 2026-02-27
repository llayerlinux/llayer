import { getGlobalRecommendationCategories, getGlobalRecommendedSettings } from './GlobalRecommendationsData.js';
import { applyGlobalRecommendationsStorage } from './GlobalRecommendationsStorage.js';
import { applyGlobalRecommendationsPopupLogic } from './GlobalRecommendationsPopupLogic.js';
import { showPopup, applyCustomStyles, loadRecommendations, groupByCategory } from './GlobalRecommendationsPopupCore.js';
import {
    buildHeader,
    buildFooter,
    buildCategoryHeader,
    buildRecommendationCard,
    buildWorkspaceSelector
} from './GlobalRecommendationsPopupUI.js';

export class GlobalRecommendationsPopup {
    constructor(options = {}) {
        this.t = options.t || ((key) => key);
        this.settingsManager = options.settingsManager || null;
        this.eventBus = options.eventBus || null;
        this.parentWindow = options.parentWindow || null;
        this.parameterService = options.parameterService || null;
        this.themeRepository = options.themeRepository || null;

        this.popup = null;
        this.globalOverrides = {};
        this.globalHotkeyOverrides = {};
        this.recommendationState = {};
        this.hyprlandExtraLines = [];
        this.selectedWorkspaces = new Set();
        this.contentBox = null;
        this._categoryCollapsed = {};

        this.loadCurrentOverrides();
    }

    getRecommendedSettings() {
        return getGlobalRecommendedSettings();
    }

    getRecommendationCategories() {
        return getGlobalRecommendationCategories();
    }

    show() {
        return showPopup(this);
    }

    applyCustomStyles() {
        return applyCustomStyles(this);
    }

    buildHeader() {
        return buildHeader(this);
    }

    buildFooter() {
        return buildFooter(this);
    }

    loadRecommendations() {
        return loadRecommendations(this);
    }

    buildCategoryHeader(category, catDef, isCollapsed, items) {
        return buildCategoryHeader(this, category, catDef, isCollapsed, items);
    }

    buildRecommendationCard(rec, children, allRecommendations) {
        return buildRecommendationCard(this, rec, children, allRecommendations);
    }

    buildWorkspaceSelector(rec) {
        return buildWorkspaceSelector(this, rec);
    }

    groupByCategory(recommendations) {
        return groupByCategory(recommendations);
    }

    destroy() {
        this.popup && (this.popup.destroy(), this.popup = null);
    }
}

applyGlobalRecommendationsStorage(GlobalRecommendationsPopup.prototype);
applyGlobalRecommendationsPopupLogic(GlobalRecommendationsPopup.prototype);
