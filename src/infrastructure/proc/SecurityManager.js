export const SecurityLevel = {
    STRICT: 'strict',
    NORMAL: 'normal',
    RELAXED: 'relaxed'
};

export const CommandCategories = {
    SYSTEM_BASIC: 'system_basic',
    SYSTEM_ADVANCED: 'system_advanced',
    FILE_OPERATIONS: 'file_operations',
    NETWORK: 'network',
    DEVELOPMENT: 'development',
    MULTIMEDIA: 'multimedia',
    DESKTOP: 'desktop',
    PACKAGE_MANAGEMENT: 'package_management'
};

const COMMANDS_BY_CATEGORY = {
    [CommandCategories.SYSTEM_BASIC]: [
        'echo', 'cat', 'ls', 'pwd', 'which', 'test', 'true', 'false',
        'whoami', 'id', 'uname', 'hostname', 'date', 'bash', 'sh'
    ],
    [CommandCategories.FILE_OPERATIONS]: [
        'cp', 'mv', 'rm', 'mkdir', 'rmdir', 'chmod', 'chown',
        'touch', 'ln', 'find', 'locate', 'du', 'df'
    ],
    [CommandCategories.SYSTEM_ADVANCED]: [
        'ps', 'pgrep', 'pkill', 'kill', 'killall',
        'systemctl', 'journalctl', 'mount', 'umount'
    ],
    [CommandCategories.NETWORK]: [
        'curl', 'wget', 'ping', 'nc', 'netstat', 'ss'
    ],
    [CommandCategories.DEVELOPMENT]: [
        'git', 'make', 'gcc', 'g++', 'python', 'python3',
        'node', 'npm', 'yarn', 'cargo', 'rustc'
    ],
    [CommandCategories.MULTIMEDIA]: [
        'paplay', 'aplay', 'ffplay', 'mplayer', 'vlc',
        'convert', 'imagemagick', 'ffmpeg'
    ],
    [CommandCategories.DESKTOP]: [
        'hyprctl', 'swww', 'notify-send', 'dbus-send',
        'xdg-open', 'zenity', 'kdialog'
    ],
    [CommandCategories.PACKAGE_MANAGEMENT]: [
        'pacman', 'yay', 'apt', 'apt-get', 'dnf', 'zypper',
        'snap', 'flatpak', 'appimage'
    ]
};

const SECURITY_LEVEL_CATEGORIES = {
    [SecurityLevel.STRICT]: [CommandCategories.SYSTEM_BASIC, CommandCategories.DESKTOP],
    [SecurityLevel.NORMAL]: [
        CommandCategories.SYSTEM_BASIC, CommandCategories.FILE_OPERATIONS,
        CommandCategories.MULTIMEDIA, CommandCategories.DESKTOP
    ],
    [SecurityLevel.RELAXED]: [
        CommandCategories.SYSTEM_BASIC, CommandCategories.FILE_OPERATIONS,
        CommandCategories.SYSTEM_ADVANCED, CommandCategories.NETWORK,
        CommandCategories.DEVELOPMENT, CommandCategories.MULTIMEDIA,
        CommandCategories.DESKTOP
    ]
};

const CRITICAL_DANGEROUS_PATTERNS = [
    /rm\s+-rf\s+\/(?!home\/|tmp\/|var\/tmp\/)/,
    /dd\s+if=/, /:\(\)\{.*\|.*\&.*\}.*\;/,
    /sudo\s+(?!-n)/, /su\s+(?!-c)/,
    /chmod\s+777/, /chmod\s+666.*\/etc/,
    /\/etc\/passwd/, /\/etc\/shadow/, /\/etc\/sudoers/, /\/boot\//,
    /mkfs\./, /fdisk/, /parted/, /gparted/,
    /crontab\s+-e/, /systemctl\s+(enable|disable)/,
    /nc\s+.*-l.*-e/, /nmap\s+.*-sS/
];

const LEVEL_DANGEROUS_PATTERNS = {
    [SecurityLevel.STRICT]: [/git\s+clone.*github\.com/, /curl.*\|.*sh/, /wget.*\|.*bash/],
    [SecurityLevel.NORMAL]: [/curl.*\|.*sh/, /wget.*\|.*bash/],
    [SecurityLevel.RELAXED]: []
};

const RELAXED_SUSPICIOUS_PATTERNS = [
    /rm.*-rf.*\$\{/,
    /chmod.*777.*\/etc/,
    /chown.*root.*\/etc/
];

export class SecurityManager {
    constructor(_logger = null) {
        this.currentLevel = SecurityLevel.NORMAL;

        this.commandsByCategory = COMMANDS_BY_CATEGORY;
        this.securityLevelCategories = SECURITY_LEVEL_CATEGORIES;
        this.criticalDangerousPatterns = CRITICAL_DANGEROUS_PATTERNS;
        this.levelDangerousPatterns = LEVEL_DANGEROUS_PATTERNS;

        this.userWhitelist = new Set();
        this.userBlacklist = new Set();
    }

    getCategoriesForLevel(level = this.currentLevel) {
        return this.securityLevelCategories[level] ?? [];
    }

    buildFullCommand(command, args = []) {
        return [command, ...args].join(' ');
    }

    getAllowedCommands() {
        const categories = this.getCategoriesForLevel();
        const commands = new Set(categories.flatMap(cat => this.commandsByCategory[cat]));

        this.userWhitelist.forEach(cmd => commands.add(cmd));
        this.userBlacklist.forEach(cmd => commands.delete(cmd));

        return commands;
    }

    getDangerousPatterns() {
        return [...this.criticalDangerousPatterns, ...(this.levelDangerousPatterns[this.currentLevel] ?? [])];
    }

    checkCommandSafety(command, args = []) {
        const fullCommand = this.buildFullCommand(command, args);
        const dangerousMatch = this.getDangerousPatterns().find(p => p.test(fullCommand));
        const criticalResult = dangerousMatch
            ? {
                safe: false,
                level: 'critical',
                reason: `Command contains a dangerous pattern: ${dangerousMatch.source}`,
                pattern: dangerousMatch.source
            }
            : null;

        const allowedCommands = this.getAllowedCommands();
        const warningResult = allowedCommands.has(command)
            ? null
            : {
                safe: false,
                level: 'warning',
                reason: `Command '${command}' is not allowed for security level '${this.currentLevel}'`,
                suggestion: 'Add the command to the whitelist or change the security level'
            };

        return criticalResult
            ? criticalResult
            : (warningResult
                ? warningResult
                : (this.currentLevel === SecurityLevel.RELAXED
                    ? this.checkRelaxedSafety(fullCommand)
                    : {safe: true, level: this.currentLevel}));
    }

    checkRelaxedSafety(fullCommand) {
        const match = RELAXED_SUSPICIOUS_PATTERNS.find(p => p.test(fullCommand));
        return match
            ? {
                safe: true,
                level: 'warning',
                reason: 'Suspicious command, but allowed in relaxed mode',
                pattern: match.source
            }
            : {safe: true, level: this.currentLevel};
    }

}
