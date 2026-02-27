import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import {COMMAND_BIN, HYPRLAND_LAYOUT_MAP, HYPRLAND_VERSION_PATTERNS} from './TweaksViewConstants.js';
import {enableHandCursorOnHover} from '../../common/ViewUtils.js';

export function applyTweaksViewUIBasic(targetPrototype) {
    copyPrototypeDescriptors(targetPrototype, TweaksViewUIBasic.prototype);
}

class TweaksViewUIBasic {
    runWhenTweaksEditable(callback) {
        (this.tabState === 'tweaks' && !this.tweaksLocked) && callback();
    }

    createTweakSwitch(active, marginStart = 20) {
        const toggle = new Gtk.Switch({active});
        toggle.get_style_context().add_class('tweaks-switch');
        enableHandCursorOnHover(toggle);
        toggle.set_margin_start(marginStart);
        toggle.set_halign(Gtk.Align.START);
        return toggle;
    }

    createTweaksHeaderSection() {
        let hyprlandVersionForTweaks = this.translate('UNKNOWN');
        const [success, stdout] = this.execSync([COMMAND_BIN.HYPRCTL, 'version']);
        success && (() => {
            const cleanOutput = stdout.replace(/\s+/g, ' ').trim();
            const detectedVersion = HYPRLAND_VERSION_PATTERNS
                .map((pattern) => cleanOutput.match(pattern)?.[1])
                .find((value) => Boolean(value));
            hyprlandVersionForTweaks = detectedVersion
                || (/commit\s+[a-f0-9]+/i.test(cleanOutput) ? 'Git' : hyprlandVersionForTweaks);
        })();

        this.tweaksVersionLabel = this.Label({
            label: this.translate('PLUGINS_HYPRLAND_VERSION', {version: hyprlandVersionForTweaks}),
            className: 'tweaks-version-label',
            halign: Gtk.Align.END,
            valign: Gtk.Align.START,
            margin_end: 20
        });

        this.tweaksHeaderBox = this.Box({
            vertical: false,
            children: [this.Box({hexpand: true}), this.tweaksVersionLabel],
            margin_bottom: 12
        });
        this.tweaksHeaderBox.get_style_context().add_class('tweaks-header-container');
    }

    createTilingModeSection() {
        this.tilingModeLabel = this.Label({label: this.translate('BASIC_TILING_MODE')});
        this.tilingModeCombo = new Gtk.ComboBoxText();
        this.tilingModeCombo.append('dwindle', this.translate('TILING_MODE_DWINDLE'));
        this.tilingModeCombo.append('master', this.translate('TILING_MODE_MASTER'));
        this.tilingModeCombo.append('floating', this.translate('TILING_MODE_FLOATING'));
        this.tilingModeCombo.append('tiled', this.translate('TILING_MODE_TILED'));

        let currentTilingMode = 'dwindle';
        const [ok, output] = this.execSync([COMMAND_BIN.HYPRCTL, 'getoption', 'general:layout']);
        const detected = ok && output
            ? HYPRLAND_LAYOUT_MAP.find(([needle]) => output.includes(needle))
            : null;
        currentTilingMode = detected?.[1] || currentTilingMode;

        this.tilingModeCombo.set_active_id(currentTilingMode);
        this.tilingModeCombo.set_halign(Gtk.Align.START);

        this.connectTweaksHandler(this.tilingModeCombo, 'changed', (combo) => {
            const activeId = combo.get_active_id();
            activeId && this.runWhenTweaksEditable(() => {
                this.currentTweaks.tilingMode = activeId;
                this.scheduleApplyCurrentTweaks(0);
            });
        });
    }

    createAnimationsSection(animationsInit) {
        this.animationsLabel = this.Label({label: this.translate('BASIC_ANIMATIONS')});
        this.animationsSwitch = this.createTweakSwitch(animationsInit);

        this.connectTweaksHandler(this.animationsSwitch, 'state-set', (switchWidget, state) => {
            this.runWhenTweaksEditable(() => {
                this.currentTweaks.animations = state;
                this.scheduleApplyCurrentTweaks(0);
            });
        });
    }

    createDecorSection(roundingInit, blurInit, blurPassesInit, blurOptimInit) {
        const rounding = this.createScaleEntryControl({
            labelKey: 'BASIC_ROUNDING', initValue: roundingInit,
            min: 0, max: 50, step: 0.5, pageStep: 5, tweakKey: 'rounding'
        });
        this.roundingLabel = rounding.label;
        this.roundingScale = rounding.scale;
        this.roundingEntry = rounding.entry;

        const blur = this.createScaleEntryControl({
            labelKey: 'BASIC_BLUR', initValue: Math.round(blurInit),
            min: 0, max: 150, step: 1, pageStep: 10, tweakKey: 'blur', widthChars: 5
        });
        this.blurLabel = blur.label;
        this.blurScale = blur.scale;
        this.blurEntry = blur.entry;

        const blurPasses = this.createScaleEntryControl({
            labelKey: 'BASIC_BLUR_PASSES', initValue: blurPassesInit,
            min: 1, max: 10, step: 1, pageStep: 1, tweakKey: 'blurPasses'
        });
        this.blurPassesLabel = blurPasses.label;
        this.blurPassesScale = blurPasses.scale;
        this.blurPassesEntry = blurPasses.entry;

        this.blurOptimCheck = this.checkbox({
            label: this.translate('BASIC_BLUR_OPTIMIZATIONS'),
            active: blurOptimInit,
            onChange: (active) => {
                this.runWhenTweaksEditable(() => {
                    this.currentTweaks.blurOptim = active;
                    this.scheduleApplyCurrentTweaks(0);
                });
            }
        });
    }

    createGapsSectionWidgets(gapsInInit, gapsOutInit) {
        const gapsIn = this.createScaleEntryControl({
            labelKey: 'BASIC_GAPS_IN', initValue: gapsInInit,
            min: 0, max: 40, step: 0.5, pageStep: 5, tweakKey: 'gapsIn'
        });
        this.gapsInLabel = gapsIn.label;
        this.gapsInScale = gapsIn.scale;
        this.gapsInEntry = gapsIn.entry;

        const gapsOut = this.createScaleEntryControl({
            labelKey: 'BASIC_GAPS_OUT', initValue: gapsOutInit,
            min: 0, max: 40, step: 0.5, pageStep: 5, tweakKey: 'gapsOut'
        });
        this.gapsOutLabel = gapsOut.label;
        this.gapsOutScale = gapsOut.scale;
        this.gapsOutEntry = gapsOut.entry;
    }

    createOpacitySectionWidgets() {
        this.dimInactiveLabel = this.Label({label: this.translate('BASIC_DIM_INACTIVE')});
        this.dimInactiveSwitch = this.createTweakSwitch(false);

        this.connectTweaksHandler(this.dimInactiveSwitch, 'state-set', (switchWidget, state) => {
            this.runWhenTweaksEditable(() => {
                this.currentTweaks.dimInactive = state;
                this.scheduleApplyCurrentTweaks(0);
            });
        });

        const dimStrength = this.createScaleEntryControl({
            labelKey: 'BASIC_DIM_STRENGTH', initValue: 50,
            min: 0, max: 100, step: 1, pageStep: 10, tweakKey: 'dimStrength'
        });
        this.dimStrengthLabel = dimStrength.label;
        this.dimStrengthScale = dimStrength.scale;
        this.dimStrengthEntry = dimStrength.entry;

        const activeOpacity = this.createScaleEntryControl({
            labelKey: 'BASIC_ACTIVE_OPACITY', initValue: 100,
            min: 0, max: 100, step: 1, pageStep: 10, tweakKey: 'activeOpacity',
            valueTransform: (v) => v / 100
        });
        this.activeOpacityLabel = activeOpacity.label;
        this.activeOpacityScale = activeOpacity.scale;
        this.activeOpacityEntry = activeOpacity.entry;

        const inactiveOpacity = this.createScaleEntryControl({
            labelKey: 'BASIC_INACTIVE_OPACITY', initValue: 90,
            min: 0, max: 100, step: 1, pageStep: 10, tweakKey: 'inactiveOpacity',
            valueTransform: (v) => v / 100
        });
        this.inactiveOpacityLabel = inactiveOpacity.label;
        this.inactiveOpacityScale = inactiveOpacity.scale;
        this.inactiveOpacityEntry = inactiveOpacity.entry;

        const fullscreenOpacity = this.createScaleEntryControl({
            labelKey: 'BASIC_FULLSCREEN_OPACITY', initValue: 100,
            min: 0, max: 100, step: 1, pageStep: 10, tweakKey: 'fullscreenOpacity',
            valueTransform: (v) => v / 100
        });
        this.fullscreenOpacityLabel = fullscreenOpacity.label;
        this.fullscreenOpacityScale = fullscreenOpacity.scale;
        this.fullscreenOpacityEntry = fullscreenOpacity.entry;
    }

    createInputSectionWidgets() {
        const mouseSensitivity = this.createScaleEntryControl({
            labelKey: 'BASIC_MOUSE_SENSITIVITY', initValue: 0,
            min: -1, max: 1, step: 0.1, pageStep: 0.2, tweakKey: 'mouseSensitivity',
            widthChars: 5, parseFunc: parseFloat
        });
        this.mouseSensitivityLabel = mouseSensitivity.label;
        this.mouseSensitivityScale = mouseSensitivity.scale;
        this.mouseSensitivityEntry = mouseSensitivity.entry;

        const scrollFactor = this.createScaleEntryControl({
            labelKey: 'BASIC_SCROLL_FACTOR', initValue: 1,
            min: 0, max: 10, step: 0.1, pageStep: 1, tweakKey: 'scrollFactor',
            widthChars: 5, parseFunc: parseFloat
        });
        this.scrollFactorLabel = scrollFactor.label;
        this.scrollFactorScale = scrollFactor.scale;
        this.scrollFactorEntry = scrollFactor.entry;

        this.followMouseCheck = this.checkbox({
            label: this.translate('BASIC_FOLLOW_MOUSE'),
            onChange: (active) => {
                this.runWhenTweaksEditable(() => {
                    this.currentTweaks.followMouse = active ? 1 : 0;
                    this.scheduleApplyCurrentTweaks(0);
                });
            }
        });

        this.forceNoAccelCheck = this.checkbox({
            label: this.translate('BASIC_FORCE_NO_ACCEL'),
            onChange: (active) => {
                this.runWhenTweaksEditable(() => {
                    this.currentTweaks.forceNoAccel = active;
                    this.scheduleApplyCurrentTweaks(0);
                });
            }
        });

        this.naturalScrollCheck = this.checkbox({
            label: this.translate('BASIC_NATURAL_SCROLL'),
            onChange: (active) => {
                this.runWhenTweaksEditable(() => {
                    this.currentTweaks.naturalScroll = active;
                    this.scheduleApplyCurrentTweaks(0);
                });
            }
        });
    }

    createTweaksLayoutRows() {
        let tilingModeRow = this.Box({
            spacing: 2, hexpand: true,
            children: [this.tilingModeLabel, this.tilingModeCombo, this.Box({hexpand: true})]
        });

        let animationsRow = this.Box({
            spacing: 2, hexpand: true, margin_top: 6, margin_bottom: 6,
            children: [this.animationsLabel, this.animationsSwitch, this.Box({hexpand: true})]
        });

        let roundingRow = this.Box({
            spacing: 2,
            hexpand: true,
            children: [this.roundingLabel, this.roundingScale, this.roundingEntry]
        }),
            blurRow = this.Box({
            spacing: 2,
            hexpand: true,
            children: [this.blurLabel, this.blurScale, this.blurEntry]
        }),
            blurPassesRow = this.Box({
            spacing: 2,
            hexpand: true,
            children: [this.blurPassesLabel, this.blurPassesScale, this.blurPassesEntry]
        }),
            gapsInRow = this.Box({
            spacing: 2,
            hexpand: true,
            children: [this.gapsInLabel, this.gapsInScale, this.gapsInEntry]
        }),
            gapsOutRow = this.Box({
            spacing: 2,
            hexpand: true,
            children: [this.gapsOutLabel, this.gapsOutScale, this.gapsOutEntry]
        }),
            checkboxRow = this.Box({spacing: 12, hexpand: false, children: [this.blurOptimCheck]});

        let dimInactiveRow = this.Box({
            spacing: 2, hexpand: true, margin_top: 6, margin_bottom: 6,
            children: [this.dimInactiveLabel, this.dimInactiveSwitch, this.Box({hexpand: true})]
        });
        let dimStrengthRow = this.Box({
            spacing: 2,
            hexpand: true,
            children: [this.dimStrengthLabel, this.dimStrengthScale, this.dimStrengthEntry]
        }),
            activeOpacityRow = this.Box({
            spacing: 2,
            hexpand: true,
            children: [this.activeOpacityLabel, this.activeOpacityScale, this.activeOpacityEntry]
        }),
            inactiveOpacityRow = this.Box({
            spacing: 2,
            hexpand: true,
            children: [this.inactiveOpacityLabel, this.inactiveOpacityScale, this.inactiveOpacityEntry]
        }),
            fullscreenOpacityRow = this.Box({
            spacing: 2,
            hexpand: true,
            children: [this.fullscreenOpacityLabel, this.fullscreenOpacityScale, this.fullscreenOpacityEntry]
        });

        let mouseSensitivityRow = this.Box({
            spacing: 2,
            hexpand: true,
            children: [this.mouseSensitivityLabel, this.mouseSensitivityScale, this.mouseSensitivityEntry]
        }),
            scrollFactorRow = this.Box({
            spacing: 2,
            hexpand: true,
            children: [this.scrollFactorLabel, this.scrollFactorScale, this.scrollFactorEntry]
        }),
            inputCheckboxRow = this.Box({
            spacing: 12,
            hexpand: false,
            children: [this.followMouseCheck, this.forceNoAccelCheck, this.naturalScrollCheck]
        });

        function createSeparator() {
            let sep = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
            sep.set_margin_top(6);
            sep.set_margin_bottom(6);
            sep.get_style_context().add_class('tweaks-separator');
            return sep;
        }

        return {
            tilingModeRow, animationsRow, roundingRow, blurRow, blurPassesRow,
            gapsInRow, gapsOutRow, checkboxRow, dimInactiveRow, dimStrengthRow,
            activeOpacityRow, inactiveOpacityRow, fullscreenOpacityRow,
            mouseSensitivityRow, scrollFactorRow, inputCheckboxRow, createSeparator
        };
    }

    createAllUIElements(roundingInit, blurInit, gapsInInit, gapsOutInit, blurPassesInit, blurOptimInit, animationsInit) {
        this.createTweaksHeaderSection();
        this.createTilingModeSection();
        this.createAnimationsSection(animationsInit);
        this.createDecorSection(roundingInit, blurInit, blurPassesInit, blurOptimInit);
        this.createGapsSectionWidgets(gapsInInit, gapsOutInit);
        this.createOpacitySectionWidgets();
        this.createInputSectionWidgets();

        const rows = this.createTweaksLayoutRows();
        const sep = rows.createSeparator;

        this.tweaksBoxGlobal = this.Box({
            vertical: true,
            spacing: 4,
            margin_top: 6,
            margin_start: 8,
            margin_end: 8,
            margin_bottom: 6,
            children: [
                this.tweaksHeaderBox,
                rows.tilingModeRow,
                rows.animationsRow,
                sep(),
                rows.roundingRow,
                rows.blurRow,
                rows.blurPassesRow,
                sep(),
                rows.gapsInRow,
                rows.gapsOutRow,
                sep(),
                rows.checkboxRow,
                sep(),
                rows.dimInactiveRow,
                rows.dimStrengthRow,
                rows.activeOpacityRow,
                rows.inactiveOpacityRow,
                rows.fullscreenOpacityRow,
                sep(),
                rows.mouseSensitivityRow,
                rows.scrollFactorRow,
                rows.inputCheckboxRow,
                this.Box({hexpand: true})
            ],
            hexpand: false,
            vexpand: true
        });
    }
}
