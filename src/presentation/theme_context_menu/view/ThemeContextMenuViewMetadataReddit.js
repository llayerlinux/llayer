import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import { REDDIT_USER_AGENT } from './ThemeContextMenuConstants.js';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';

function getSoupStatus(message) {
    return Number(message?.status_code ?? message?.get_status?.() ?? 0) || 0;
}

function decodeSoupBody(bodyData) {
    if (!bodyData) {
        return null;
    }

    const bytes = bodyData instanceof GLib.Bytes
        ? (bodyData.get_data?.() || bodyData.toArray?.() || null)
        : bodyData;
    return typeof bytes === 'string'
        ? bytes
        : ((bytes instanceof Uint8Array || (bytes && typeof bytes === 'object'))
            ? new TextDecoder('utf-8').decode(bytes)
            : null);
}

function sendSoupMessage(session, message, callback) {
    if (typeof session?.queue_message === 'function') {
        session.queue_message(message, (_session, response) => {
            callback({
                message: response,
                body: response?.response_body?.data ?? null,
                error: null
            });
        });
        return;
    }

    if (typeof session?.send_and_read_async === 'function' && typeof session?.send_and_read_finish === 'function') {
        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (currentSession, result) => {
            try {
                callback({
                    message,
                    body: currentSession.send_and_read_finish(result),
                    error: null
                });
            } catch (error) {
                callback({
                    message,
                    body: null,
                    error
                });
            }
        });
        return;
    }

    callback({
        message,
        body: null,
        error: new Error('Unsupported Soup session API')
    });
}

class ThemeContextMenuViewMetadataReddit {
    isRedditUrl(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        const normalized = url.toLowerCase();
        return normalized.includes('reddit.com');
    }

    fetchRedditStats(url, callback) {
        let apiUrl = this.buildRedditInfoUrl(url);
        if (!apiUrl) return callback(null);

        let session = new Soup.Session();
        session.user_agent = REDDIT_USER_AGENT;
        let message = Soup.Message.new('GET', apiUrl);
        message.request_headers.append('Accept', 'application/json');
        message.request_headers.append('User-Agent', REDDIT_USER_AGENT);
        sendSoupMessage(session, message, ({message: response, body, error}) => {
            let ok = !error && response && getSoupStatus(response) >= 200 && getSoupStatus(response) < 300;
            let jsonText = ok ? decodeSoupBody(body) : null;
            let child = jsonText
                ? tryOrNull('ThemeContextMenuViewMetadataReddit.fetchRedditStats.parse', () => JSON.parse(jsonText))?.data?.children?.[0]?.data
                : null;
            let ups = child && (typeof child.ups === 'number'
                ? child.ups
                : (typeof child.score === 'number' ? child.score : null));
            callback(child ? {ups, comments: typeof child.num_comments === 'number' ? child.num_comments : null, title: child?.title || null} : null);
        });
    }

    buildRedditInfoUrl(url) {
        const normalized = this.parseRedditUrl(url);
        if (!normalized) {
            return null;
        }
        const postId = this.extractRedditPostId(normalized);
        return postId ? `https://www.reddit.com/api/info.json?id=t3_${postId}` : null;
    }

    extractRedditPostId(url) {
        const match = url.match(/reddit\.com\/r\/[^/]+\/comments\/([a-z0-9]+)/i);
        return match && match[1] ? match[1] : null;
    }

    parseRedditUrl(url) {
        const value = typeof url === 'string' ? url.trim() : '';
        return value ? (/^https?:\/\//.test(value) ? value : `https://${value}`) : null;
    }

    decodeBody(bodyData) {
        return typeof bodyData === 'string'
            ? bodyData
            : ((bodyData instanceof Uint8Array || (bodyData && typeof bodyData === 'object'))
                ? new TextDecoder('utf-8').decode(bodyData)
                : null);
    }
}

export function applyThemeContextMenuViewMetadataReddit(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewMetadataReddit.prototype);
}
