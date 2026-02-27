import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=2.4';
import {SIZES, TIMEOUTS} from './DownloadRiceUseCaseConstants.js';
import { removeSourceSafe, translateWithFallback } from '../../../infrastructure/utils/Utils.js';

function fetchContentLength(url) {
    return new Promise((resolve) => {
        const u = typeof url === 'string' ? url : '';
        return (!u.startsWith('http://') && !u.startsWith('https://'))
            ? resolve(0)
            : (() => {
                const timeoutSeconds = Math.max(3, Number(TIMEOUTS.CURL_HEAD) || 8);
                const session = new Soup.Session();
                session.timeout = timeoutSeconds;
                session.idle_timeout = timeoutSeconds;

                const message = Soup.Message.new('HEAD', u);
                message.request_headers.append('Connection', 'close');

                let completed = false;
                let timeoutId = 0;

                const finish = (value) => {
                    completed || (
                        completed = true,
                        timeoutId = removeSourceSafe(timeoutId),
                        resolve(typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0)
                    );
                };

                timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeoutSeconds * 1000, () => {
                    session.abort?.();
                    finish(0);
                    return GLib.SOURCE_REMOVE;
                });

                session.queue_message(message, (_sess, msg) => {
                    const status = msg?.status_code ?? 0;
                    (status < 200 || status >= 400)
                        ? finish(0)
                        : (() => {
                            const header = msg?.response_headers?.get_one?.('Content-Length');
                            const parsed = header ? parseInt(String(header).trim(), 10) : 0;
                            finish(Number.isFinite(parsed) ? parsed : 0);
                        })();
                });
            })();
    });
}

class DownloadRiceUseCaseCore {
    translate(key, params = null) {
        const translator = this.diContainer?.get?.('translator') ?? null;
        return translateWithFallback(translator, key, params);
    }

    getExecAsyncFn() {
        return this.diContainer?.has?.('execAsync') ? this.diContainer.get('execAsync') : null;
    }

    updateProgress(progress, updates, onProgress) {
        Object.assign(progress, updates);
        onProgress({...progress});
    }

    async execute(theme, options = {}) {
        const {
            onProgress = () => {
            },
            onStatusChange = () => {
            }
        } = options;

        const totalTimeout = TIMEOUTS.TOTAL_DOWNLOAD;
        let timeoutId = null;

        return Promise.race([
            this.performDownload(theme, onProgress, onStatusChange),

            new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error(`Download operation timed out after ${totalTimeout / 1000} seconds`));
                }, totalTimeout);
            })
        ]).finally(() => timeoutId && clearTimeout(timeoutId));
    }

    async performDownload(theme, onProgress, onStatusChange) {
        const cacheDir = GLib.get_user_cache_dir() + '/theme-downloads';
        const archiveSourceUrl = theme.archiveUrl || theme.url || '';
        const downloadUrl = theme.downloadUrl || archiveSourceUrl;
        return !downloadUrl
            ? {success: false, error: 'Theme download URL is not available'}
            : (async () => {
                const archiveExtension = this.getArchiveExtension(archiveSourceUrl);
                const archivePath = `${cacheDir}/${theme.name}${archiveExtension}`;
                const extractDir = `${cacheDir}/${theme.name}_tmp`;
                const themesDir = `${GLib.get_home_dir()}/.config/themes`;

                this.ensureDirectory(cacheDir);
                this.ensureDirectory(extractDir);
                this.ensureDirectory(themesDir);

                const progress = {
                    downloaded: 0,
                    totalSize: 0,
                    percentage: 0,
                    status: 'downloading'
                };

                onStatusChange({status: 'start'});
                this.updateProgress(progress, {}, onProgress);
                progress.status = 'downloading';
                onStatusChange({status: 'downloading'});

                let downloadInFlight = true;
                fetchContentLength(downloadUrl).then((size) => {
                    (!downloadInFlight || size <= 0 || progress.totalSize !== 0) || (() => {
                        const percentage = progress.downloaded > 0
                            ? Math.min(99, Math.round((progress.downloaded / size) * 100))
                            : progress.percentage;
                        this.updateProgress(progress, {totalSize: size, percentage}, onProgress);
                    })();
                });

                const downloadResult = await this.downloadFile(
                    theme,
                    downloadUrl,
                    archivePath,
                    (downloadedBytes) => {
                        const percentage = progress.totalSize > 0
                            ? Math.min(99, Math.round((downloadedBytes / progress.totalSize) * 100))
                            : Math.min(95, Math.max(5, Math.round(downloadedBytes / SIZES.BYTES_PER_MB) * 5));
                        this.updateProgress(progress, {downloaded: downloadedBytes, percentage}, onProgress);
                    },
                    onStatusChange,
                    onProgress
                );
                downloadInFlight = false;

                return downloadResult.success
                    ? (
                        downloadResult.size && this.updateProgress(progress, {
                            totalSize: downloadResult.size,
                            downloaded: downloadResult.size,
                            percentage: 100,
                            status: 'completed'
                        }, onProgress),
                        {
                            success: true,
                            path: archivePath,
                            size: downloadResult.size || progress.totalSize,
                            theme: downloadResult.theme || theme
                        }
                    )
                    : {success: false, error: downloadResult.error || 'Download failed'};
            })();
    }

    cancelDownload(themeName) {
        this.cancel(themeName);
    }
}

export function applyDownloadRiceUseCaseCore(targetProto) {
    copyPrototypeDescriptors(targetProto, DownloadRiceUseCaseCore.prototype);
}
