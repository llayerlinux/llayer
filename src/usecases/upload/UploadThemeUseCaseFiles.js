import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

export function applyUploadThemeUseCaseFiles(targetPrototype) {
    targetPrototype.readFilePayload = function(path, maxSize) {
        const file = Gio.File.new_for_path(path);
        if (!file.query_exists(null)) return null;

        const info = file.query_info('standard::size,standard::content-type', Gio.FileQueryInfoFlags.NONE, null);
        if (maxSize && info.get_size() > maxSize) return null;

        const [ok, content] = GLib.file_get_contents(path);
        if (!ok) return null;

        return {
            filename: file.get_basename(), contentType: info.get_content_type(),
            bytes: GLib.Bytes.new(content),
            buffer: (this.getSoupMajorVersion() < 3 && Soup.Buffer?.new && Soup.MemoryUse)
                ? Soup.Buffer.new(Soup.MemoryUse.COPY, new Uint8Array(content), content.length) : null,
            path
        };
    };

    targetPrototype.computeSha256 = function(bytes) {
        return GLib.compute_checksum_for_bytes(GLib.ChecksumType.SHA256, bytes);
    };

    targetPrototype.getSoupMajorVersion = function() {
        return this.soupVersion !== undefined
            ? this.soupVersion
            : (() => {
                const isSoup3 = typeof Soup.Session.prototype.send_async === 'function'
                    || Soup.FORM_MIME_TYPE_MULTIPART !== undefined
                    || (GLib.Uri && typeof GLib.Uri.parse === 'function');
                this.soupVersion = isSoup3 ? 3 : (typeof Soup.MAJOR_VERSION === 'number' ? Soup.MAJOR_VERSION : 2);
                return this.soupVersion;
            })();
    };

    targetPrototype.readTextFile = function(path) {
        const [ok, buf] = GLib.file_get_contents(path);
        return ok && buf ? new TextDecoder('utf-8').decode(buf) : '';
    };

    targetPrototype.createTempDir = function() {
        const dirPath = GLib.build_filenamev([GLib.get_tmp_dir(), `lastlayer-upload-${Date.now()}`]);
        GLib.mkdir_with_parents(dirPath, 0o755);
        return dirPath;
    };

    targetPrototype.cleanupTempDir = function(dirPath) {
        if (!dirPath) return;
        const dir = Gio.File.new_for_path(dirPath);
        if (!dir.query_exists(null)) return;

        const enumerator = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        for (let info; (info = enumerator.next_file(null));)
            dir.get_child(info.get_name()).delete(null);
        enumerator.close(null);
        dir.delete(null);
    };

    targetPrototype.writeTextToTemp = function(dirPath, fileName, payload) {
        return ((target) => (GLib.file_set_contents(target, payload ?? ''), target))(GLib.build_filenamev([dirPath, fileName]));
    };

    targetPrototype.ensureFileForPart = function(part, dirPath, defaultName) {
        return (part?.path && GLib.file_test(part.path, GLib.FileTest.IS_REGULAR))
            ? part.path
            : (part?.bytes ? (() => {
                const target = GLib.build_filenamev([dirPath, defaultName]);
                const file = Gio.File.new_for_path(target);
                const stream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
                stream.write_bytes(part.bytes, null);
                stream.flush(null);
                stream.close(null);
                return target;
            })() : null);
    };
}
