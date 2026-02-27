import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {Commands} from '../../../../infrastructure/constants/Commands.js';
import { TIMEOUTS } from '../../../../infrastructure/constants/Timeouts.js';
import { tryOrNull } from '../../../../infrastructure/utils/ErrorUtils.js';

export function applyThemeContextMenuViewActionsAvatars(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, ThemeContextMenuViewActionsAvatars.prototype);
}

class ThemeContextMenuViewActionsAvatars {
    setAvatarPixbuf(avatarWidget, pixbuf) {
        if (!pixbuf || !avatarWidget?.image) return false;
        avatarWidget.image.set_from_pixbuf(pixbuf);
        avatarWidget.image.show?.();
        avatarWidget.container?.show?.();
        avatarWidget.image.queue_draw?.();
        avatarWidget.container?.queue_draw?.();
        return true;
    }

    async execAsync(command) {
        return new Promise((complete, fail) => {
            const [success, stdout, stderr, exit_status] = GLib.spawn_sync(
                null,
                command,
                null,
                GLib.SpawnFlags.SEARCH_PATH,
                null
            );

            success && exit_status === 0
                ? complete(new TextDecoder('utf-8').decode(stdout))
                : fail(new Error(`Command failed: ${new TextDecoder('utf-8').decode(stderr)}`));
        });
    }

    destroy() {
        this.hideMenu();
        this.avatarCache.clear();
        this.controller = null;
        this.logger = null;
        this.menuData = null;
    }

    loadSimpleAvatar(authorUrl, avatarWidget) {
        if (!authorUrl.includes('github.com')) return;

        const match = authorUrl.match(/github\.com\/([^\/]+)/);
        if (!match || !match[1]) return;

        const username = match[1];
        const avatarUrl = `https://avatars.githubusercontent.com/${username}`;
        const cacheDir = `${GLib.get_user_cache_dir()}/lastlayer/avatars`;
        const cachePath = `${cacheDir}/${username}.png`;

        if (this.avatarCache.has(avatarUrl)) {
            const cached = this.avatarCache.get(avatarUrl);

            const pixbuf = this.makeCircularPixbuf(cached.path, 56);
            if (pixbuf) {
                this.setAvatarPixbuf(avatarWidget, pixbuf);
                this.checkAvatarFreshness(avatarUrl, username, avatarWidget, cached);
                return;
            }
        }

        const cacheFile = Gio.File.new_for_path(cachePath);
        if (cacheFile.query_exists(null)) {
            const fileInfo = cacheFile.query_info('standard::size,time::modified', Gio.FileQueryInfoFlags.NONE, null);
            const fileSize = fileInfo.get_size();
            if (fileSize <= 100) {
                GLib.spawn_command_line_async(`${Commands.RM} -f "${cachePath}"`);
            } else {
                const pixbuf = this.makeCircularPixbuf(cachePath, 56);
                if (pixbuf) {
                    const modTime = fileInfo.get_modification_time().tv_sec * 1000;
                    const cachedEntry = { path: cachePath, username: username, timestamp: modTime };
                    this.setAvatarPixbuf(avatarWidget, pixbuf);
                    this.avatarCache.set(avatarUrl, cachedEntry);
                    this.checkAvatarFreshness(avatarUrl, username, avatarWidget, cachedEntry);
                    return;
                }
            }
        }

        GLib.spawn_command_line_sync(`${Commands.MKDIR} -p "${cacheDir}"`);

        const etagPath = `${cachePath}.etag`;

        const etagResult = Gio.File.new_for_path(etagPath).query_exists(null) ? GLib.file_get_contents(etagPath) : [false, null];
        const [okEtag, etag] = etagResult;
        const etagStr = okEtag ? new TextDecoder('utf-8').decode(etag).trim() : '';
        const etagHeader = etagStr ? `-H "If-None-Match: ${etagStr}"` : '';

        const curlCommand = `curl -s -L --max-time 5 -w "\\n%{http_code}" ${etagHeader} "${avatarUrl}" -o "${cachePath}" -D "${cachePath}.headers" 2>/dev/null`;

        GLib.spawn_command_line_async(curlCommand);

        let attempts = 0;
        const headersPath = `${cachePath}.headers`;
        const checkFile = () => {
            attempts += 1;
            const file = Gio.File.new_for_path(cachePath);
            if (!file.query_exists(null)) {
                const keepTrying = attempts < 15;
                keepTrying || avatarWidget.container.hide();
                return keepTrying;
            }

            const fileSize = file.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null).get_size();
            const [okHeaders, headersData] = GLib.file_get_contents(headersPath);
            const headersText = okHeaders ? new TextDecoder('utf-8').decode(headersData) : '';
            const notModified = headersText.includes('304');
            const etagMatch = headersText.match(/etag:\s*"?([^"\r\n]+)"?/i);
            etagMatch?.[1] && GLib.file_set_contents(etagPath, etagMatch[1]);

            const shouldRender = notModified || fileSize > 100;
            const pixbuf = shouldRender ? this.makeCircularPixbuf(cachePath, 56) : null;
            pixbuf
                ? (this.setAvatarPixbuf(avatarWidget, pixbuf),
                    this.avatarCache.set(avatarUrl, {path: cachePath, username, timestamp: Date.now()}),
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, notModified ? TIMEOUTS.FEEDBACK_SHORT_MS : TIMEOUTS.FEEDBACK_LONG_MS, () => {
                        GLib.spawn_command_line_async(`${Commands.RM} -f "${headersPath}"`);
                        return false;
                    }))
                : avatarWidget.container.hide();

            return false;
        };

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.TAB_SWITCH_DELAY_MS, checkFile);
    }

    checkAvatarFreshness(avatarUrl, username, avatarWidget, cached) {
        let [ok, etag] = GLib.file_get_contents(`${cached.path}.etag`),
            etagStr = ok ? new TextDecoder('utf-8').decode(etag).trim() : '';
        if ((Date.now() - (cached.timestamp || 0)) < 86400000 || !etagStr) return;
        let resultPath = `/tmp/etag_check_${String(username || 'user').replace(/[^a-zA-Z0-9_-]/g, '_') || 'user'}`;

        GLib.spawn_command_line_async(`${Commands.BASH} -c 'curl -s -I -L "${avatarUrl}" 2>/dev/null | grep -i etag > "${resultPath}" 2>&1'`);

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, TIMEOUTS.FEEDBACK_LONG_MS, () => {
            const serverEtag = tryOrNull('checkAvatarEtag', () =>
                Gio.File.new_for_path(resultPath).query_exists(null)
                    ? ((r) => r[0] ? new TextDecoder('utf-8').decode(r[1]).trim() : '')(GLib.file_get_contents(resultPath))
                    : ''
            ) || '';
            (serverEtag && !serverEtag.includes(etagStr))
                ? (this.avatarCache.delete(avatarUrl),
                    this.loadSimpleAvatar(`https://avatars.githubusercontent.com/${username}`, avatarWidget))
                : (cached.timestamp = Date.now(),
                    this.avatarCache.set(avatarUrl, cached));
            GLib.spawn_command_line_async(`${Commands.RM} -f "${resultPath}"`);
            return false;
        });
    }

    async loadAndDisplayAvatar(avatarWidget, avatarUrl) {
        await this.execAsync([Commands.WHICH, Commands.CURL]);

        const tempPath = `/tmp/avatar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await this.execAsync([Commands.BASH, '-c', `${Commands.CURL} -s -L --max-time 30 --retry 2 "${avatarUrl}" -o "${tempPath}"`]);

        const file = Gio.File.new_for_path(tempPath),
            fileExists = file.query_exists(null)
                && file.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null).get_size() >= 100,
            pixbuf = fileExists && this.makeCircularPixbuf(tempPath, 56);

        pixbuf && GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this.setAvatarPixbuf(avatarWidget, pixbuf);
            return false;
        });

        pixbuf && this.execAsync([Commands.RM, tempPath]);
    }

    getYoutubeIconPath() {
        const path = `${this.currentDir}/assets/youtube.png`;
        return Gio.File.new_for_path(path).query_exists(null) ? path : null;
    }

    createYoutubeIcon(width = 28, height = 28) {
        const usePath = this.getYoutubeIconPath();
        if (!usePath) return null;
        const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(usePath, width, height, true);
        const img = new Gtk.Image();
        pixbuf && img.set_from_pixbuf(pixbuf);
        return img;
    }
}
