import {copyPrototypeDescriptors} from '../../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { DEFAULT_SERVER_ADDRESS } from '../../../../infrastructure/constants/AppUrls.js';
import {applyParams} from '../../../../infrastructure/utils/Utils.js';
import { tryOrNull } from '../../../../infrastructure/utils/ErrorUtils.js';

class ThemeSelectorControllerOpsI18n {
    standardizeTranslationKey(key) {
        return typeof key === 'string' ? key : String(key ?? '');
    }

    getTranslator(container = null) {
        const sourceContainer = container ?? this.container,
            hasContainer = sourceContainer
                && typeof sourceContainer.has === 'function'
                && typeof sourceContainer.get === 'function';
        return (hasContainer && sourceContainer.has('translator')
            ? sourceContainer.get('translator')
            : null) ?? this.getGlobalTranslator();
    }

    getGlobalTranslator() {
        return (key, params = null) => {
            const base = this.standardizeTranslationKey(key);
            return applyParams(base, params ?? {});
        };
    }

    translate(key, params = null) {
        const raw = this.translator ? this.translator(key, params ?? undefined) : null;
        const base = this.standardizeTranslationKey(key);
        return typeof raw === 'string' ? raw : applyParams(base, params ?? {});
    }

    formatAuthorSuffix(theme) {
        return theme?.author?.name ? this.translate('THEME_BY_AUTHOR_SUFFIX', {author: theme.author.name}) : '';
    }

    async listDirectory(path) {
        const dir = Gio.File.new_for_path(path),
            enumerator = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null),
            files = [];

        let info;
        while ((info = enumerator.next_file(null))) {
            files.push(info.get_name());
        }
        enumerator.close(null);

        return files;
    }

    updateLocalMetadataFromServer(themeName, serverThemeData) {
        const themePath = `${GLib.get_home_dir()}/.config/themes/${themeName}`,
            metadataPath = `${themePath}/lastlayer-metadata.json`;

        Gio.File.new_for_path(themePath).query_exists(null) && (() => {
            const [ok, fileContent] = GLib.file_get_contents(metadataPath),
                existingMetadata = ok
                    ? (tryOrNull('ThemeSelectorControllerOpsI18n.updateLocalMetadataFromServer.parse', () =>
                        JSON.parse(new TextDecoder('utf-8').decode(fileContent instanceof Uint8Array ? fileContent : Uint8Array.from(fileContent))))
                        || {})
                    : {};

            GLib.file_set_contents(metadataPath, JSON.stringify({
                ...existingMetadata,
                originalTheme: serverThemeData,
                storedAt: new Date().toISOString(),
                storedFrom: this.settingsService?.getNetworkThemeSettings?.()?.serverAddress || DEFAULT_SERVER_ADDRESS,
                version: '1.0'
            }, null, 2));

            this.logger?.info?.('Updated local metadata from server', {themeName, themeId: serverThemeData?.id});
        })();
    }
}

export function applyThemeSelectorControllerOpsI18n(prototype) {
    copyPrototypeDescriptors(prototype, ThemeSelectorControllerOpsI18n.prototype);
}
