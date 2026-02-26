<div align="center">
  <img width="50%" height="320" alt="image" src="https://github.com/user-attachments/assets/6e8706dc-2cba-4f34-a753-fb22cc662d82" />
</div>

<div align="center">
  <img src="https://img.shields.io/badge/FEBRUARY-2026-02?style=for-the-badge" />
  <img src="https://img.shields.io/github/stars/llayerlinux/llayer?style=for-the-badge&color=303030" />
  <img src="https://img.shields.io/badge/Linux-%23171717?style=for-the-badge&logo=linux&logoColor=white" />
  <img src="https://img.shields.io/badge/Arch-%23007ACC?style=for-the-badge&logo=arch-linux&logoColor=white" />
  <a href="https://discord.gg/vHkKA6jFhh"><img src="https://img.shields.io/discord/1459510161512333519?style=for-the-badge&logo=discord&logoColor=white&label=Discord&color=5865F2" /></a>
  <br>
  <a href="https://ko-fi.com/llayer"><img src="https://img.shields.io/badge/Support%20me%20on-Ko--fi-%23FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" /></a>
</div>


# <img width="64" height="120" alt="icon" src="https://github.com/user-attachments/assets/27330896-e1fd-47d2-83cb-463c46a73475" /> lastlayer (llayer)

**A dynamic interface layer - a new abstraction above the desktop environment that lets you control the environment at multiple levels and transform it instantly.**

<p align="center">
  <img width="1594" height="1383" alt="image" src="https://github.com/user-attachments/assets/a8cf79e7-ad19-4686-8b66-7a5f7b8bf223" />
</p>

<details>
<summary><b>Quick navigation</b></summary>

- [Update 1.1](#update-11)
- [Installation](#installation)
- [Starter adapted rices (offline)](#starter-adapted-rices-offline)
- [Features](#features)
- [System flow](#system-flow)
- [Rice standard](#rice-standard)
- [Adapting an existing rice / creating a new one](#adapting-an-existing-rice--creating-a-new-one)
- [Flexible Dependency Isolation System](#flexible-dependency-isolation-system)
- [Advanced Configuration Parameter Management System](#advanced-configuration-parameter-management-system)
- [Advanced Hotkey Configuration Management System](#advanced-hotkey-configuration-management-system)
- [Process Level. Widgets](#process-level-widgets)
- [Roadmap](#roadmap)
- [Tested on](#tested-on)

</details>

<a id="update-11"></a>
## Update 1.1

1. The full source code has been opened.
2. Countries/rices analytics have been removed.
3. Added functionality to display and optionally send average install/apply speed metrics per theme (sending is disabled by default).
4. Added the ability to fill in and view extra rice metadata: a Reddit post (with parsing of general data) and a YouTube link.
5. Updated the rice (theme) card: implemented two display modes with a toggle switch: local theme and online theme.
6. Added a settings menu to manage bar lists, enabling support for rarer and not-yet-included customizable bars and other widgets inside rices.
7. Updated the restore point (save/restore) functionality.
8. Improved the rice apply/install algorithm; both operations are now 30% faster under the same testing conditions.
9. Improved the plugin system: added the ability to fix issues with the external hyprpm dependency inside the program, and to view internal terminal logs for other plugin operations.
10. Prepared a broader architectural base for integrating rices of other levels (rEFInd, GRUB, SDDM, etc.) and for supporting other window compositors.

<a id="installation"></a>
## Installation 📦

```bash
git clone https://github.com/llayerlinux/llayer.git lastlayer
cd lastlayer
./install.sh
```

> [!NOTE]
> All required dependencies are installed automatically by `install.sh`: **swww**, **yad**, **webkit2gtk**.

## Starter adapted demo-rices (offline)

If the server is temporarily unavailable:

1. Download and extract the archive:
   https://drive.google.com/file/d/1PiXFYCzl5wRDr8SQUB8qu3i93fifvZur/view?usp=sharing
2. Click **+** on the bottom button bar for local import
3. Navigate to the rice directory in your file manager and open it


The provided list of rices (sets of dotfiles) is a demonstrational example of the correct and expected rice structure and is not part of the program. Each presented example has its own authors, who are specified in the rice metadata files (as well as in the rice properties within the program), along with the authors' original source repositories and links to Reddit posts and YouTube demonstrations.

<a id="features"></a>
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

<a id="system-flow"></a>
## Documentation

- [1. System Flow](#system-flow)
- [2. Rice standard](#rice-standard)
  - [Rice card (current)](#rice-card-current)
  - [Notes and specifics](#notes-and-specifics)
- [3. Adapting an existing rice / creating a new one](#adapting-an-existing-rice--creating-a-new-one)
- [4. Save points](#save-points)
- [5. Flexible Dependency Isolation System](#flexible-dependency-isolation-system)
- [6. Advanced Configuration Parameter Management System](#advanced-configuration-parameter-management-system)
  - [6.1 Global parameters and automatic system detection](#51-global-parameters-and-automatic-system-detection)
  - [6.2 Deprecated/future parameters, and automatic conversion](#52-deprecatedfuture-parameters-and-automatic-conversion)
  - [6.3 Per-rice overrides and priority order](#53-per-rice-overrides-and-priority-order)
  - [6.4 Unsupported parameters inside a rice and dynamic priority rules](#54-unsupported-parameters-inside-a-rice-and-dynamic-priority-rules)
  - [6.5 Community recommendation - parameters (global  per-rice)](#55-community-recommendation---parameters-global--per-rice)
- [7. Advanced Hotkey Configuration Management System](#advanced-hotkey-configuration-management-system)
- [8. Process Level. Widgets](#process-level-widgets)

- [Reverse Immersion](reverse-immersion.md)
- [FAQ](FAQ.md)


## 1. System Flow. Last Layer

<img height="700" alt="lastlayer-architecture-color" src="https://github.com/user-attachments/assets/d49f6ed7-13fb-4372-a967-ddef33bf7ffa" />

<a id="rice-standard"></a>
## 2. Rice standard 🎨

<table>
  <tr>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/35e63df9-981f-4748-abe1-1e3f98dda7d0" width="200">
    </td>
    <td align="center">
      <img src="https://github.com/user-attachments/assets/a9feb54e-7a3f-4f9f-90c7-2f66886bccb9" width="200">
    </td>
    <td align="center" valign="middle">
      <img src="https://github.com/user-attachments/assets/dd231164-f0c9-438e-b805-9fff8acfee8c" width="300"><br/>
      <img src="https://github.com/user-attachments/assets/04885899-f7f7-450d-ade2-799f0e8c5346" width="187">
    </td>
  </tr>
</table>

<table>
  <tr>
    <td align="center">
      <img height="700" alt="image" src="https://github.com/user-attachments/assets/7afbc238-3081-4f16-b260-e0cc29b94656" />
    </td>
    <td align="center">
      <img height="300" alt="image" src="https://github.com/user-attachments/assets/a940d476-2637-4776-8db4-944f05c51707" />
    </td>
  </tr>
</table>

### Rice card (current)

The rice card is one of the core pop-ups and will expand in future versions.

A rice card can include (optional):
- **Preview** (512x512 or 1024x1024)
- **Configuration repository link** (Git URL)
- **Author** (avatar is parsed automatically from Git)
- **Adaptation author** (optional)
- **Reddit thread** (optional; includes parsed stats like upvotes/comments)
- **YouTube demo link** (optional)
- **Publication status** (optional; e.g., Published for server-uploaded rices)
- **Tags** (optional)
- **Reconstruction script available** flag + **Apply & Run** action (optional)
- **Properties** flags/badges (optional)

Always present in the card:
- **Includes / structure breakdown** (WM / bar / apps / launcher / extras, 2D/3D view) *(generated automatically)*
- **Average apply time** *(measured automatically)*
- **Average install time** *(measured automatically)*
- **Downloads count** *(tracked automatically)*

Additional sections (optional):
- **Support hint** (e.g., package manager / distro note) *(generated automatically when possible)*
- **More from the same author**- a list of other rices by this author, shown as compact preview cards with a mini structure indicator (shown when available)

### Notes and specifics

- **Average install time** and **average apply time** are aggregated automatically from users who explicitly agree to send these metrics via a checkbox in Settings (**disabled by default**). **Total downloads** are based on server-side data.

- **Reddit data** is generated from a user-provided Reddit link via the **Reddit API**. The **video icon** is detected from the provided YouTube link. The **preview** is generated automatically from the configuration repository link.

- **Reconstruction script** is optional. Its purpose is to restore a dedicated workspace into the exact state shown in the publication post, so the user can immediately confirm that the rice was installed correctly and visually matches the intended result.

- **Rice structure** is generated automatically in two modes: **2D / 3D** (the same logic is used in the "More from this author" list). The structure describes-within the current classification-the rice’s degree of impact on the system (e.g., its own GTK, etc.) and the presence of components per category. This classification is conditional and will expand as new types of rices appear in the system. The classification is not only informational but also practical: for example, a rice from the browser can be applied only for **L3/L4** (in some cases); otherwise the Apply button is disabled due to the impracticality of a long install/apply flow in a browser and for security reasons for rices that include many components and heavily affect the system.

<table>
  <tr>
    <td valign="top">
      <ul>
        <li>
          Optionally, the rice author can influence the <b>installation terminal</b> theme by providing a custom style. This styled terminal is shown on the right side of the application window <b>during installation</b>.
        </li>
      </ul>
    </td>
    <td align="right" valign="top">
      <img width="603" height="505" alt="image" src="https://github.com/user-attachments/assets/e28b662c-d6a3-45ef-8bf6-f56485634738" />
    </td>
  </tr>
</table>

<a id="adapting-an-existing-rice--creating-a-new-one"></a>
## 3. Adapting an existing rice / creating a new one 🎨

In the first versions, the program temporarily requires a predictable rice structure.

#### Minimal acceptable structure (Hyprland)

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

#### File meanings

- `preview.png` - image shown to the user in the rice list
- `wallpaper.png` - default desktop wallpaper
- `hyprland.conf` - references to Hyprland config files (direct parameters without links are also possible). Files related to this configuration must be placed in `hyprland/`.
- `lastlayer.conf` - lastlayer configuration that keeps switching consistent, hides auxiliary terminals during switching, and sets required visibility attributes for the program window.

#### start-scripts/

- `install_theme_apps.sh` (optional)
  Installs accompanying applications. Runs only on the first installation of a rice.
- `set_after_install_actions.sh`
  Launches accompanying applications. Runs every time a rice is applied.

#### config/ (optional)

Directory with configuration files of accompanying applications.

<details>
<summary><b>Notes about compatibility and scripts (current approach)</b></summary>

- For now, lastlayer expects a predictable rice structure. In future versions you will be able to import legacy rices without restructuring them (rices that already follow this layout will stay backward compatible).
- Rice scripts install and launch accompanying applications to keep all actions transparent and easy to review.
- lastlayer detects potentially dangerous commands and will not run them without explicit user consent.

</details>


## 4. Save points
<p align="center">
  <kbd><img width="350" alt="image" src="https://github.com/user-attachments/assets/a33d8b24-d59d-45b4-bdcf-da27214436c4" /></kbd>&nbsp;&nbsp;
  <kbd><img width="350" alt="image" src="https://github.com/user-attachments/assets/4bf621d5-c372-417e-815f-fe0e5cdc5e45" /></kbd>
</p>

Often, the user needs to apply their own changes on top of an applied rice (a set of configuration parameters across L0–L6). These changes may affect different tiling window manager parameters, for example graphics settings, exec directives, and hotkeys. To manipulate, save, and override such parameters, the app provides dedicated per-rice config parameters and global config parameters (sections 6 and 7 of the current documentation). However, sometimes changes made on top of an applied rice go beyond the usual parameters and may include anything, and the number of iterations of such changes can be large. The app supports saving all intermediate change states and returning to them at any time from any other applied rice or from the current state. 

What should be saved from the current state is defined by the user. By default, a save point includes configuration folders of popular programs within the L0–L6 customization layer. In addition to predefining the list of configuration file folders that the saved state should include, the save point can also be extended or adjusted by modifying its file set after it has been created.
</p>



## 5. Flexible Dependency Isolation System

<p align="center">
  <kbd><img width="400" alt="image" src="https://github.com/user-attachments/assets/283b1409-2f3f-4d73-ab58-a7c967c13a31" /></kbd>
</p>

Dependency isolation is implemented via **prefixes**.

It works by **patching** (rebuilding from scratch during import/unification) the installation script according to the selected prefix layout, and also patching the rice apply script. These are part of our rice structure standard:

- `install_theme_apps.sh`
- `set_after_install_actions.sh`

As a result, both **installation** and **launching** (a single app or a group of apps) happen **from prefixes**.

There are **three dependency isolation modes**, each with its own prefix hierarchy and trade-offs:

- **Per-rice prefix isolation**
- **Per-program prefix isolation**
- **Hybrid mode (experimental compromise)**

---

<p align="center">
  <kbd><img width="400" alt="image" src="https://github.com/user-attachments/assets/f23b1383-4f72-44d1-b7e7-c57d45fb64d6" /></kbd>&nbsp;&nbsp;
  <kbd><img width="400" alt="image" src="https://github.com/user-attachments/assets/192368ba-0195-4d66-ae71-92aeef79ca27" /></kbd>
</p>

#### 1) Per-rice prefix isolation
Even **identical versions** of the same programs are fully separated between different rices. This avoids conflicts and "surprising" config behavior for the same version.

**Cost:** higher disk usage - more duplicates across rices.

#### 2) Per-program prefix isolation
Duplicates of the **same program version** are avoided. The structure recognizes matching versions and allows rices to **reuse programs from other rices** if the version matches.

**Pros:** saves disk space, eliminates duplicates.
**Weak point:** cases where "same version" is not truly identical in practice, for example:
- the upstream developer didn’t reflect small changes in versioning
- users modified/customized the program for a specific rice

#### 3) Hybrid mode (experimental)
Designed to make isolation customizable and will be actively improved after **v2** to combine benefits and reduce drawbacks.

Right now (**v1.1**), it is essentially **per-program isolation**, but using a dedicated prefix hierarchy one level higher: **`shared`**.

---

<p align="center">
  <kbd><img width="350" alt="image" src="https://github.com/user-attachments/assets/ac9ed6ae-5996-4236-8b81-dafcd554c0b0" /></kbd>
</p>

You can select the dependency isolation mode not only **globally** for all rices, but also **per individual rice**.

This lets you compensate for edge cases. For example:
- if several rices use the "same version" of a program but the implementations/config compatibility differ, enable **per-rice** only for those rices
- for other rices, use **per-program** where you trust that implementations are identical and not user-customized, and versioning is reliable

If a user has enough disk space and doesn’t want to deal with the nuances, **per-rice** is always a safe default.



## 6. Advanced Configuration Parameter Management System

The configuration set of each window manager is split into multiple parameter groups. The goal is that when a user applies a new rice, they can keep the controls they are already used to-such as screen resolution, keyboard layouts, and other environment-related settings-while all other parameters remain exactly as provided by the rice, creating a new experience.

At the same time, the user must be able to choose *which* familiar parameters and values should override the rice defaults, and at any moment selectively revert any overridden parameter back to the original rice-defined value.

To achieve this, a dedicated settings group is implemented for defining **"global" parameters**-those that will be automatically overridden in every rice when it is applied.

---


<p align="center">
  <kbd><img width="400" alt="image" src="https://github.com/user-attachments/assets/e69be7c9-ffd4-486d-b524-a8a17dd13da0" /></kbd>
</p>

<a id="51-global-parameters-and-automatic-system-detection"></a>
### 6.1 Global parameters and automatic system detection

You can automatically detect system environment parameters and mark them as global:

- display identifier
- screen resolution
- keyboard layout
- layout switch hotkey

For any other parameter you want to make global, you can simply enter a custom value manually.

An override is indicated by a **blue** parameter row and a **cross button** below it, which resets the parameter back to "defined by the rice".

You can also apply the parameters to the current rice immediately and verify the effect of each change **in real time**.

---

<p align="center">
  <kbd><img width="400" alt="image" src="https://github.com/user-attachments/assets/940bf74d-b7ac-471a-8695-e55e10b194ca" /></kbd>
</p>

<a id="52-deprecatedfuture-parameters-and-automatic-conversion"></a>
### 6.2 Deprecated/future parameters, and automatic conversion

As different rices are applied, the system detects parameters inside a rice that are **unsupported** for the currently installed window manager version-both **deprecated** and **future** parameters.

Such parameters are automatically disabled and accumulated into the global settings, where you can:

- enable/disable **deprecated** parameters (**red**)
- enable/disable **future** parameters (**purple**)
- see in which window manager versions a parameter was still supported, and from which versions it will start being supported

This helps the user understand mismatches-for example, differences between an author’s screencast and the real applied result-and makes it possible to immediately re-enable a previously unsupported parameter after switching to a different window manager version.

There is also a group of **equivalent, convertible parameters** that will be automatically converted to the correct parameter name for the current version. This prevents losing parts of the rice configuration and results in a more accurate application.

---

<p align="center">
  <kbd><img width="400" alt="image" src="https://github.com/user-attachments/assets/4f109d28-03c6-4fbd-b37e-b9ef06af1d61" /></kbd>
</p>

<a id="53-per-rice-overrides-and-priority-order"></a>
### 6.3 Per-rice overrides and priority order

Sometimes, global overrides should not apply to every rice. For example, some non-trivial rices rely on resolution and scale as an important part of their authenticity. In such cases, you may want to keep the global resolution override for most rices, but not for specific ones.

To support this, a **third group** of values is introduced: **per-rice overrides**, configured only for selected rices.

A rice can still selectively use some global parameters at the same time. For this purpose, each rice has a strict parameter priority order:

1. **Per-rice parameters** (**green**)
2. **Global parameters** (**blue**)
3. **Original rice parameters** (**gray**)

Per-rice parameters always override global parameters, and global parameters override the original rice parameters. This means all three groups can be defined simultaneously within a single rice through the rice settings.

In global settings, you can always see **Exceptions**-the list of rices where a given global parameter will *not* be overridden, because a per-rice override already exists.

Within the rice parameter tabs, you can:

- reset (left arrow) a per-rice or global parameter back to the rice original value
- for overridden parameters, view the initial rice value in the **"Original"** column
- promote a per-rice parameter (**green**) into a global parameter (useful when editing one rice and deciding this should apply to all)
- use **Reset All** to reset all parameters back to the rice originals
- use **Set as System Default** to take automatically detected system parameters (resolution, layout, etc.) and set them as per-rice parameters, bypassing global parameter changes-providing additional flexibility in specific cases

---

<p align="center">
  <kbd><img width="400" alt="image" src="https://github.com/user-attachments/assets/47eac16d-3c32-44f8-873a-b62ff5619c9c" /></kbd>
</p>

<a id="54-unsupported-parameters-inside-a-rice-and-dynamic-priority-rules"></a>
### 6.4 Unsupported parameters inside a rice and dynamic priority rules

In the rice settings parameter tabs, you can also see which parameters were automatically disabled during rice import due to a mismatch with the current window manager version. These parameters are automatically added to the previously described global list of unsupported parameters.

They can be handled per rice by:

- overriding them to an equivalent parameter (as the user considers appropriate)
- enabling their default values

The priority behavior for unsupported (deprecated/future) parameters is **dynamic**:

- If you modify them in a rice’s settings, they become higher priority than global parameters, consistent with the general "per-rice overrides win" logic.
- However, this remains true only until the same parameters are changed globally-after that, the global values will override the per-rice ones. This differs from supported parameters, where per-rice overrides always remain preserved (via the auto-generated **Exceptions** list).

This behavior is intentional: the number of real-world cases where, for example, a user updates the window manager and decides to make a previously "future" parameter active for **all** rices is considered more important than preserving unsupported-parameter states for individual rices when global settings change.

This section also lists parameters that are unsupported but are **automatically converted by the application** into supported equivalents.

### 6.5 Community recommendation - parameters (global | per-rice)

<p align="center">
  <kbd><img height="300" alt="image" src="https://github.com/user-attachments/assets/6bee417a-f804-4768-82c4-99c74e5d7a4e" /></kbd>&nbsp;&nbsp;
  <kbd><img height="300" alt="image" src="https://github.com/user-attachments/assets/ee667f39-f3d8-4a10-a428-cfedf427dff4" /></kbd>
</p>

Within both **global parameters** and **per-rice parameters**, there will be a **community recommendations** group (hooks, tips, "lifehacks") that can be applied at different levels and immediately tested within a specific rice or across all rices. A recommendation can include any kind of parameters-from graphical options and `exec` entries to hotkeys-and can also include a **GIF** showing how it works in practice (displayed on the right, on the same row where the recommendation is enabled).

A key capability is the **parent–child parameter** relationship. Some effects require multiple parameters at once and must be triggered by a hotkey: in this case, the hotkey combination is defined as the **parent** parameter, while all parameters required for the effect are defined as **children**, so another user can apply (and revert) the whole bundle with a single click. Single, standalone recommendations are also supported when only one independent parameter is needed.

Initially, as an example, I will publish my own optional recommendation set related to **semi-tiling states**: on selected workspaces you can move windows, resize them, make them floating, while preserving relative tiling. These may look contradictory to strict tiling philosophy, but I believe philosophy should not exist for its own sake-there should be intermediate options and flexibility without requiring separate tools; I may be wrong, so this set is **disabled by default** and added as a regular user, not as a developer default. The override logic matches the existing supported-parameter model: recommendations can be overridden per rice or globally while preserving per-rice exceptions.

## 7. Advanced Hotkey Configuration Management System

<p align="center">
  <kbd><img height="300" alt="image" src="https://github.com/user-attachments/assets/bd3c0e33-951a-459e-9a0c-b3488ca89951" /></kbd>&nbsp;&nbsp;
  <kbd><img height="300" alt="image" src="https://github.com/user-attachments/assets/07f610f8-ce3a-46bf-82ef-a89f6b5ce88c" /></kbd>
</p>

Hotkeys are the same part of window manager configurations as graphical and other parameters, but there are separate user-specific cases related to hotkeys, and they are handled individually by this functionality. Just like in the parameter system described above, there will be **global hotkeys** that work across any imported rices, carefully overriding the existing ones inside them; and at the rice level you will also be able to define **per-rice hotkey combinations** that override the global ones. The priority will therefore be:

1) Hotkeys defined above the rice (**green**)
2) Global hotkeys defined in settings (**blue**)
3) Original rice hotkeys

It is always possible to individually bring the first two categories back to the third one, restoring the original rice hotkeys (`->`). A separate priority system is needed because rices can have different applications and scripts; so in addition to keeping familiar control through global parameters, we must preserve rice-specific hotkeys. There is also the ability, without entering global settings, to delegate responsibility for the current combination to global settings (**G**), which will define the command. There will also be the reverse ability (**DIG**): when a user wants to define the current rice hotkey combination (together with its specific command) globally for all rices (naturally, the user must ensure in advance that this command can be executed in all rices; in future versions there will be a mechanism that detects this automatically).

<p align="center">
  <kbd><img width="350" alt="image" src="https://github.com/user-attachments/assets/338b461e-09cc-49ec-8ad5-be0dbb00d486" /></kbd>
</p>

When viewing hotkeys in the rice settings, you can immediately see keys or key combinations that:

1) Have duplicates where both the combination and the command are identical- **red** frame
2) Have duplicates where the combination is the same but the commands are different (multiple responsibility)- **red** frame
3) Have a combination that contains a subset of keys belonging to another combination- **yellow** frame
4) Are responsible for launching different menus, widgets, etc. inside a rice (users often want to find these first)- **green** frame

<p align="center">
  <kbd><img width="350" alt="image" src="https://github.com/user-attachments/assets/19cef002-a5e6-4a9b-a464-79f5f93416cb" /></kbd>
</p>

For each problematic group (1–3), a dedicated window will be available where you can delete the entire problematic combination or rewrite it. The important widget/menu commands in (4) will be recognized based on a built-in list integrated into the program, which will expand over time.

<a id="process-level-widgets"></a>
## 8. Process Level. Widgets

<p align="center">
  <kbd><img src="https://github.com/user-attachments/assets/c0aa6021-315b-4a05-b9c9-feb9300d18af" height="350" alt="image" /></kbd>&nbsp;&nbsp;
  <kbd><img src="https://github.com/user-attachments/assets/1132fd98-8bff-4ff5-be51-f1de5a86e7db" height="350" alt="image" /></kbd>
</p>

<p align="center">
  <kbd><img src="https://github.com/user-attachments/assets/50a118cf-c147-4f8b-841e-046a82fc07fc" height="320" alt="image" /></kbd>&nbsp;&nbsp;
  <kbd><img src="https://github.com/user-attachments/assets/79150d6e-4686-4343-bb0c-51da357f516f" height="320" alt="image" /></kbd>
</p>

Management of processes in the application is rice-level only: the available tools for monitoring processes and daemons relate only to the current rice and to system processes that can indirectly affect it. Other unrelated third-party processes are not taken into account.

The application affects processes only when applying a rice (starting the associated widgets) and when switching rices (stopping the widgets of the current rice and starting the widgets of the next rice), plus user-initiated scripts such as "hyprland fix" in the More section, and actions available in the running rice process/service manager under the Quick actions tab. To start and stop widgets correctly, there is a dedicated widget list integrated into the program, with the ability for the user to customize and extend it. This list contains the program name and the start and stop commands. Some widgets require specific start and stop commands and do not always provide fallback defaults, which may require passing a configuration path as a parameter. The list is local for now; later, the default list will be moved to the server side so users can expand it, while the current local list will remain as a fallback.

The list of running rice-associated processes also includes the dependency isolation popup, but it focuses on the process path, the prefix, and the dependency isolation mode under which the process is running.


<a id="roadmap"></a>
## Roadmap 🔮
- [x] Open-source the post-prototype codebase
- [x] Add Reddit score parsing and a YouTube demo link to rice cards
- [x] Extend the dependency isolation system
- [x] Build an advanced parameter management system
- [x] Unify imported rices during import (normalization)
- [x] Enable "fly-apply" (apply a rice directly from the browser)
- [x] Implement reverse immersion
- [x] Provide backward compatibility for legacy rices
- [x] Implement an advanced hotkey management system (a three-level model, analogous to the parameter system)
- [ ] Support other popular window managers (rices, configs, plugins) (partially implemented)

- [ ] Test and publish parts of the currently unpublished functionality
- [ ] Separate out features that require iterative development into a dedicated track

- [ ] Switch rices across the full PC stack (+L7-L8) (GRUB, rEFInd, login screen)

> [!NOTE]
> Code is fully open source since v1.1. Suggestions and issue reports are welcome

<a id="tested-on"></a>
## Tested on ✅

- Hyprland + Arch
