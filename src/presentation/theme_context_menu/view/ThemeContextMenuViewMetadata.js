import { applyThemeContextMenuViewMetadataAuthor } from './ThemeContextMenuViewMetadataAuthor.js';
import { applyThemeContextMenuViewMetadataRiceDepth } from './ThemeContextMenuViewMetadataRiceDepth.js';
import { applyThemeContextMenuViewMetadataAvatar } from './ThemeContextMenuViewMetadataAvatar.js';
import { applyThemeContextMenuViewMetadataReddit } from './ThemeContextMenuViewMetadataReddit.js';
import { applyThemeContextMenuViewMetadataSections } from './ThemeContextMenuViewMetadataSections.js';
import { applyThemeContextMenuViewMetadataTemplate } from './ThemeContextMenuViewMetadataTemplate.js';

export function applyThemeContextMenuViewMetadata(prototype) {
    [
        applyThemeContextMenuViewMetadataTemplate,
        applyThemeContextMenuViewMetadataReddit,
        applyThemeContextMenuViewMetadataAvatar,
        applyThemeContextMenuViewMetadataSections,
        applyThemeContextMenuViewMetadataRiceDepth,
        applyThemeContextMenuViewMetadataAuthor
    ].forEach((applyMixin) => applyMixin(prototype));
}
