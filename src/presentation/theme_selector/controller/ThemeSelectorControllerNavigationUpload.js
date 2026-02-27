import GLib from 'gi://GLib';
import { TIMEOUTS } from '../../../infrastructure/constants/Timeouts.js';

export function applyThemeSelectorControllerNavigationUpload(targetPrototype) {
    targetPrototype.handleUploadTheme = function(uploadRequest = {}, options = {}) {
        if (this.uploadInFlight) {
            return Promise.reject(new Error(this.translate('UPLOAD_IN_PROGRESS')));
        }

        this.uploadInFlight = true;
        let completed = false;
        let fallbackId = null;

        const clearFallback = () => {
            if (fallbackId === null) return;
            GLib.source_remove(fallbackId);
            fallbackId = null;
        };

        const finalizeSuccess = (result) => {
            if (completed) return;
            completed = true;
            clearFallback();
            this.uploadInFlight = false;

            options.onSuccess?.(result);
            this.loadNetworkThemes({
                forceRefresh: true,
                page: this.networkPagination?.page,
                pageSize: this.networkPagination?.pageSize
            });
        };

        const finalizeError = (error) => {
            if (completed) return;
            completed = true;
            clearFallback();
            this.uploadInFlight = false;
            options.onError?.(error);
        };

        const wrappedOptions = {
            ...options,
            onProgress: (progress) => {
                options.onProgress?.(progress);
                const p = Number(progress) || 0;
                if (!completed && p >= 0.99 && fallbackId === null) {
                    fallbackId = GLib.timeout_add(
                        GLib.PRIORITY_DEFAULT,
                        TIMEOUTS.FALLBACK_TIMEOUT_MS,
                        () => {
                            finalizeSuccess(null);
                            return GLib.SOURCE_REMOVE;
                        }
                    );
                }
            },
            onSuccess: finalizeSuccess,
            onError: finalizeError
        };

        this.uploadThemeUseCase.executeWithCallback(uploadRequest, wrappedOptions, (error, result) => {
            if (error) {
                finalizeError(error);
                return;
            }
            finalizeSuccess(result);
        });

        return Promise.resolve();
    };
}
