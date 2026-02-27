import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import { TEMPLATE_DIR, applyTemplate, loadTemplate } from './ThemeContextMenuTemplateUtils.js';

const METADATA_3D_TEMPLATE = GLib.build_filenamev([TEMPLATE_DIR, 'theme_context_menu_metadata_3d.html']);

class ThemeContextMenuViewMetadataTemplate {
    getMetadata3DTemplate() {
        this._metadata3dTemplate ||= loadTemplate(METADATA_3D_TEMPLATE);
        return this._metadata3dTemplate;
    }

    renderMetadata3DTemplate(level, labelsJson) {
        const template = this.getMetadata3DTemplate();
        return template
            ? applyTemplate(template, {
            LEVEL: level,
            LABELS: labelsJson
        })
            : '';
    }
}

export function applyThemeContextMenuViewMetadataTemplate(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewMetadataTemplate.prototype);
}
