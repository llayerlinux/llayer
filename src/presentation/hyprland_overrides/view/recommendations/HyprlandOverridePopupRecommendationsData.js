import { getRecommendationCategories, getRecommendedSettings } from './HyprlandRecommendationsData.js';

export function applyHyprlandOverridePopupRecommendationsData(prototype) {


    prototype.getRecommendationCategories = function() {
        return getRecommendationCategories();
    };

    prototype.getRecommendedSettings = function() {
        return getRecommendedSettings();
    };

    prototype.groupRecommendationsByCategory = function(recommendations) {
        const grouped = {};
        for (const rec of recommendations) {
            const cat = rec.category || 'OTHER';
            grouped[cat] ||= [];
            grouped[cat].push(rec);
        }
        return grouped;
    };

    prototype.getRecommendationById = function(recId) {
        return recId
            ? ((this.getRecommendedSettings().find(rec => rec.id === recId)) || null)
            : null;
    };
}
