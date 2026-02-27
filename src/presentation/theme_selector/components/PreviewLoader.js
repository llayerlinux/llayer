import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';
import {Commands} from '../../../infrastructure/constants/Commands.js';
import { DEFAULT_SERVER_ADDRESS } from '../../../infrastructure/constants/AppUrls.js';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';

export const AVATAR_EXTRACTORS = {
    'github.com': (url) => `https://avatars.githubusercontent.com/${url.split('/').pop()}`,
    'bitbucket.org': (url) => `https://bitbucket.org/account/${url.split('/').pop()}/avatar/128/`,
    'codeberg.org': (url) => `https://codeberg.org/${url.split('/').pop()}.png`
};

export class PreviewLoader {
    constructor(deps) {
        this.getServerAddress = deps.getServerAddress || (() => DEFAULT_SERVER_ADDRESS);
        this.getCurrentDir = deps.getCurrentDir || (() => GLib.get_current_dir());
        this.makeRoundedPixbuf = deps.makeRoundedPixbuf || null;
        this.cacheDir = `${GLib.get_user_cache_dir()}/lastlayer-theme-previews`;
        this.ensureCacheDir();
    }

    ensureCacheDir() {
        const dir = Gio.File.new_for_path(this.cacheDir);
        !dir.query_exists(null) && dir.make_directory_with_parents?.(null);
    }

    buildPreviewUrl(previewUrl) {
        return !previewUrl
            ? null
            : (previewUrl.startsWith('http://') || previewUrl.startsWith('https://'))
            ? previewUrl
            : this.getServerAddress() + previewUrl;
    }

    getCachePath(theme, previewUrl) {
        const urlTimestamp = previewUrl?.match(/[?&]t=(\d+)/)?.[1] || '';
        const safeName = (theme.name || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
        return `${this.cacheDir}/${safeName}_preview${urlTimestamp ? '_' + urlTimestamp : ''}.png`;
    }

    loadFromCache(cachePath, width) {
        const exists = Gio.File.new_for_path(cachePath).query_exists(null);
        return exists
            ? (this.makeRoundedPixbuf
            ? this.makeRoundedPixbuf(cachePath, width, 12)
            : GdkPixbuf.Pixbuf.new_from_file_at_scale(cachePath, width, width, true))
            : null;
    }

    setPixbufOnWidget(widget, pixbuf) {
        pixbuf && widget && GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            widget.set_from_pixbuf(pixbuf);
            return GLib.SOURCE_REMOVE;
        });
    }

    downloadPreview(url, cachePath, callback) {
        const encodedUrl = url.replace(/ /g, '%20');
        const subprocess = new Gio.Subprocess({
            argv: [Commands.CURL, '-fSL', '--max-time', '30', '--retry', '2', '-o', cachePath, encodedUrl],
            flags: Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE
        });
        subprocess.init(null);
        subprocess.wait_async(null, (sp, result) => {
            sp.wait_finish(result);
            callback(sp.get_successful() && Gio.File.new_for_path(cachePath).query_exists(null));
        });
    }

    loadNetworkPreview(theme, iconWidget, width, height) {
        let rawUrl = theme.previewUrl || theme.preview;
        rawUrl && (() => {
            let previewUrl = this.buildPreviewUrl(rawUrl),
                cachePath = this.getCachePath(theme, previewUrl),
                cachedPixbuf = this.loadFromCache(cachePath, width);
            cachedPixbuf
                ? this.setPixbufOnWidget(iconWidget, cachedPixbuf)
                : this.downloadPreview(previewUrl, cachePath, (success) => {
                    success
                        ? (() => {
                            const pixbuf = this.loadFromCache(cachePath, width);
                            pixbuf
                                ? this.setPixbufOnWidget(iconWidget, pixbuf)
                                : this.loadPlaceholderPreview(iconWidget, width);
                        })()
                        : this.loadPlaceholderPreview(iconWidget, width);
                });
        })();
    }

    loadPlaceholderPreview(iconWidget, width) {
        const placeholderPath = `${this.getCurrentDir()}/assets/default.png`;
        const pixbuf = this.makeRoundedPixbuf?.(placeholderPath, width, 12) || GdkPixbuf.Pixbuf.new_from_file_at_scale?.(placeholderPath, width, width, true);
        this.setPixbufOnWidget(iconWidget, pixbuf);
    }

    async extractAuthorAvatar(authorUrl) {
        return authorUrl
            ? (() => {
                const platformMatch = Object.entries(AVATAR_EXTRACTORS).find(([platform]) => authorUrl.includes(platform));
                return platformMatch
                    ? platformMatch[1](authorUrl)
                    : (authorUrl.includes('gitlab.com') ? this.fetchGitlabAvatar(authorUrl.split('/').pop()) : null);
            })()
            : null;
    }

    async fetchGitlabAvatar(username) {
        const response = await this.execAsync([Commands.CURL, '-s', `https://gitlab.com/api/v4/users?username=${username}`]);
        const users = response ? (tryOrNull('PreviewLoader.fetchGitlabAvatar.parse', () => JSON.parse(response)) || []) : [];
        return users[0]?.avatar_url || null;
    }

    async loadAndDisplayAvatar(avatarWidget, avatarUrl, makeCircularPixbuf) {
        const tempPath = `/tmp/avatar_${Date.now()}.png`;
        const downloaded = await this.execAsync([Commands.CURL, '-s', '-L', '--max-time', '30', '--retry', '2', avatarUrl, '-o', tempPath]);
        const exists = downloaded !== null && Gio.File.new_for_path(tempPath).query_exists(null);
        const pixbuf = exists && makeCircularPixbuf?.(tempPath, 64, 128);
        pixbuf ? (avatarWidget.image?.set_from_pixbuf?.(pixbuf), avatarWidget.container?.show?.()) : avatarWidget?.container?.hide?.();
    }

    async updateAuthorAvatar(authorText, avatarWidget, makeCircularPixbuf) {
        const authorUrl = authorText?.split(' | ')?.[1];
        return authorUrl
            ? (() => this.extractAuthorAvatar(authorUrl).then((avatarUrl) => (
                avatarUrl
                    ? this.loadAndDisplayAvatar(avatarWidget, avatarUrl, makeCircularPixbuf)
                    : avatarWidget?.container?.hide?.()
            )))()
            : undefined;
    }

    execAsync(argv) {
        return new Promise((complete, fail) => {
            const subprocess = new Gio.Subprocess({
                argv,
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });
            subprocess.init(null);
            subprocess.communicate_utf8_async(null, null, (proc, res) => {
                const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                proc.get_successful() ? complete(stdout) : fail(new Error(stderr || stdout));
            });
        });
    }
}
