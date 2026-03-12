#!/usr/bin/env -S gjs -m
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import System from 'system';
import GdkPixbuf from 'gi://GdkPixbuf';

import { SettingsManager } from '../settings/SettingsManager.js';
import { SettingsService } from '../settings/SettingsService.js';
import { AIProviderService } from './AIProviderService.js';
import { AIDecisionService } from './AIDecisionService.js';
import { tryOrDefault, tryOrNull, tryOrNullAsync, tryRun } from '../utils/ErrorUtils.js';

const parsePayload = () => {
    if (!ARGV || ARGV.length === 0) return null;
    if (ARGV.length >= 2)
        return { themePath: ARGV[0], themeName: ARGV[1], providerId: ARGV[2] || null };
    return tryOrDefault('AutoTagGenerationWorker.parsePayload', () => JSON.parse(ARGV[0]), null);
};

const ensureCommandQueueDir = (dirPath) => {
    tryRun('AutoTagGenerationWorker.ensureCommandQueueDir', () => {
        GLib.mkdir_with_parents(dirPath, parseInt('0755', 8));
    });
};

const enqueueCommand = (command) => {
    if (!command) return false;
    const queueDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'lastlayer_popup_commands']);
    ensureCommandQueueDir(queueDir);
    const id = typeof GLib.uuid_string_random === 'function'
        ? GLib.uuid_string_random()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const filename = `${Date.now()}-${id}.cmd`;
    const filePath = GLib.build_filenamev([queueDir, filename]);
    return tryRun('AutoTagGenerationWorker.enqueueCommand', () => GLib.file_set_contents(filePath, command));
};

const hasAnyTagsInMetadata = (metadata) => {
    const rawTags = metadata?.originalTheme?.tags ?? metadata?.tags ?? metadata?.topics ?? null;
    if (!Array.isArray(rawTags)) return false;
    return rawTags.some((t) => typeof t === 'string' && t.trim().length > 0);
};

const canonicalizeRepoUrl = (value) => {
    if (!value || typeof value !== 'string') return '';
    return value
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/+$/, '');
};

const isRumdaRepo = (metadata) => {
    const repoUrl = metadata?.originalTheme?.repoUrl || metadata?.repoUrl || '';
    return canonicalizeRepoUrl(repoUrl) === 'github.com/nytril-ark/rumda';
};

const isPlaceholderTags = (metadata) => {
    if (metadata?.unifier?.autoTags?.placeholder === true) return true;
    const rawTags = metadata?.originalTheme?.tags ?? metadata?.tags ?? null;
    if (!Array.isArray(rawTags)) return false;
    const normalized = rawTags.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean);
    if (normalized.length !== 3) return false;
    const joined = normalized.join(',');
    return joined === 'reading,book,paper' && isRumdaRepo(metadata);
};

const pickImagePath = (themePath) => {
    const candidates = [
        `${themePath}/preview.png`,
        `${themePath}/preview.jpg`,
        `${themePath}/preview.jpeg`,
        `${themePath}/wallpaper.png`,
        `${themePath}/wallpaper.jpg`,
        `${themePath}/wallpaper.jpeg`,
    ];
    for (const p of candidates) {
        if (GLib.file_test(p, GLib.FileTest.EXISTS)) return p;
    }
    return null;
};

const canonicalizeTag = (value) => {
    const raw = (typeof value === 'string' ? value : String(value || '')).trim().toLowerCase();
    if (!raw) return null;
    const cleaned = raw
        .replace(/^[-•*#\s]+/, '')
        .replace(/["'`]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '')
        .replace(/-+/g, '-')
        .replace(/_+/g, '_')
        .replace(/^-+|-+$/g, '');
    return cleaned || null;
};

const parseTagsFromResponse = (text) => {
    const raw = (text || '').trim();
    if (!raw) return [];

    const parsedTags = tryOrDefault('AutoTagGenerationWorker.parseTagsFromResponse', () => {
        const start = raw.indexOf('[');
        const end = raw.lastIndexOf(']');
        if (!(start >= 0 && end > start))
            return null;
        const parsed = JSON.parse(raw.slice(start, end + 1));
        if (!Array.isArray(parsed))
            return null;
        return [...new Set(parsed.map(canonicalizeTag).filter(Boolean))];
    }, null);
    if (parsedTags)
        return parsedTags;

    const parts = raw
        .replace(/^tags?:/i, '')
        .split(/[\n,;|]+/g)
        .map((p) => canonicalizeTag(p))
        .filter(Boolean);
    return [...new Set(parts)];
};

const buildPrompt = () => {
    return `You are a vision model. You will be given an image of a desktop theme wallpaper/preview.
Return ONLY a JSON array of exactly 3 short tags describing the aesthetic/style, in lowercase.
Rules:
- JSON only (no markdown, no extra text)
- Exactly 3 items
- Each tag is 1-2 words max, use hyphens instead of spaces
Example: ["minimal","nord","purple"]`;
};

const main = async () => {
    const payload = parsePayload();
    const themePath = payload?.themePath;
    const themeName = payload?.themeName || null;
    const providerId = payload?.providerId || null;

    if (!themePath) {
        printerr('[AutoTagWorker] Missing themePath');
        System.exit(1);
    }

    const settingsManager = new SettingsManager({ eventBus: null });
    settingsManager.load();
    const enabled = settingsManager.get?.('autoGenerateTagsOnImport') === true;
    if (!enabled) {
        System.exit(0);
    }

    const metadataPath = `${themePath}/lastlayer-metadata.json`;
    if (!GLib.file_test(metadataPath, GLib.FileTest.EXISTS)) {
        System.exit(0);
    }

    const metadata = tryOrDefault('AutoTagGenerationWorker.main.readMetadata', () => {
        const [ok, content] = GLib.file_get_contents(metadataPath);
        if (!ok || !content)
            return null;
        return JSON.parse(new TextDecoder('utf-8').decode(content));
    }, null);
    if (!metadata)
        System.exit(0);

    if (hasAnyTagsInMetadata(metadata) && !isPlaceholderTags(metadata))
        System.exit(0);

    const imagePath = pickImagePath(themePath);
    if (!imagePath) {
        System.exit(0);
    }

    const settingsService = new SettingsService({ settingsManager });
    const aiProviderService = new AIProviderService(settingsService, null);
    const effectiveProviderId = providerId || settingsManager.get?.('autoGenerateTagsProviderId') || null;

    const hasUsableProvider = effectiveProviderId
        ? Boolean(aiProviderService.getProvider?.(effectiveProviderId))
        : aiProviderService.hasActiveProvider?.();
    if (!hasUsableProvider)
        System.exit(0);

    const pixbuf = tryOrNull('AutoTagGenerationWorker.main.loadPixbuf', () => GdkPixbuf.Pixbuf.new_from_file(imagePath));
    if (!pixbuf)
        System.exit(0);

    const decision = new AIDecisionService(aiProviderService, null);
    const imageData = decision.pixbufToOptimizedImage?.(pixbuf)
        || decision._pixbufToOptimizedImage?.(pixbuf)
        || null;
    if (!imageData?.base64) {
        System.exit(0);
    }

    const prompt = buildPrompt();
    const response = aiProviderService.sendRequest(prompt, {
        providerId: effectiveProviderId || undefined,
        imageData,
        maxTokens: 128
    });

    if (!response?.success) {
        System.exit(0);
    }

    const tags = parseTagsFromResponse(response.content || '').slice(0, 3);
    if (tags.length !== 3) {
        System.exit(0);
    }

    if (metadata.originalTheme && typeof metadata.originalTheme === 'object') {
        metadata.originalTheme.tags = tags;
    } else {
        metadata.tags = tags;
    }

    const now = new Date().toISOString();
    metadata.unifier = {
        ...(metadata.unifier || {}),
        autoTags: {
            generatedAt: now,
            providerId: effectiveProviderId || aiProviderService.getActiveProviderId?.() || null,
            image: GLib.path_get_basename(imagePath),
            placeholder: false
        }
    };

    const wroteMetadata = tryRun(
        'AutoTagGenerationWorker.main.writeMetadata',
        () => GLib.file_set_contents(metadataPath, JSON.stringify(metadata, null, 2))
    );
    wroteMetadata && themeName && enqueueCommand(`theme_updated:${themeName}`);
};

const runMain = async () => {
    const completed = await tryOrNullAsync('AutoTagGenerationWorker.main', async () => {
        await main();
        return true;
    });
    if (completed === null) {
        printerr('[AutoTagWorker] Error');
        System.exit(1);
    }
};

runMain();
