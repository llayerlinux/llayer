import Gtk from 'gi://Gtk?version=3.0';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';

function createStatBox(iconText, iconClass, initialValue = '--') {
    const box = new Gtk.Box({ spacing: 4 }),
        icon = new Gtk.Label({ label: iconText }),
        valueLabel = new Gtk.Label({ label: initialValue });
    icon.get_style_context().add_class(iconClass);
    valueLabel.get_style_context().add_class('reddit-stat-value');

    box.pack_start(icon, false, false, 0);
    box.pack_start(valueLabel, false, false, 0);
    return { box, valueLabel };
}

export function createRedditThreadTitleLabel(loadingText, options = {}) {
    const {
        marginTop = 0,
        marginBottom = 3,
        marginStart = 6,
        marginEnd = 6,
        maxWidthChars = 40
    } = options;

    const threadTitle = new Gtk.Label({
        label: loadingText,
        halign: Gtk.Align.START,
        xalign: 0,
        wrap: false,
        ellipsize: Pango.EllipsizeMode.END,
        max_width_chars: maxWidthChars,
        margin_start: marginStart,
        margin_end: marginEnd,
        margin_top: marginTop,
        margin_bottom: marginBottom
    });
    threadTitle.get_style_context().add_class('reddit-post-title');
    return threadTitle;
}

export function createRedditStatsRow() {
    const statsRow = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        margin_start: 6,
        margin_end: 6,
        margin_bottom: 6
    });

    const statsBox = new Gtk.Box({ spacing: 16 }),
        { box: upBox, valueLabel: upValue } = createStatBox('▲', 'reddit-stat-upvote'),
        { box: commentBox, valueLabel: commentsValue } = createStatBox('💬', 'reddit-stat-comment');

    statsBox.pack_start(upBox, false, false, 0);
    statsBox.pack_start(commentBox, false, false, 0);
    statsRow.pack_start(statsBox, true, true, 0);

    return { statsRow, upValue, commentsValue };
}

export function determineRedditStats(stats, fallbackTitle, defaultTitle) {
    return {
        ups: (stats && typeof stats.ups === 'number') ? Math.max(0, stats.ups) : null,
        comments: (stats && typeof stats.comments === 'number') ? Math.max(0, stats.comments) : null,
        title: stats?.title || fallbackTitle || defaultTitle
    };
}

export function scheduleRedditStatsUpdate({ upValue, commentsValue, threadTitle, ups, comments, title, maxLength = 50 }) {
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        upValue?.set_text?.(ups === null ? '--' : String(ups));
        commentsValue?.set_text?.(comments === null ? '--' : String(comments));
        const displayTitle = title.length > maxLength ? `${title.substring(0, maxLength)}...` : title;
        threadTitle?.set_text?.(displayTitle);

        return GLib.SOURCE_REMOVE;
    });
}
