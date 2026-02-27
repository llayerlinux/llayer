import {copyPrototypeDescriptors} from '../../../infrastructure/utils/PrototypeMixins.js';
import Gtk from 'gi://Gtk?version=3.0';
import Gdk from 'gi://Gdk?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import { Commands } from '../../../infrastructure/constants/Commands.js';
import { addPointerCursor, applyLabelAttributes } from '../../common/ViewUtils.js';
import {
    createRedditStatsRow,
    createRedditThreadTitleLabel,
    determineRedditStats,
    scheduleRedditStatsUpdate
} from '../../common/RedditStatsCardShared.js';

class ThemeContextMenuViewPopupPublicated {
    createPublishedSection() {
        const url = (this.menuData?.repository?.published || this.menuData?.theme?.published || '').trim();
        if (!url) {
            return null;
        }

        let container = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4});
        container.get_style_context().add_class('published-box');

        let publishedLabel = this.translate('PUBLISHED'),
            title = new Gtk.Label({
            label: publishedLabel,
            xalign: 0
        });
        title.get_style_context().add_class('pkg-title');
        container.pack_start(title, false, false, 0);

        const infoRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            hexpand: true,
            halign: Gtk.Align.FILL
        });
        infoRow.get_style_context().add_class('reddit-info-row');

        let normalizedUrl = this.parseRedditUrl(url),
            linkUri = normalizedUrl || url,
            linkLabel = this.isRedditUrl(url) ? 'Reddit' : url;
        let linkButton = new Gtk.LinkButton({
            uri: linkUri,
            label: linkLabel,
            halign: Gtk.Align.START,
            margin_start: 0
        });
        linkButton.get_style_context().add_class('published-link');
        infoRow.pack_start(linkButton, false, false, 0);

        let upValue = null;
        let commentsValue = null;

        if (!this.isRedditUrl(url)) {
            container.pack_start(infoRow, false, false, 0);
            container.show_all();
            return container;
        }

        let outerContainer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 0,
            hexpand: true
        });
        outerContainer.get_style_context().add_class('reddit-block-outer');

        let iconOverflowSpacer = new Gtk.Box({});
        iconOverflowSpacer.set_size_request(-1, 22);
        outerContainer.pack_start(iconOverflowSpacer, false, false, 0);

        let redditContainer = new Gtk.Frame({
            shadow_type: Gtk.ShadowType.IN
        });
        redditContainer.get_style_context().add_class('reddit-block-frame');

        const innerBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0
        });

        const headerRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            margin: 6
        });

        const currentDir = GLib.get_current_dir();
        const logoPath = `${currentDir}/assets/reddit-logo.png`;
        const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(logoPath, 22, 22, true);
        const redditIcon = new Gtk.Image();
        redditIcon.set_from_pixbuf(pixbuf);
        redditIcon.get_style_context().add_class('reddit-logo');
        headerRow.pack_start(redditIcon, false, false, 0);

        const threadLabelText = this.translate('REDDIT_THREAD_TITLE');
        const threadLabel = new Gtk.Label({
            label: threadLabelText
        });
        applyLabelAttributes(threadLabel, { bold: true });
        threadLabel.get_style_context().add_class('reddit-thread-title');
        headerRow.pack_start(threadLabel, true, true, 0);

        const publishedBadge = new Gtk.Label({label: this.translate('PUBLISHED_BADGE')});
        publishedBadge.get_style_context().add_class('published-badge');
        const badgeBox = new Gtk.Box();
        badgeBox.get_style_context().add_class('published-badge-box');
        badgeBox.pack_start(publishedBadge, false, false, 8);
        headerRow.pack_end(badgeBox, false, false, 0);

        innerBox.pack_start(headerRow, false, false, 0);

        const threadTitle = createRedditThreadTitleLabel(this.translate('LOADING'));
        innerBox.pack_start(threadTitle, false, false, 0);

        const statsWidgets = createRedditStatsRow();
        const statsRow = statsWidgets.statsRow;
        upValue = statsWidgets.upValue;
        commentsValue = statsWidgets.commentsValue;

        const openButton = new Gtk.Button({label: this.translate('OPEN_ON_REDDIT')});
        openButton.get_style_context().add_class('reddit-open-button');
        addPointerCursor(openButton);
        openButton.connect('clicked', () => {
            const normalizedUrl = this.parseRedditUrl(url);
            normalizedUrl && this.openExternalUrl(normalizedUrl);
        });
        statsRow.pack_end(openButton, false, false, 0);

        innerBox.pack_start(statsRow, false, false, 0);
        redditContainer.add(innerBox);

        this.fetchRedditStats(url, (stats) => {
            const resolved = determineRedditStats(stats, this.menuData?.theme?.name, this.translate('REDDIT_POST_TITLE'));
            scheduleRedditStatsUpdate({
                upValue,
                commentsValue,
                threadTitle,
                ups: resolved.ups,
                comments: resolved.comments,
                title: resolved.title,
                maxLength: 50
            });
        });

        outerContainer.pack_start(redditContainer, true, true, 0);

        const overlay = new Gtk.Overlay();
        overlay.set_hexpand(true);
        overlay.set_halign(Gtk.Align.FILL);
        outerContainer.set_hexpand(true);
        outerContainer.set_halign(Gtk.Align.FILL);
        overlay.add(outerContainer);

        const youtubeLink = (this.menuData?.repository?.youtubeLink || this.menuData?.theme?.youtubeLink || '').trim();
        const youtubeIconPath = this.getYoutubeIconPath();
        const youtubeIconSmall = this.createYoutubeIcon(30, 30);
        const youtubeIconLarge = this.createYoutubeIcon(35, 35);
        if (youtubeLink && youtubeIconSmall && youtubeIconLarge && youtubeIconPath) {
            const iconWrapper = new Gtk.Box({
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.START,
                hexpand: false
            });
            iconWrapper.set_margin_top(-8);

            const stack = new Gtk.Stack();
            stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE);
            stack.set_transition_duration(100);

            const smallContainer = new Gtk.Box({halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER});
            smallContainer.set_size_request(35, 35);
            youtubeIconSmall.set_halign(Gtk.Align.CENTER);
            youtubeIconSmall.set_valign(Gtk.Align.CENTER);
            smallContainer.pack_start(youtubeIconSmall, true, false, 0);

            const largeContainer = new Gtk.Box({halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER});
            largeContainer.set_size_request(35, 35);
            youtubeIconLarge.set_halign(Gtk.Align.CENTER);
            youtubeIconLarge.set_valign(Gtk.Align.CENTER);
            largeContainer.pack_start(youtubeIconLarge, true, false, 0);

            stack.add_named(smallContainer, 'small');
            stack.add_named(largeContainer, 'large');
            stack.set_visible_child_name('small');

            let isHovered = false;
            const eventBox = new Gtk.EventBox();
            eventBox.set_visible_window(false);
            eventBox.set_above_child(true);
            eventBox.add(stack);
            eventBox.add_events(Gdk.EventMask.ENTER_NOTIFY_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK | Gdk.EventMask.BUTTON_PRESS_MASK);
            addPointerCursor(eventBox);

            eventBox.connect('enter-notify-event', () => {
                return isHovered
                    ? false
                    : (isHovered = true, stack.set_visible_child_name('large'), false);
            });
            eventBox.connect('leave-notify-event', () => {
                return !isHovered
                    ? false
                    : (isHovered = false, stack.set_visible_child_name('small'), false);
            });
            eventBox.connect('button-press-event', () => {
                youtubeLink && GLib.spawn_command_line_async(`${Commands.XDG_OPEN} "${youtubeLink}"`);
                return true;
            });

            iconWrapper.pack_start(eventBox, false, false, 0);
            overlay.add_overlay(iconWrapper);
        }

        overlay.show_all();
        return overlay;
    }
}

export function applyThemeContextMenuViewPopupPublicated(prototype) {
    copyPrototypeDescriptors(prototype, ThemeContextMenuViewPopupPublicated.prototype);
}
