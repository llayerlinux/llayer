const BASE_SCSS_FILES = ['theme_selector.scss', 'theme_selector_local.scss', 'converter.scss'];

const THEME_SCSS_BY_NAME = {
    LastLayer2: 'lastlayer2_theme.scss',
    LastLayer3: 'lastlayer3_theme.scss',
    LastLayer: 'custom_theme.scss'
};

export const CSS_FILES = ['theme_selector.css', 'converter.css'];

export function getScssFilesForTheme(activeTheme) {
    const themedFile = THEME_SCSS_BY_NAME[activeTheme] || null;
    return themedFile ? [...BASE_SCSS_FILES, themedFile] : [...BASE_SCSS_FILES];
}
