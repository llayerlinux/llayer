import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Commands } from '../../infrastructure/constants/Commands.js';
import { MAX_ARCHIVE_SIZE, MAX_PREVIEW_SIZE } from '../../infrastructure/constants/FileSafety.js';
import { tryOrNull, tryRun } from '../../infrastructure/utils/ErrorUtils.js';
import { TIMEOUTS } from '../../infrastructure/constants/Timeouts.js';

export function applyUploadThemeUseCaseUpload(targetPrototype) {

    targetPrototype.executeWithCallback = function(request = {}, options = {}, callback) {
        const {archivePath, previewPath, metadata = {}, serverAddressOverride = null} = request,
            fail = (key, params = null) => callback(new Error(this.translate(key, params)), null),
            normalized = this.parseMetadata(metadata),
            serverConfig = this.getServerConfig(serverAddressOverride),
            requestError = this.validateRequest({archivePath, previewPath, normalized, serverConfig});
        if (requestError) return fail(requestError.key, requestError.params);

        const archiveData = this.readFilePayload(archivePath, MAX_ARCHIVE_SIZE);
        if (!archiveData) return fail('UPLOAD_FILE_NOT_FOUND', {path: archivePath});

        const previewData = this.readFilePayload(previewPath, MAX_PREVIEW_SIZE);
        if (!previewData && previewPath) return fail('UPLOAD_FILE_READ_ERROR', {path: previewPath});

        const {serverUrl, allowInsecureUpload, useLegacyEndpoints} = serverConfig,
            endpoints = this.buildUploadEndpoints(serverUrl, useLegacyEndpoints);
        options.onProgress?.(0);

        const parts = {
            normalized,
            metadataJson: JSON.stringify({
                ...normalized,
                archiveHash: this.computeSha256(archiveData.bytes),
                previewHash: this.computeSha256(previewData.bytes),
                metadataVersion: 2,
                createdAt: new Date().toISOString()
            }),
            serverJson: JSON.stringify(this.buildServerThemePayload(normalized)),
            archive: archiveData,
            preview: previewData
        };

        function next(index) {
            if (index >= endpoints.length) return fail('UPLOAD_ERROR_UNKNOWN');
            const endpoint = endpoints[index];
            this.sendMultipartWithCallback(endpoint, parts, allowInsecureUpload, options, (error, response) => {
                error
                    ? (options.onProgress?.(0), next.call(this, index + 1))
                    : (options.onProgress?.(1), callback(null, response));
            });
        }

        next.call(this, 0);
    };

    targetPrototype.execute = function(request = {}, options = {}) {
        return new Promise((complete, fail) => {
            this.executeWithCallback(request, options, (error, response) => {
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    error ? fail(error) : complete(response);
                    return GLib.SOURCE_REMOVE;
                });
            });
        });
    };

    targetPrototype.sendMultipartWithCallback = function(endpoint, parts, allowInsecureUpload, options = {}, callback) {
        this.sendMultipartWithCurlInternal(endpoint, parts, allowInsecureUpload, options, callback);
    };

    targetPrototype.sendMultipartWithCurlInternal = function(endpoint, parts, allowInsecureUpload, options = {}, callback) {
        const tempDir = this.createTempDir(),
            progressPath = GLib.build_filenamev([tempDir, 'upload_progress.log']),
            responsePath = GLib.build_filenamev([tempDir, 'upload_response.json']),
            paths = {
            serverJsonPath: this.writeTextToTemp(tempDir, 'server.json', parts.serverJson || '{}'),
            metadataPath: this.writeTextToTemp(tempDir, 'metadata.json', parts.metadataJson || '{}'),
            archivePath: this.ensureFileForPart(parts.archive, tempDir, parts.archive?.filename || 'archive.bin'),
            previewPath: parts.preview ? this.ensureFileForPart(parts.preview, tempDir, parts.preview.filename || 'preview.bin') : null
        };
        if (!paths.archivePath) {
            this.cleanupTempDir(tempDir);
            callback(new Error('Missing upload archive data'), null);
            return;
        }

        const formArgs = this.buildFormArgs(endpoint, paths, parts),
            statusPath = GLib.build_filenamev([tempDir, 'http_status.txt']),
            commandParts = [Commands.CURL, '--max-time 900', '--progress-bar'];
        allowInsecureUpload && commandParts.push('--insecure');
        commandParts.push(
            `--output "${responsePath}"`,
            '--write-out "%{http_code}"',
            ...formArgs,
            `"${endpoint.url}"`,
            `2>"${progressPath}"`,
            `>"${statusPath}"`
        );

        const proc = Gio.Subprocess.new([Commands.BASH, '-c', commandParts.join(' ')], Gio.SubprocessFlags.NONE);

        let progressTimerId = null, lastProgress = 0, lastProgressUpdateAt = Date.now(),
            callbackInvoked = false, cancelled = false;

        options.onRegisterCancel?.(() => {
            cancelled = true;
            tryRun('upload.forceExit', () => proc.force_exit());
        });

        function guardedCallback(error, response) {
            callbackInvoked || (
                callbackInvoked = true,
                callback(error, response)
            );
        }

        function readThreshold() {
            return Math.max(0.5, Math.min(1, Number.isFinite(Number(options?.completeThreshold)) ? Number(options.completeThreshold) : 0.995));
        }

        function parseProgress() {
            const text = (this.readTextFile(progressPath) || '').trim();
            if (!text) return lastProgress;

            const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)],
                percent = matches.length ? parseFloat(matches.at(-1)[1]) / 100 : lastProgress;
            percent > lastProgress && (lastProgress = percent);

            return lastProgress;
        }

        function startProgressMonitor() {
            options.onProgress?.(0);
            progressTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.PROGRESS_POLL_MS, () => {
                const previous = lastProgress, progress = parseProgress.call(this);
                options.onProgress?.(progress);

                const now = Date.now();
                progress > previous && (lastProgressUpdateAt = now);

                const timeoutMs = Number.isFinite(Number(options?.completeAfterProgressMs))
                        ? Number(options.completeAfterProgressMs) : 4000,
                    threshold = readThreshold(),
                    shouldOptimisticComplete = !callbackInvoked
                    && progress >= threshold
                    && (now - lastProgressUpdateAt) >= timeoutMs;
                return shouldOptimisticComplete
                    ? (
                        tryOrNull('upload.optimisticExit', () => proc.force_exit()),
                        guardedCallback(null, {statusCode: 200, body: null, headers: null, optimistic: true}),
                        progressTimerId = null,
                        GLib.SOURCE_REMOVE
                    )
                    : GLib.SOURCE_CONTINUE;
            });
        }

        function stopProgressMonitor() {
            progressTimerId !== null && (
                GLib.source_remove(progressTimerId),
                progressTimerId = null
            );
        }

        startProgressMonitor.call(this);

        function finalize() {
            stopProgressMonitor();
            this.cleanupTempDir(tempDir);
        }

        proc.wait_async(null, (sub, result) => {
            const finished = tryOrNull('upload.waitFinish', () => sub.wait_finish(result));

            if (!callbackInvoked && !cancelled) {
                if (!finished) {
                    guardedCallback(new Error('Upload wait failed'), null);
                } else {
                    options.onProgress?.(1);
                    const parsed = this.parseUploadResult(sub, statusPath, responsePath),
                        statusCode = parseInt(this.readTextFile(statusPath).trim(), 10) || 0;

                    (parsed.error && lastProgress >= readThreshold() && statusCode === 0)
                        ? guardedCallback(null, {statusCode: 200, body: null, headers: null, optimistic: true})
                        : guardedCallback(parsed.error || null, parsed.error ? null : parsed.response);
                }
            }

            finalize.call(this);
        });
    };

    targetPrototype.buildFormArgs = function(endpoint, paths, parts) {
        const args = [],
            archiveType = parts.archive.contentType || 'application/gzip',
            previewType = parts.preview?.contentType || 'image/png',
            pushPreview = () => paths.previewPath && args.push(`-F \"preview=@${paths.previewPath};type=${previewType}\"`);

        if (endpoint.mode === 'legacy') {
            args.push(`-F \"name=${parts.normalized.name}\"`);
            args.push(`-F \"file=@${paths.archivePath};type=${archiveType}\"`);
            pushPreview();
            return args;
        }
        args.push(`-F \"json=<${paths.serverJsonPath};type=application/json\"`);
        args.push(`-F \"file=@${paths.archivePath};type=${archiveType}\"`);
        pushPreview();
        endpoint.mode !== 'themes' && args.push(`-F \"metadata=<${paths.metadataPath};type=application/json\"`);
        return args;
    };

    targetPrototype.parseUploadResult = function(proc, statusPath, responsePath) {
        const exitSuccess = proc.get_successful(), exitCode = proc.get_exit_status(),
            statusText = this.readTextFile(statusPath).trim(), responseText = this.readTextFile(responsePath),
            statusCode = parseInt(statusText, 10) || 0,
            responseJson = responseText ? tryOrNull('upload.parseUploadResult', () => JSON.parse(responseText)) : null;

        return (exitSuccess && statusCode >= 200 && statusCode < 400)
            ? {response: {statusCode, body: responseJson || responseText, headers: null}}
            : {error: new Error(this.mapServerError(
                responseJson?.error || responseJson?.message || responseText || `HTTP ${statusCode || exitCode}`,
                statusCode || exitCode || 0
            ))};
    };
}
