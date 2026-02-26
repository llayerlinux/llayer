# LastLayer FAQ

## Table of contents

- [1. What is LastLayer? What is a separate abstraction layer, and what is its purpose?](#1-what-is-lastlayer-what-is-a-separate-abstraction-layer-and-what-is-its-purpose)
- [2. Which graphical environments are planned to be supported?](#2-which-graphical-environments-are-planned-to-be-supported)
- [3. Unification of rices (sets of dotfiles) - what does it imply, and how is it planned to implement and maintain it?](#3-unification-of-rices-sets-of-dotfiles---what-does-it-imply-and-how-is-it-planned-to-implement-and-maintain-it)
- [4. What is reverse immersion? What is its point?](#4-what-is-reverse-immersion-what-is-its-point)
- [5. In the code you can encounter "themes" and "rices" in the same context. Terminology issues?](#5-in-the-code-you-can-encounter-themes-and-rices-in-the-same-context-terminology-issues)

---

## 1. What is LastLayer? What is a separate abstraction layer, and what is its purpose?

LastLayer is a program that works with a separate customization layer at the level of files and processes within a specific area of responsibility. A separate abstraction layer in this case implies generalization through an external customizable representation in a unified structure with optional levels. In practice, this is one way to organize program and configuration files, as well as processes (when dependency isolation mode is enabled), that solves specific problems:

- The lack of a single way to apply a customized representation (rices, sets of dotfiles, other configuration sets)
- The time costs of switching customized representations (as a consequence of the above)
- Disruption of overall system operation due to incompatible parameters in loaded configurations (hardcoded monitor parameters, paths, deprecated parameters)
- Loss of operability of programs and components when replacing them from an external rice (programs with versions without backward compatibility with old configurations, programs that pull dependencies, new versions of which affect the stability of other programs, and other cases)
- "Disorientation" of control - new mouse, swipe, hotkeys parameters from other rices, the probability that they differ from the current ones is high and each time requires configuration
- "Overlaying" rices, progressive inconsistency - if a set of configuration files is installed after another one with a different structure of programs and configurations, a heterogeneous set of configurations of various programs is formed with a corresponding inconsistent representation

## 2. Which graphical environments are planned to be supported?

It is planned to support exclusively tiling window managers, which are a kind of ideal "canvases". Other graphical environments have more limitations and already contain tools and predictable sets of customizations in their ecosystem. Among tiling window managers (window compositors), it is planned to support Hyprland, Sway, i3, bspwm. Replenishing this list is also not ruled out.

## 3. Unification of rices (sets of dotfiles) - what does it imply, and how is it planned to implement and maintain it?

By unification of rices is meant an additional ability to integrate a set of configuration files of any structure and composition with the ability to apply it immediately without additional configuration. Basically, users will be able to import and apply rices with a specifically defined structure, which is recommended for those who create and adapt sets of config files. Unification will be an additional optional feature, which at the moment is already implemented in experimental mode.

For this to work correctly and be maintained, it is required to solve many problems related to the lack of backward compatibility with configurations of older versions of a whole range of programs, as well as problems related to hardcoding of paths and critical parameters that can be found in rices; there are also whole other classes of problems that can only be identified experimentally - unexpected conflicts of programs and individual components, unpredictable behavior of individual program parameters and configurations under different conditions. The task is labor-intensive and iterative, and this functionality will be released in its own separate versions, which will contain databases of solutions for different classes of problems, which will be applied during import via automatic file patching. Each new version will support more different variations of rices - both in structure and in components; this will also be checked by mandatory regression tests for previously supported rices.

## 4. What is reverse immersion? What is its point?

In the context of direct (ordinary) immersion, people often mean adaptation/overriding of the attributes of internal components to the attributes of external components. Website themes (dark, light) adapt to the browser theme, just as application themes can adapt to the theme of the environment or the OS. With reverse immersivity, the opposite happens - the environment and the system around adapt to the application/game on which the user's focus is fixed. I described the practical meaning of such a mode and the mechanism of operation separately [here](https://github.com/llayerlinux/llayer/blob/main/reverse-immersion.md). The functionality is also additional and experimental, containing separate versioning of iterations.

## 5. In the code you can encounter "themes" and "rices" in the same context. Terminology issues?

Initially, it was decided to call a set of configuration files, whose emphasis is on changing external representations, themes, even though this is not entirely correct from the standpoint of the responsibilities of internal structures. "Rices", as well as "dotfiles", are familiar and understandable terms within the relevant communities, but not for all users, so initially only "themes" were used in the names of classes and variables. However, as more and more rices were tested, a trend became noticeable that within new rices they increasingly use alternative configurations in different variations, sometimes in generated wallpaper color schemes, sometimes more interesting variants unrelated to auto-generation of color schemes. Therefore, functionality was planned for an alternative way of applying a rice through immediately choosing the required alternative configuration from the available ones. Such configurations need a name that will definitely be a "theme", which is correct in every sense, therefore in the new implemented functionality, sets of config files that contain themes inside them began to be called rices, and the previously named classes and variables associated with rices will also gradually be renamed from themes to rices.
