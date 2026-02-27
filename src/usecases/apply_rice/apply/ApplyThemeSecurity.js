import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import {processGtkEvents} from '../../../infrastructure/utils/Utils.js';

class ApplyThemeSecurity {
    calculateScriptChecksum(content) {
        return GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, content, content.length);
    }

    isScriptApproved(scriptPath, checksum) {
        return checksum && this.approvedScripts.get(scriptPath) === checksum;
    }

    markScriptApproved(scriptPath, checksum) {
        checksum && this.approvedScripts.set(scriptPath, checksum);
    }

    getSettingsArray(settings, key) {
        const settingsArray = Array.isArray(settings?.[key]) && settings[key].length ? settings[key] : null;
        const AppSettingsClass = this.getAppSettingsClass();
        const defaults = AppSettingsClass ? new AppSettingsClass({}) : null;
        return settingsArray || (Array.isArray(defaults?.[key]) && defaults[key].length ? defaults[key] : []);
    }

    standardizeStringList(values) {
        return values
            .filter(value => typeof value === 'string' && value.trim().length)
            .map(value => value.trim());
    }

    buildSecurityPatternEntries(settings = {}) {
        const seen = new Set();

        return this.standardizeStringList(this.getSettingsArray(
            settings,
            'dangerousPatterns'
        ))
            .filter(p => {
                const key = p.toLowerCase();
                const alreadySeen = seen.has(key);
                seen.add(key);
                return !alreadySeen;
            })
            .map(normalizedPattern => ({
                pattern: normalizedPattern,
                regex: normalizedPattern && /(\\[dws]|[\[\]*+?{}()|^$])/i.test(normalizedPattern)
                    ? new RegExp(normalizedPattern, 'i')
                    : null,
                normalized: normalizedPattern.toLowerCase(),
                type: 'warning'
            }));
    }

    buildSecurityExceptions(settings = {}) {
        const values = this.getSettingsArray(settings, 'securityExceptions');

        return this.standardizeStringList(values).map(v => v.toLowerCase());
    }

    analyseScriptForSecurity(scriptContent, settings = {}) {
        if (typeof scriptContent !== 'string' || !scriptContent.trim()) {
            return {
                dangerous: false,
                critical: false,
                matches: []
            };
        }

        const entries = this.buildSecurityPatternEntries(settings);
        if (entries.length === 0) {
            return {dangerous: false, critical: false, matches: []};
        }

        const exceptions = this.buildSecurityExceptions(settings);
        const matches = [];
        const seen = new Set();

        const lines = scriptContent
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#') && !line.startsWith('//'));
        for (const line of lines.filter((item) => {
            const normalized = item.toLowerCase();
            return !exceptions.some((exception) => normalized.includes(exception));
        })) {
            const normalizedLine = line.toLowerCase();

            entries.forEach((entry) => {
                const {pattern, regex, normalized, type} = entry;
                const matched = (regex && regex.test(line))
                    || (normalized && normalized.length && normalizedLine.includes(normalized));
                const key = `${pattern.toLowerCase()}::${line}`;
                matched && !seen.has(key) && (seen.add(key), matches.push({pattern, line, type}));
            });
        }

        const dangerous = matches.length > 0;
        const critical = matches.some((match) => match.type === 'critical');

        return {dangerous, critical, matches};
    }

    promptScriptApprovalSync(scriptPath, scriptContent, analysis) {
        const {matches, critical} = analysis;

        const dialog = new Gtk.Dialog({
            title: critical ? '⚠️ Critical commands detected' : 'Installation script review',
            modal: true,
            default_width: 760,
            default_height: 520,
            resizable: false
        });

        dialog.set_destroy_with_parent(true);
        dialog.set_skip_taskbar_hint(true);

        this.getMainWindow() instanceof Gtk.Window && dialog.set_transient_for(this.getMainWindow());

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(10);
        contentArea.set_margin_top(12);
        contentArea.set_margin_bottom(12);
        contentArea.set_margin_start(16);
        contentArea.set_margin_end(16);

        const headerBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 2});

        const headerTitleLabel = new Gtk.Label({
            label: '⚠️ Potentially dangerous commands detected',
            halign: Gtk.Align.START,
            xalign: 0
        });
        headerTitleLabel.get_style_context().add_class('header-label');

        const headerPathLabel = new Gtk.Label({
            label: scriptPath,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        headerPathLabel.get_style_context().add_class('footnote');

        headerBox.pack_start(headerTitleLabel, false, false, 0);
        headerBox.pack_start(headerPathLabel, false, false, 0);
        contentArea.add(headerBox);

        Array.isArray(matches) && matches.length > 0 && (() => {
            const matchLines = matches
                .map((match, index) => {
                    return `${index + 1}. ${match.type === 'critical' ? '[CRITICAL]' : '[WARNING]'} ${match.pattern}\n    ${match.line}`;
                })
                .join('\n');

            const matchesView = new Gtk.TextView({
                editable: false,
                monospace: true,
                wrap_mode: Gtk.WrapMode.NONE
            });
            matchesView.get_buffer().set_text(matchLines, -1);

            const matchesScrolled = new Gtk.ScrolledWindow({
                hexpand: true,
                vexpand: false,
                height_request: 160
            });
            matchesScrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
            matchesScrolled.add(matchesView);
            contentArea.add(matchesScrolled);
        })();

        const warningKey = critical ? 'SCRIPT_APPROVAL_CRITICAL_WARNING' : 'SCRIPT_APPROVAL_WARNING';
        const warningFallback = critical
            ? 'Critical commands detected. Execution blocked.'
            : 'Warning: This script may modify your system. Continue only if you are sure.';
        const warningText = this.translate(warningKey);

        const warningLabel = new Gtk.Label({
            label: warningText === warningKey ? warningFallback : warningText,
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true
        });
        warningLabel.get_style_context().add_class(critical ? 'security-critical-text' : 'security-warning-text');
        contentArea.add(warningLabel);

        typeof scriptContent === 'string' && scriptContent.trim().length > 0 && (() => {
            const scriptView = new Gtk.TextView({
                editable: false,
                monospace: true,
                wrap_mode: Gtk.WrapMode.NONE
            });
            scriptView.get_buffer().set_text(scriptContent, -1);

            const scriptScrolled = new Gtk.ScrolledWindow({
                hexpand: true,
                vexpand: true
            });
            scriptScrolled.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
            scriptScrolled.add(scriptView);
            contentArea.add(scriptScrolled);
        })();

        const cancelButton = dialog.add_button(
            this.translate('SCRIPT_APPROVAL_BLOCK') === 'SCRIPT_APPROVAL_BLOCK'
                ? 'Block'
                : this.translate('SCRIPT_APPROVAL_BLOCK'),
            Gtk.ResponseType.CANCEL
        );
        cancelButton.get_style_context().add_class('destructive-action');

        if (!critical) {
            const continueButton = dialog.add_button(
                this.translate('SCRIPT_APPROVAL_CONTINUE') === 'SCRIPT_APPROVAL_CONTINUE'
                    ? 'Continue'
                    : this.translate('SCRIPT_APPROVAL_CONTINUE'),
                Gtk.ResponseType.OK
            );
            continueButton.get_style_context().add_class('suggested-action');
            dialog.set_default_response(Gtk.ResponseType.OK);
        } else {
            dialog.set_default_response(Gtk.ResponseType.CANCEL);
        }

        dialog.show_all();

        const response = dialog.run();
        dialog.destroy();

        return !critical && new Set([
            Gtk.ResponseType.OK,
            Gtk.ResponseType.APPLY,
            Gtk.ResponseType.YES,
            Gtk.ResponseType.ACCEPT
        ]).has(response);
    }

    enforceScriptSafetySync(scriptPath, settings = {}) {
        processGtkEvents();
        const scriptExists = Gio.File.new_for_path(scriptPath).query_exists(null);
        const [ok, content] = scriptExists ? GLib.file_get_contents(scriptPath) : [false, null];
        const text = ok && content ? new TextDecoder('utf-8').decode(content) : '';
        if (!text) {
            return true;
        }

        processGtkEvents();
        const checksum = this.calculateScriptChecksum(text);
        const alreadyApproved = this.isScriptApproved(scriptPath, checksum);
        return alreadyApproved
            ? true
            : (() => {
                processGtkEvents();
                const analysis = this.analyseScriptForSecurity(text, settings);
                return !analysis.dangerous
                    ? (this.markScriptApproved(scriptPath, checksum), true)
                    : (() => {
                        processGtkEvents();
                        const allowed = this.promptScriptApprovalSync(scriptPath, text, analysis);
                        allowed && this.markScriptApproved(scriptPath, checksum);
                        return allowed;
                    })();
            })();
    }
}

export function applyApplyThemeSecurity(targetProto) {
    copyPrototypeDescriptors(targetProto, ApplyThemeSecurity.prototype);
}
