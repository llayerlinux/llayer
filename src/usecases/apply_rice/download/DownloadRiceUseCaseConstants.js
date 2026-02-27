export const TIMEOUTS = {
    TOTAL_DOWNLOAD: 600000,
    INITIAL_POLL: 100,
    PROGRESS_POLL: 200,
    POST_PROCESS_DELAY: 10,
    EVENT_BUS_DELAY: 300,
    AUTO_APPLY_DELAY: 450,
    CMD_DEFAULT: 30000,
    CMD_EXTRACT: 60000,
    CMD_SIMPLE: 15000,
    CURL_HEAD: 8,
    WGET_DOWNLOAD: 300,
    CURL_DOWNLOAD: 300,
    CURL_PREVIEW: 30
};

export const SIZES = {
    BYTES_PER_MB: 1048576,
    MIN_VALID_ARCHIVE: 1048576
};

const ARCHIVE_EXTENSIONS = ['.tar.xz', '.tar.gz', '.zip'];
export const ARCHIVE_EXTENSIONS_SORTED = [...ARCHIVE_EXTENSIONS].sort((a, b) => b.length - a.length);
export const DEFAULT_ARCHIVE_EXTENSION = '.tar.gz';
export const ARCHIVE_EXT_REGEX = /(\.tar\.xz|\.tar\.gz|\.zip)$/;
export const EXTRACT_DIR_SUFFIX = '_tmp';
export const PREVIEW_CURL_ARGS = ['-fSL', '--max-time', String(TIMEOUTS.CURL_PREVIEW), '--retry', '2'];
