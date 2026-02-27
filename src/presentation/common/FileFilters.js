export const SUPPORTED_ARCHIVE_PATTERNS = ['*.tar.gz', '*.tar.xz', '*.zip'];

export const SUPPORTED_ARCHIVE_EXTENSIONS = ['.tar.gz', '.tgz', '.tar.xz', '.tar', '.zip'];

const SUPPORTED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg'];
export const SUPPORTED_IMAGE_PATTERNS = SUPPORTED_IMAGE_EXTENSIONS
    .flatMap((ext) => [`*.${ext}`, `*.${ext.toUpperCase()}`]);

export const SUPPORTED_PREVIEW_SIZES = [
    [512, 512],
    [1024, 1024]
];
