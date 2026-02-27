import GLib from 'gi://GLib';
import {COMMAND_BIN, DEFAULT_HYPRLAND_PLUGINS_REPO, REPO_URL_NEEDLES} from './TweaksPluginsConstants.js';

export const TweaksPluginsHyprpm = {
    buildHyprpmPluginsList(output, success = true) {
        const noPlugins = !success || !output || output.trim() === '' ||
            output.includes('No plugins installed') || output.includes('no plugins');
        return noPlugins
            ? [this.corePlugin()]
            : this.parseHyprpmListLines(output.split('\n'), this.getStoredRepositories());
    },

    async getHyprpmPluginsListAsync() {
        return this.checkHyprpmInstallation()
            ? this.buildHyprpmPluginsList(await this.execAsync([COMMAND_BIN.HYPRPM, 'list']))
            : [this.corePlugin()];
    },

    getHyprpmPluginsList() {
        if (!this.checkHyprpmInstallation()) {
            return [this.corePlugin()];
        }
        const [success, output] = this.execSync([COMMAND_BIN.HYPRPM, 'list']);
        return this.buildHyprpmPluginsList(output, success);
    },

    parseEnabledPlugins(output) {
        const enabledPlugins = [];
        for (const line of String(output || '').split('\n')) {
            if (!line.includes('Plugin ')) continue;
            const match = line.match(/Plugin\s+(.+?)\s+by/);
            match && enabledPlugins.push(match[1].trim());
        }

        return enabledPlugins;
    },

    extractRepositoryInfo(url) {
        const [, info] = Object.entries({
            'github.com': {name: 'GitHub', pattern: /github\.com\/([^\/]+)/, urlBase: 'https://github.com'},
            'gitlab.com': {name: 'GitLab', pattern: /gitlab\.com\/([^\/]+)/, urlBase: 'https://gitlab.com'}
        }).find(([domain]) => url.includes(domain)) || [];

        const match = info && url.match(info.pattern), author = match?.[1] || this.translate('UNKNOWN');
        return {author, authorUrl: match ? `${info.urlBase}/${author}` : '', platform: info?.name || 'unknown'};
    },

    checkHyprpmInstallation() {
        const [success] = this.execSync([COMMAND_BIN.HYPRPM, '--version']);
        return success;
    },

    getStoredRepositories() {
        return this.storedRepositories ?? [];
    },

    corePlugin() {
        return {
            name: 'llayer-core',
            author: 'llayerlinux',
            authorUrl: 'https://github.com/llayerlinux',
            repositoryUrl: 'https://github.com/llayerlinux/llayer',
            enabled: true,
            description: this.translate('PLUGINS_CORE_DESCRIPTION'),
            isCore: true,
            path: ''
        };
    },

    getRepository(repoIdentifier, repoList) {
        const repoId = String(repoIdentifier);
        if (repoId === 'hyprland-plugins') return {...DEFAULT_HYPRLAND_PLUGINS_REPO};
        if (REPO_URL_NEEDLES.some((needle) => repoId.includes(needle)))
            return repoList.find((repo) => repo.url === repoId) || this.extractRepositoryInfo(repoId);

        return repoList.find((repo) =>
            (repo.url.match(/\/([^\/]+?)(?:\.git)?$/)?.[1] || '').toLowerCase() === repoId.toLowerCase())
            || ((gitConfigPath) => ((repoUrl) => repoUrl
                ? {...this.extractRepositoryInfo(repoUrl), url: repoUrl}
                : {url: `https://github.com/${repoId}`, author: repoId, authorUrl: `https://github.com/${repoId}`, platform: 'GitHub'})(
                ((r) => (r[0] && r[1] ? new TextDecoder('utf-8').decode(r[1]) : '')
                    .match(/url\s*=\s*(.+)/)?.[1]?.trim())(
                    GLib.file_test(gitConfigPath, GLib.FileTest.EXISTS) ? GLib.file_get_contents(gitConfigPath) : [false, null])))(
                GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'hyprpm', repoId, '.git', 'config']));
    },

    parseHyprpmListLines(lines, repoList) {
        const plugins = [];
        let currentPlugin = null;
        let currentRepository = null;

        for (const rawLine of lines) {
            const cleanLine = rawLine.replace(/\x1b\[[0-9;]*m/g, '').trim();
            const isRepositoryLine = cleanLine.includes('Repository') && cleanLine.includes(':');
            if (!cleanLine) {
                continue;
            } else if (isRepositoryLine) {
                const repoIdentifier = cleanLine.match(/Repository\s+([^:]+):/)?.[1]?.trim() || null;
                currentRepository = repoIdentifier ? this.getRepository(repoIdentifier, repoList) : null;
            } else if (cleanLine.match(/Plugin\s+([^\s]+)/)) {
                const pluginMatch = cleanLine.match(/Plugin\s+([^\s]+)/);
                currentPlugin = {
                    name: pluginMatch[1].trim(),
                    enabled: false,
                    author: currentRepository ? currentRepository.author : this.translate('UNKNOWN'),
                    authorUrl: currentRepository ? currentRepository.authorUrl : '',
                    repositoryUrl: currentRepository ? currentRepository.url : '',
                    description: '',
                    isCore: false,
                    path: ''
                };
                plugins.push(currentPlugin);
            } else if (currentPlugin && cleanLine.includes('enabled:')) {
                const enabledMatch = cleanLine.match(/enabled:\s*(true|false)/);
                enabledMatch && (currentPlugin.enabled = enabledMatch[1] === 'true');
            }
        }

        plugins.unshift(this.corePlugin());
        return plugins;
    }
};
