import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=2.4';
import { decodeBytes } from '../utils/Utils.js';
import { tryOrNull } from '../utils/ErrorUtils.js';

const UTF8_ENCODER = new TextEncoder();
const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;

function setRequestBody(message, contentType, body) {
    return message.set_request_body_from_bytes
        ? message.set_request_body_from_bytes(
            contentType,
            GLib.Bytes.new(body instanceof Uint8Array ? body : UTF8_ENCODER.encode(body))
        )
        : message.set_request(contentType, Soup.MemoryUse.COPY, body);
}

function setAuthHeader(message, authorizationHeader) {
    authorizationHeader && message.request_headers.append('Authorization', authorizationHeader);
}

function createJsonMessage(method, url, payload, authorizationHeader) {
    const message = Soup.Message.new(method, url);
    message.request_headers.append('Accept', 'application/json');
    message.request_headers.append('Content-Type', 'application/json');
    setAuthHeader(message, authorizationHeader);
    setRequestBody(message, 'application/json', JSON.stringify(payload ?? {}));
    return message;
}

function decodeContentBytes(bytes) {
    return bytes ? decodeBytes(bytes) : '';
}

function readFileBytes(path) {
    const filePath = typeof path === 'string' ? path.trim() : '';
    if (!filePath || !Gio.File.new_for_path(filePath).query_exists(null)) return null;
    const file = Gio.File.new_for_path(filePath);
    const [ok, contents] = file.load_contents(null);
    return ok ? contents : null;
}

function buildMultipartBody(payload = {}, boundary) {
    const parts = [];
    const jsonPayload = {...payload};
    delete jsonPayload.archivePath;
    delete jsonPayload.previewPath;

    parts.push(
        `--${boundary}\r\n`,
        'Content-Disposition: form-data; name="json"\r\n',
        'Content-Type: application/json\r\n\r\n',
        JSON.stringify(jsonPayload),
        '\r\n'
    );

    const appendFilePart = (field, filePath, contentType) => {
        let data = readFileBytes(filePath);
        if (!data) return;
        let fileName = GLib.path_get_basename(filePath);
        parts.push(
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="${field}"; filename="${fileName}"\r\n`,
            `Content-Type: ${contentType}\r\n\r\n`,
            data,
            '\r\n'
        );
    };

    payload.archivePath && appendFilePart('file', payload.archivePath, 'application/gzip');

    if (payload.previewPath) {
        const fileName = GLib.path_get_basename(payload.previewPath).toLowerCase();
        const mimeType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';
        appendFilePart('preview', payload.previewPath, mimeType);
    }

    parts.push(`--${boundary}--\r\n`);

    let totalLength = 0;
    const byteArrays = parts.map((part) => {
        const bytes = part instanceof Uint8Array ? part : UTF8_ENCODER.encode(part);
        totalLength += bytes.length;
        return bytes;
    });

    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const bytes of byteArrays) {
        body.set(bytes, offset);
        offset += bytes.length;
    }
    return body;
}

function standardizeResponse(service, url, message) {
    const statusCode = Number(message.status_code) || 0,
        responseText = decodeContentBytes(message.response_body?.data),
        parsed = service.parseJsonOrNull(responseText),
        body = parsed ?? responseText;
    if (statusCode >= HTTP_OK_MIN && statusCode <= HTTP_OK_MAX) {
        return {
            error: null,
            response: {statusCode, body, endpoint: url},
            responseText
        };
    }
    return {
        error: new Error(parsed?.message || responseText || `HTTP ${statusCode}`),
        response: null,
        responseText
    };
}

export class ServerEditHttpService {
    createSession({timeout = 30, allowInsecure = false, userAgent = 'LastLayer/ServerEdit/2.0'} = {}) {
        const session = new Soup.Session();
        session.user_agent = userAgent;
        session.timeout = timeout;
        session.ssl_strict = !allowInsecure;
        return session;
    }

    parseJsonOrNull(text) {
        return text ? tryOrNull('ServerEditHttpService.parseJsonOrNull', () => JSON.parse(text)) : null;
    }

    sendJson({method, url, payload, timeout = 30, allowInsecure = false, authorizationHeader = null, userAgent}, callback) {
        const session = this.createSession({timeout, allowInsecure, userAgent});
        const message = createJsonMessage(method, url, payload, authorizationHeader);
        session.queue_message(message, (_session, msg) => {
            const {error, response} = standardizeResponse(this, url, msg);
            callback(error, response);
        });
    }

    sendJsonSync({method, url, payload, timeout = 30, allowInsecure = false, authorizationHeader = null, userAgent}) {
        const session = this.createSession({timeout, allowInsecure, userAgent});
        const message = createJsonMessage(method, url, payload, authorizationHeader);
        const status = session.send_message(message);
        const {responseText} = standardizeResponse(this, url, message);
        return {status, responseText};
    }

    sendMultipart({method, url, payload, timeout = 120, allowInsecure = false, authorizationHeader = null, userAgent}, callback) {
        const boundary = `----LastLayerBoundary${Math.random().toString(36).slice(2)}`;
        const bodyBytes = buildMultipartBody(payload, boundary);

        const session = this.createSession({timeout, allowInsecure, userAgent});
        const message = Soup.Message.new(method, url);
        message.request_headers.append('Accept', 'application/json');
        setAuthHeader(message, authorizationHeader);
        setRequestBody(message, `multipart/form-data; boundary=${boundary}`, bodyBytes);

        session.queue_message(message, (_session, msg) => {
            const {error, response} = standardizeResponse(this, url, msg);
            callback(error, response);
        });
    }
}
