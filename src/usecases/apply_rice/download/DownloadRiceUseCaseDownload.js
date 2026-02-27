import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {Commands} from '../../../infrastructure/constants/Commands.js';
import {Events} from '../../../app/eventBus.js';
import {isAutoApplyEnabled, removeSourceSafe} from '../../../infrastructure/utils/Utils.js';
import {SIZES, TIMEOUTS} from './DownloadRiceUseCaseConstants.js';
import {
    applyTemplate,
    createTemplatePath,
    getCachedTemplate
} from '../../../infrastructure/scripts/ScriptTemplateStore.js';

const DOWNLOAD_SCRIPT_TEMPLATE = createTemplatePath('download_script.sh');

function buildDownloadScriptContent(url, outputPath) {
    const template = getCachedTemplate(DOWNLOAD_SCRIPT_TEMPLATE);
    return template ? applyTemplate(template, {
        URL: url,
        OUTPUT_PATH: outputPath,
        WGET_TIMEOUT: TIMEOUTS.WGET_DOWNLOAD,
        CURL_TIMEOUT: TIMEOUTS.CURL_DOWNLOAD
    }) : '';
}

class DownloadRiceUseCaseDownload {
    removeFileIfExists(path) {
        const target = Gio.File.new_for_path(path);
        target.query_exists(null) && target.delete(null);
    }

    cancel(themeName) {
        this.activeDownloads.get(themeName)?.cancel?.();
    }

    async downloadFile(theme, url, outputPath, onProgress, onStatusChange = null, onProgressCallback = null) {
        return new Promise(async (done) => {
            let completed = false;
            let initialTid = 0;
            let tid = 0;
            let dlScript = '';

            function cleanupTimers() {
                tid = removeSourceSafe(tid);
                initialTid = removeSourceSafe(initialTid);
            }

            const finishDownload = (result) => {
                if (completed) return;
                completed = true;
                cleanupTimers();
                dlScript && (this.removeFileIfExists(dlScript), dlScript = '');
                this.activeDownloads.delete(theme.name);
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { done(result); return GLib.SOURCE_REMOVE; });
            };

            const handleProcessComplete = (_pid, status) => {
                GLib.spawn_close_pid?.(_pid);
                if (completed) return;
                cleanupTimers();

                let f = Gio.File.new_for_path(outputPath),
                    finalSize = f.query_exists(null)
                        ? f.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null).get_size()
                        : 0;

                if (finalSize <= SIZES.MIN_VALID_ARCHIVE) {
                    finishDownload({
                        success: false,
                        error: `Download failed: file invalid, status=${status}, size=${finalSize}`,
                        size: finalSize
                    });
                    return;
                }

                GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.POST_PROCESS_DELAY, () => {
                    this.onDownloadSuccess(theme, outputPath, finalSize, onProgressCallback, onStatusChange);
                    finishDownload({
                        success: true,
                        size: finalSize,
                        theme,
                        originalName: theme?.name || null
                    });
                    return GLib.SOURCE_REMOVE;
                });
            };

            this.removeFileIfExists(outputPath);
            dlScript = `${outputPath.split('/').slice(0, -1).join('/')}/dl_${Date.now()}_${theme.title || theme.name}.sh`;

            let scriptContent = buildDownloadScriptContent(url, outputPath);
            if (!scriptContent) {
                finishDownload({success: false, error: 'Download script template missing'});
                return;
            }

            let scriptFile = Gio.File.new_for_path(dlScript);
            scriptFile.replace_contents(scriptContent, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);

            let info = scriptFile.query_info('unix::mode', Gio.FileQueryInfoFlags.NONE, null),
                mode = info.get_attribute_uint32('unix::mode');
            info.set_attribute_uint32('unix::mode', mode | 0o111);
            scriptFile.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);

            let [spawnOk, pid] = GLib.spawn_async(
                null, ['/bin/bash', dlScript], null,
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD, null
            );

            if (!spawnOk || !pid) {
                finishDownload({success: false, error: 'Failed to start download process'});
                return;
            }

            this.activeDownloads.set(theme.name, {
                cancel: () => {
                    if (completed) return;
                    GLib.spawn_command_line_sync(`${Commands.PKILL} -P ${pid}`);
                    GLib.spawn_command_line_sync(`${Commands.KILL} -9 ${pid}`);
                    GLib.spawn_command_line_sync(`${Commands.RM} -f \"${outputPath}\"`);
                    finishDownload({success: false, error: 'canceled'});
                }
            });

            let initialProgressNotified = false;
            initialTid = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.INITIAL_POLL, () => {
                if (completed) return GLib.SOURCE_REMOVE;
                let fileExists = Gio.File.new_for_path(outputPath).query_exists(null);
                if (!fileExists && !initialProgressNotified && onProgress) {
                    onProgress(0);
                    initialProgressNotified = true;
                }
                return fileExists ? GLib.SOURCE_REMOVE : GLib.SOURCE_CONTINUE;
            });

            tid = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.PROGRESS_POLL, () => {
                if (completed) return GLib.SOURCE_REMOVE;
                let f = Gio.File.new_for_path(outputPath);
                if (!f.query_exists(null)) return GLib.SOURCE_CONTINUE;
                onProgress && onProgress(f.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null).get_size());
                initialTid = removeSourceSafe(initialTid);
                return GLib.SOURCE_CONTINUE;
            });

            if (!initialTid || !tid) {
                finishDownload({success: false, error: 'Failed to create monitoring timers'});
                return;
            }

            GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, handleProcessComplete);
        });
    }

    onDownloadSuccess(theme, outputPath, finalSize, onProgressCallback, onStatusChange) {
        onProgressCallback?.({
            downloaded: finalSize, totalSize: finalSize, percentage: 100, status: 'completed'
        });

        const installInfo = this.installDownloadedTheme(theme, outputPath);
        const completedTheme = {
            ...theme,
            name: theme?.name,
            localName: installInfo.name,
            localPath: installInfo.path,
            downloadCount: (typeof theme?.downloadCount === 'number'
                ? theme.downloadCount
                : parseInt(theme?.downloadCount, 10) || 0) + 1
        };

        this.postExtractActions(completedTheme, installInfo.path);

        onStatusChange?.({
            status: 'completed',
            theme: completedTheme,
            originalName: theme?.name || null,
            localName: installInfo.name,
            localPath: installInfo.path,
            success: true
        });

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.EVENT_BUS_DELAY, () => {
            const settings = this.settingsService?.getAll?.()
                || (this.settingsService?.getNetworkThemeSettings?.() ?? {});
            const autoApplyEnabled = isAutoApplyEnabled(settings);

            let payloadSource = completedTheme?.source || 'network';
            if (autoApplyEnabled) {
                payloadSource = 'apply_usecase';
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.AUTO_APPLY_DELAY, () => {
                    this.applyThemeUseCase?.execute?.(
                        completedTheme.name.trim(),
                        {source: 'theme_download_auto_apply', selectedInstallScript: null}
                    );
                    return GLib.SOURCE_REMOVE;
                });
            }

            this.eventBus?.emit?.(Events.THEME_DOWNLOAD_COMPLETE, {
                theme: completedTheme,
                originalName: theme?.name || null,
                source: payloadSource,
                autoApply: autoApplyEnabled,
                localName: installInfo.name,
                localPath: installInfo.path
            });
            this.eventBus?.emit?.(Events.THEME_REPOSITORY_UPDATED, {
                type: 'local', action: 'add', theme: completedTheme
            });
            return GLib.SOURCE_REMOVE;
        });
    }
}

export function applyDownloadRiceUseCaseDownload(targetProto) {
    copyPrototypeDescriptors(targetProto, DownloadRiceUseCaseDownload.prototype);
}
