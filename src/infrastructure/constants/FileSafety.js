import GLib from 'gi://GLib';
import { Commands } from './Commands.js';

const HOME_DIR = GLib.get_home_dir();
const TMP_DIR = GLib.get_tmp_dir();

const CRITICAL_PATHS = [
    '/',
    '/home',
    '/etc',
    '/usr',
    '/bin',
    '/boot',
    '/dev',
    '/lib',
    '/proc',
    '/sys',
    '/var'
];

export const CRITICAL_PATH_SET = new Set(CRITICAL_PATHS);

export const ALLOWED_DELETION_PREFIXES = [
    '/tmp/',
    '/var/tmp/',
    `${TMP_DIR}/`,
    `${HOME_DIR}/.cache/`,
    `${HOME_DIR}/.config/themes/`,
    `${HOME_DIR}/.local/share/themes/`
];

export const ALLOWED_TARGET_PREFIXES = [
    `${HOME_DIR}/.config/themes/`,
    `${HOME_DIR}/.local/share/themes/`,
    `${TMP_DIR}/`,
    '/tmp/',
    '/var/tmp/'
];

export const ARCHIVE_EXTRACTION_COMMANDS = [
    ['gzip', (archivePath, extractDir) => `${Commands.TAR} -xzf "${archivePath}" -C "${extractDir}"`],
    ['xz', (archivePath, extractDir) => `${Commands.TAR} -xJf "${archivePath}" -C "${extractDir}"`],
    ['bzip2', (archivePath, extractDir) => `${Commands.TAR} -xjf "${archivePath}" -C "${extractDir}"`],
    ['posix tar', (archivePath, extractDir) => `${Commands.TAR} -xf "${archivePath}" -C "${extractDir}"`],
    ['tar archive', (archivePath, extractDir) => `${Commands.TAR} -xf "${archivePath}" -C "${extractDir}"`],
    ['zip', (archivePath, extractDir) => `${Commands.UNZIP} -q -o "${archivePath}" -d "${extractDir}"`]
];

export const DEFAULT_EXTRACTION_COMMANDS_BY_EXTENSION = {
    '.zip': (archivePath, extractDir) => `${Commands.UNZIP} -q -o "${archivePath}" -d "${extractDir}"`,
    '.tar.xz': (archivePath, extractDir) => `${Commands.TAR} -xJf "${archivePath}" -C "${extractDir}"`,
    default: (archivePath, extractDir) => `${Commands.TAR} -xf "${archivePath}" -C "${extractDir}"`
};

export const MAX_ARCHIVE_SIZE = 250 * 1024 * 1024;
export const MAX_PREVIEW_SIZE = 10 * 1024 * 1024;
