#!/usr/bin/env gjs -m

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import System from 'system';

import { HyprlandConfigGenerator } from '../HyprlandConfigGenerator.js';

function parseArgs(argv) {
    const args = {
        themeDir: null,
        targetVersion: null,
        noMetadata: false
    };

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        switch (token) {
            case '--theme-dir':
                args.themeDir = argv[i + 1] || null;
                i++;
                break;
            case '--target-version':
                args.targetVersion = argv[i + 1] || null;
                i++;
                break;
            case '--no-metadata':
                args.noMetadata = true;
                break;
        }
    }

    return args;
}

function main(argv) {
    const args = parseArgs(argv);
    if (!args.themeDir) {
        printerr('Usage: gjs -m GenerateHyprlandConfig.js --theme-dir <path> [--target-version <version>] [--no-metadata]');
        return 2;
    }

    const themePath = args.themeDir.replace(/^~(?=\/|$)/, GLib.get_home_dir());
    if (!Gio.File.new_for_path(themePath).query_exists(null)) {
        printerr(`Theme path not found: ${themePath}`);
        return 3;
    }

    const generator = new HyprlandConfigGenerator();
    const result = generator.generateThemeForCurrentVersion(themePath, {
        targetVersion: args.targetVersion,
        writeMetadata: !args.noMetadata
    });

    print(JSON.stringify(result, null, 2));
    return result.success ? 0 : 1;
}

System.exit(main(ARGV));
