export const RICE_LEVELS = {
    1: { code: 'WM', name: 'Window Manager', patterns: ['hyprland', 'sway', 'i3', 'bspwm', 'qtile', 'awesome', 'xmonad', 'kwin', 'wayfire', 'river', 'hyprland.conf'] },
    2: { code: 'BAR', name: 'Status Bar', patterns: ['waybar', 'polybar', 'eww', 'ags', 'quickshell', 'ignis', 'hyprpanel', 'swaybar', 'fabric', 'wallpaper', 'swww', 'hyprpaper'] },
    3: { code: 'APPS', name: 'Applications', patterns: ['kitty', 'alacritty', 'foot', 'wezterm', 'ghostty', 'nvim', 'vim', 'helix', 'yazi', 'ranger', 'zsh', 'fish', 'starship'] },
    4: { code: 'LAUNCH', name: 'Launcher', patterns: ['rofi', 'wofi', 'fuzzel', 'bemenu', 'dmenu', 'tofi', 'anyrun', 'dunst', 'mako', 'swaync'] },
    5: { code: 'EXTRAS', name: 'Extras', patterns: ['hyprlock', 'swaylock', 'mpv', 'cava', 'spicetify', 'ncmpcpp', 'btop', 'fastfetch', 'neofetch', 'gtklock'] },
    6: { code: 'SYSTEM', name: 'System', patterns: ['gtk-3.0', 'gtk-4.0', 'qt5ct', 'qt6ct', 'kvantum', 'grub', 'plymouth', 'sddm', 'gdm', 'lightdm', 'cursors', 'icons'] }
};
