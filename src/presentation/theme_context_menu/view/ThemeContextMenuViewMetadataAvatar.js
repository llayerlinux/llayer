import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import cairo from 'cairo';
import { Commands } from '../../../infrastructure/constants/Commands.js';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';

class ThemeContextMenuViewMetadataAvatar {
    createAuthorAvatarWidget() {

        const avatarContainer = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 2,
            margin_bottom: 2,
            width_request: 60,
            height_request: 60
        });

        const avatarImage = new Gtk.Image({
            pixel_size: 56,
            halign: Gtk.Align.START,
            valign: Gtk.Align.CENTER
        });
        avatarImage.get_style_context().add_class('author-avatar');

        avatarContainer.pack_start(avatarImage, false, false, 0);

        return {container: avatarContainer, image: avatarImage};
    }

    async updateAuthorAvatar(authorText, avatarWidget) {
        avatarWidget.container.show();

        const authorUrl = typeof authorText === 'string'
            ? authorText.split(' | ')[1]?.trim()
            : null;
        const avatarUrl = authorUrl && await this.extractAuthorAvatar(authorUrl);
        return avatarUrl
            ? (await this.loadAndDisplayAvatar(avatarWidget, avatarUrl), GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                avatarWidget.container.queue_draw();
                return false;
            }), undefined)
            : avatarWidget.container.hide();
    }

    async extractAuthorAvatar(authorUrl) {
        const normalizedUrl = typeof authorUrl === 'string' ? authorUrl : '';
        if (!normalizedUrl) return null;

        function extractUsername(regex) { return normalizedUrl.match(regex)?.[1] || null; }

        const directAvatar = [
            [/github\.com\/([^\/]+)/, (u) => `https://avatars.githubusercontent.com/${u}`],
            [/bitbucket\.org\/([^\/]+)/, (u) => `https://bitbucket.org/account/${u}/avatar/128/`]
        ].reduce((found, [regex, toAvatar]) => found || ((u) => u && toAvatar(u))(extractUsername(regex)), null);

        const gitlabUsername = extractUsername(/gitlab\.com\/([^\/]+)/),
              gitlabAvatarUrl = gitlabUsername
                  ? await this.execAsync([Commands.CURL, '-s', `https://gitlab.com/api/v4/users?username=${gitlabUsername}`]).then((response) => {
                      let users = tryOrNull('ThemeContextMenuViewMetadataAvatar.extractAuthorAvatar.parseGitlab', () => JSON.parse(response));
                      return Array.isArray(users) && users.length > 0 ? users[0]?.avatar_url : null;
                  })
                  : null,
              codebergUsername = normalizedUrl.includes('codeberg.org') ? normalizedUrl.split('/').pop() : null;
        return directAvatar || gitlabAvatarUrl || (codebergUsername ? `https://codeberg.org/${codebergUsername}.png` : null);
    }

    async loadAndDisplayAvatar(avatarWidget, avatarUrl) {
        const cachedPath = this.avatarCache.get(avatarUrl);
        const cachedPixbuf = cachedPath ? this.makeCircularPixbuf(cachedPath, 64) : null;
        return cachedPixbuf
            ? (
                avatarWidget.image.set_from_pixbuf(cachedPixbuf),
                avatarWidget.image.show(),
                avatarWidget.container.show()
            )
            : (async () => {
                const tempPath = `/tmp/avatar_${Date.now()}`;
                await this.execAsync([Commands.CURL, '-s', '-L', '--max-time', '30', '--retry', '2', avatarUrl, '-o', tempPath]);

                const file = Gio.File.new_for_path(tempPath);
                file.query_exists(null) && (() => {
                    const pixbuf = this.makeCircularPixbuf(tempPath, 56);
                    pixbuf && (
                        avatarWidget.image.set_from_pixbuf(pixbuf),
                        avatarWidget.image.show(),
                        avatarWidget.container.show(),
                        this.avatarCache.set(avatarUrl, tempPath)
                    );
                })();
            })();
    }

    makeCircularPixbuf(path, displaySize = 64) {
        let file = path ? Gio.File.new_for_path(path) : null;
        let pix = (file && file.query_exists(null))
            ? GdkPixbuf.Pixbuf.new_from_file_at_scale(path, displaySize, displaySize, true)
            : null;
        if (!pix) return null;

        let surface = new cairo.ImageSurface(cairo.Format.ARGB32, displaySize, displaySize);
        let cr = new cairo.Context(surface);
        let half = displaySize / 2;

        cr.arc(half, half, half, 0, 2 * Math.PI);
        cr.clip();

        Gdk.cairo_set_source_pixbuf(cr, pix, 0, 0);
        cr.paint();

        return Gdk.pixbuf_get_from_surface(surface, 0, 0, displaySize, displaySize) || pix;
    }
}

export function applyThemeContextMenuViewMetadataAvatar(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewMetadataAvatar.prototype);
}
