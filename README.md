<div align="center">
  <img width="50%" height="320" alt="image" src="https://github.com/user-attachments/assets/6e8706dc-2cba-4f34-a753-fb22cc662d82" />
</div>

<div align="center">
  <img src="https://img.shields.io/github/last-commit/Litesav-L/lastlayer?style=for-the-badge&color=303030" />
  <img src="https://img.shields.io/badge/AUGUST-2025-8?style=for-the-badge" />
  <img src="https://img.shields.io/github/repo-size/Litesav-L/lastlayer?style=for-the-badge&cacheSeconds=30" />
  <img src="https://img.shields.io/badge/Linux-%23171717?style=for-the-badge&logo=linux&logoColor=white" />
  <img src="https://img.shields.io/badge/Arch-%23007ACC?style=for-the-badge&logo=arch-linux&logoColor=white" />
  <img src="https://img.shields.io/badge/Hyprland-%239566f2?style=for-the-badge&logoColor=white" />
</div>

# <img width="64" height="120" alt="icon" src="https://github.com/user-attachments/assets/27330896-e1fd-47d2-83cb-463c46a73475" /> lastlayer (llayer)

**A dynamic interface layer - a new abstraction above the desktop environment that lets you control the environment at multiple levels and transform it instantly.**

<p align="center">
  <img width="1594" height="1383" alt="image" src="https://github.com/user-attachments/assets/a8cf79e7-ad19-4686-8b66-7a5f7b8bf223" />
</p>

<details>
<summary><b>Contents</b></summary>

- [Update 1.1](#update-11)
- [Installation](#installation-)
- [Starter adapted rices (offline)](#starter-adapted-rices-offline)
- [Features](#features-)
- [Rice standard](#rice-standard-)
- [Adapting a rice](#adapting-an-existing-rice--creating-a-new-one-)
- [Roadmap](#roadmap-)
- [Tested on](#tested-on-)
</details>

## Update 1.1

1. The full source code has been opened (as previously planned).
2. Countries/rices analytics have been removed.
3. Added functionality to display and optionally send average install/apply speed metrics per theme (sending is disabled by default).
4. Added the ability to fill in and view extra rice metadata: a Reddit post (with parsing of general data) and a YouTube link.
5. Updated the rice (theme) card: implemented two display modes with a toggle switch: local theme and online theme.
6. Added a settings menu to manage bar lists, enabling support for rarer and not-yet-included customizable bars and other widgets inside rices.
7. Updated the restore point (save/restore) functionality.
8. Improved the rice apply/install algorithm; both operations are now 30% faster under the same testing conditions.
9. Improved the plugin system: added the ability to fix issues with the external hyprpm dependency inside the program, and to view internal terminal logs for other plugin operations.
10. Prepared a broader architectural base for integrating rices of other levels (rEFInd, GRUB, SDDM, etc.) and for supporting other window compositors.

## Installation 📦

```bash
git clone https://github.com/llayerlinux/lastlayer.git
cd lastlayer
./install.sh
```

> [!NOTE]
> All required dependencies are installed automatically by `install.sh`: **swww**, **yad**, **webkit2gtk**.

## Starter adapted rices (offline)

If the server is temporarily unavailable:

1. Download and extract the archive:  
   https://drive.google.com/file/d/1OEnQnXGsMM4Hn7oMiFKOpse70jhFeQdT/view?usp=sharing
2. Click **+** on the bottom button bar for local import
3. Navigate to the rice directory in your file manager and open it

## Features 💡

### Rice management
- **One-click rice switching.** Average apply time is ~2 seconds (and keeps improving).
- **Install rices** from the internet or **import locally** from the filesystem.
- **Share rices.** Upload your own rices (dotfiles) to the server for public access.
- **Edit/remove** the rice you uploaded from the GUI.
- **Open the configuration repository**, view supported distributions, and sync core info via Git.

### Configs and plugins
- Manage configurations through the GUI.
- Manage plugins via the GUI:
  - add plugin repositories
  - add custom parameters to a plugin
  - support different parameter types (for example, a color picker)

### Stability tools
- Fix problematic temporary states of supported tiling window managers.
- Save and restore external environment states.

### Security and isolation
- Security check of rice scripts before execution + custom security rules.
- Two-level isolation of rice dependencies: standard + controlled prefix system (beta).  
  If symlinks are found in a rice script, they get priority and the standard mechanism is disabled.

### UX and quality of life
- Configure the rice-switch animation (currently uses `swww`):
  - animation type
  - FPS
  - duration
  - wave angle
- Additional options:
  - auto-apply a rice after boot (optional)
  - keep or close the rice list window after selection
  - enable logging of apply/install time
- Multilingual support: currently 4 languages are supported.
- lastlayer parameters:
  - switch the interface theme
  - basic sound control

## Rice standard 🎨

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/35e63df9-981f-4748-abe1-1e3f98dda7d0" width="300">
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/a9feb54e-7a3f-4f9f-90c7-2f66886bccb9" width="300">
    </td>
    <td align="center" valign="middle">
      <img src="https://github.com/user-attachments/assets/dd231164-f0c9-438e-b805-9fff8acfee8c" width="400"><br/>
      <img src="https://github.com/user-attachments/assets/04885899-f7f7-450d-ade2-799f0e8c5346" width="187">
    </td>
  </tr>
</table>

### Rice card (current)

The rice card is one of the core pop-ups and will expand in future versions.

A rice should include:
- **Preview** (512x512 or 1024x1024)
- **Repository link**
- **Author** (avatar is parsed automatically from Git)
- **Adaptation author** (optional)
- **Tags** (optional)
- **Functionality category** (optional; multiple allowed)
- **Supported distributions** (optional; if not specified, lastlayer generates the list automatically based on the script)

<details>
<summary><b>Planned</b></summary>

- Automatic conversion between distributions and tiling window managers
- Rating system (more details in the roadmap)
</details>

## Adapting an existing rice / creating a new one 🎨

In the first versions, the program temporarily requires a predictable rice structure.

### Minimal acceptable structure (Hyprland)

```text
RICE_NAME/
├── preview.png
├── wallpaper.png
├── hyprland.conf
├── hyprland/
│   ├── lastlayer.conf
└── start-scripts/
    ├── install_theme_apps.sh (optional)
    └── set_after_install_actions.sh
├── config/ (optional)
```

### Recommended structure

```text
RICE_NAME/
├── preview.png
├── wallpaper.png
├── hyprland.conf
├── hyprland/
│   ├── env.conf
│   ├── execs.conf
│   ├── general.conf
│   ├── rules.conf
│   ├── colors.conf
│   ├── keybinds.conf
│   └── lastlayer.conf
└── start-scripts/
    ├── install_theme_apps.sh (optional)
    └── set_after_install_actions.sh
├── config/ (optional)
```

### File meanings

- `preview.png` - image shown to the user in the rice list
- `wallpaper.png` - default desktop wallpaper
- `hyprland.conf` - references to Hyprland config files (direct parameters without links are also possible). Files related to this configuration must be placed in `hyprland/`.
- `lastlayer.conf` - lastlayer configuration that keeps switching consistent, hides auxiliary terminals during switching, and sets required visibility attributes for the program window.

### start-scripts/

- `install_theme_apps.sh` (optional)  
  Installs accompanying applications. Runs only on the first installation of a rice.
- `set_after_install_actions.sh`  
  Launches accompanying applications. Runs every time a rice is applied.

### config/ (optional)

Directory with configuration files of accompanying applications.

> [!TIP]
> For examples, check the preset rices in the lastlayer Network section (or the starter archive above). They follow the common pattern of splitting Hyprland config into multiple files and referencing them from `hyprland.conf`.

<details>
<summary><b>Notes about compatibility and scripts (current approach)</b></summary>

- For now, lastlayer expects a predictable rice structure. In future versions you will be able to import legacy rices without restructuring them (rices that already follow this layout will stay backward compatible).
- Rice scripts install and launch accompanying applications to keep all actions transparent and easy to review.
- lastlayer detects potentially dangerous commands and will not run them without explicit user consent.

</details>

## Roadmap 🔮

- [x] Open-sourced the codebase with architecture prepared for future features
- [x] Integrate Reddit rating metadata and a YouTube demo link into rice cards

- [ ] Switch rices across the whole PC flow (GRUB, rEFInd, login screen)
- [ ] Support other popular window managers (rices, configs, plugins)
- [ ] Convert/map rices between window managers (equivalent-parameter system module) and convert install/apply packages between distributions
- [ ] Backward compatibility module for legacy rices
- [ ] UI improvements: drag and drop, tag filters, pagination for Network items
- [ ] Experimental: switch by current work mode, or by context of the focused window
- [ ] AI generation of environments/rices (prompt and context based)


> [!NOTE]
> Code is fully open source since v1.1. Suggestions and issue reports are welcome

## Tested on ✅

- Hyprland + Arch
