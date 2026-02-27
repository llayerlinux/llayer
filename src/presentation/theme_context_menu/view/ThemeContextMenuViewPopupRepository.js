import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import { addPointerCursor } from '../../common/ViewUtils.js';

class ThemeContextMenuViewPopupRepository {
    createRepositoryBox() {
        const repoBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 4}),
              avatarWidget = this.createAuthorAvatarWidget(),
              theme = this.menuData.theme,
              authorUrl = this.menuData.author?.url || '',
              localPath = this.getLocalThemePath(theme),
              repoUrl = this.menuData.repository?.url || theme.repoUrl || localPath || '';

        avatarWidget.container.hide();
        authorUrl && this.loadSimpleAvatar(authorUrl, avatarWidget);

        const urlEntry = new Gtk.Entry({text: repoUrl, editable: false, hexpand: true}),
              copyBtn = new Gtk.Button(),
              copyIcon = new Gtk.Image();
        urlEntry.get_style_context().add_class('repo-input');
        copyIcon.set_from_icon_name('edit-copy-symbolic', Gtk.IconSize.BUTTON);
        copyBtn.set_image(copyIcon);
        copyBtn.get_style_context().add_class('copy-button');
        addPointerCursor(copyBtn);
        copyBtn.connect('clicked', () => this.copyToClipboard(repoUrl));

        repoBox.pack_start(avatarWidget.container, false, false, 0);
        repoBox.pack_start(urlEntry, true, true, 0);
        repoBox.pack_start(copyBtn, false, false, 0);
        return repoBox;
    }
}

export function applyThemeContextMenuViewPopupRepository(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewPopupRepository.prototype);
}
