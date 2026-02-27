import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Soup from 'gi://Soup?version=2.4';
import { REDDIT_USER_AGENT } from './ThemeContextMenuConstants.js';
import { tryOrNull } from '../../../infrastructure/utils/ErrorUtils.js';

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
        session.queue_message(message, (_sess, msg) => {
            let ok = msg && msg.status_code >= 200 && msg.status_code < 300;
            let bodyData = ok && msg.response_body?.data;
            let jsonText = bodyData && this.decodeBody(bodyData);
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
