import LastlayerSupporter from 'gi://LastlayerSupporter?version=1.0';

export const AUTHOR_AVATAR_PROVIDERS = [
    {
        domain: 'github.com',
        pattern: /github\.com\/([^\/]+)/,
        template: (user) => `https://avatars.githubusercontent.com/${user}`
    },
    {
        domain: 'gitlab.com',
        pattern: /gitlab\.com\/([^\/]+)/,
        template: (user) => `https://gitlab.com/uploads/-/system/user/avatar/${user}/avatar.png`
    },
    {
        domain: 'bitbucket.org',
        pattern: /bitbucket\.org\/([^\/]+)/,
        template: (user) => `https://bitbucket.org/account/${user}/avatar/128/`
    }
];
