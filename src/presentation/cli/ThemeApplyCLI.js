export class ThemeApplyCLI {
    constructor(dependencies = {}) {
        this.themeRepository = dependencies.themeRepository;
        this.applyThemeUseCase = dependencies.applyThemeUseCase;
        this.settingsService = dependencies.settingsService;
        this.logger = dependencies.logger;
    }

    async applyTheme(themeName) {
        const {themes, theme} = await this.getThemesAndMatch(themeName);
        return theme
            ? ((await this.applyThemeUseCase.execute(theme.name))?.success || false)
            : (() => {
                const available = themes.map(t => t.name).join(', ');
                return {success: false, error: `Theme "${themeName}" not found. Available themes: ${available}`};
            })();
    }

    async listThemes() {
        const themes = await this.themeRepository.getLocalThemes();
        const currentTheme = this.settingsService.getCurrentTheme() ?? null;

        return {themes, currentTheme};
    }

    async showThemeInfo(themeName) {
        const {theme} = await this.getThemesAndMatch(themeName);
        return theme
            ? {
                title: theme.title || theme.name,
                name: theme.name,
                author: theme.author?.name || null,
                description: theme.description || null,
                path: theme.path || null,
                source: theme.source || null,
                tags: Array.isArray(theme.tags) ? theme.tags : [],
                icon: theme.icon || null
            }
            : null;
    }

    showHelp() {
        return [
            'LastLayer - CLI',
            '===============',
            '',
            'Usage:',
            '  lastlayer                     - Open GUI',
            '  lastlayer <theme_name>        - Apply theme',
            '  lastlayer --list              - List themes',
            '  lastlayer --info <theme_name> - Show theme info',
            '  lastlayer --help              - Show this help',
            '',
            'Examples:',
            '  lastlayer default             - Apply theme "default"',
            '  lastlayer --list              - Show all available themes',
            '  lastlayer --info auspicious   - Show info about "auspicious"',
            ''
        ].join('\n');
    }

    async getThemesAndMatch(themeName) {
        const themes = await this.themeRepository.getLocalThemes();
        const theme = themes.find(t => t.name === themeName);
        return {themes, theme};
    }

    async handle(args) {
        const parsedArgs = Array.isArray(args) ? args : [];
        return parsedArgs.length > 0
            ? await (async () => {

                const firstArg = parsedArgs[0];

                switch (firstArg) {
                    case '--help':
                    case '-h':
                        return {output: this.showHelp() + '\n'};

                    case '--list':
                    case '-l': {
                        const {themes, currentTheme} = await this.listThemes();
                        const lines = ['Available themes:'];
                        for (const theme of themes) {
                            const marker = theme.name === currentTheme ? ' (current)' : '';
                            lines.push(`  - ${theme.title || theme.name}${marker}`);
                        }
                        return {output: lines.join('\n') + '\n'};
                }

                    case '--info':
                    case '-i': {
                        const themeName = parsedArgs[1];
                        const info = themeName ? await this.showThemeInfo(themeName) : null;
                        return !themeName
                            ? {output: 'Error: --info requires a theme name\n'}
                            : (info
                                ? (() => {
                                    const lines = [
                                        `Theme: ${info.title}`,
                                        `Name: ${info.name}`,
                                        `Author: ${info.author || 'Unknown'}`,
                                        `Description: ${info.description || 'No description'}`,
                                        `Path: ${info.path || 'Unknown'}`,
                                        `Source: ${info.source || 'Unknown'}`,
                                        `Tags: ${info.tags.join(', ') || 'None'}`
                                    ];
                                    return {output: lines.join('\n') + '\n'};
                                })()
                                : {output: `Theme "${themeName}" not found\n`});
                    }

                    default: {
                        const success = await this.applyTheme(firstArg);
                        return {output: success ? `Theme \"${firstArg}\" applied successfully\n` : `Failed to apply theme \"${firstArg}\"\n`};
                    }
                }
            })()
            : {output: ''};
    }
}
