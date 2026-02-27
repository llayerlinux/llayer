export const DEFAULT_DANGEROUS_PATTERNS = [
    'rm\\s+-rf\\s+/(?!tmp/|home/|var/tmp/)',
    'dd\\s+if=.*of=/dev',
    'mkfs\\.',
    'fdisk.*/dev',
    'format.*/dev',
    '>\\s*/dev/sd[a-z]',
    'chmod\\s+777\\s+/etc',
    'chmod\\s+777\\s+/usr',
    'chmod\\s+777\\s+/bin'
];

export const DEFAULT_SECURITY_EXCEPTIONS = [
    '/tmp/',
    'tmp/',
    'cache/',
    '.cache/',
    '/.cache/',
    '$HOME/.cache/',
    '$HOME/lastlayer/',
    'themes/',
    'lastlayer/themes/',
    'theme-downloads/',
    'cache/theme-downloads',
    '.cache/theme-downloads',
    '/.cache/theme-downloads',
    'download_progress_',
    'rm -f /tmp/',
    'rm -rf /tmp/',
    'bash -c rm -f /tmp/',
    'bash -c rm -rf /tmp/',
    'rm -f /home/',
    'rm -rf /home/',
    'bash -c rm -f "$HOME/.cache/',
    'bash -c rm -rf "$HOME/.cache/',
    '"Zenities Test Theme"',
    '_tmp',
    'theme-downloads"/*'
];

