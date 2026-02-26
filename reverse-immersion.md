# Reverse Immersion

  <img src="https://github.com/user-attachments/assets/c4cfa89b-d0bb-436b-ac77-94a30c7456a4" alt="Reverse Immersion example (game)" width="48%"/>
  <img src="https://github.com/user-attachments/assets/2ad3b0a2-7587-4410-9bff-de87cb9c3590" alt="Reverse Immersion example (reading / coding)" width="49%"/>


</p>

In mobile, desktop, and web UI, we already rely on regular (forward) Immersion, where internal components of a system adapt to external context. For example, a website theme (light/dark) can follow the browser theme, and the browser theme (or any other application) can follow the desktop environment theme.

In upcoming standalone releases, an experimental feature will introduce the reverse mechanism: the content inside an application window or a game will drive the surrounding system - both visually (desktop environment) and through other parameters. For instance, when opening a book reader, the entire surrounding presentation (bars, widgets, animation parameters, mouse glide/feel, and potentially deeper system settings) can be adapted to that mode.

<p align="center">
  <img src="https://github.com/user-attachments/assets/543661d9-c7ad-4dc2-9065-1ce4495968b7" alt="Reverse Immersion scope across rice levels" width="50%"/>
</p>

The trigger for external system reactions is not limited to application launch. Any internal events inside the window can produce triggers - for example, a level change inside a game, or a mode switch inside a program (moving into another major section, etc.).

## Basic Operation (Pipeline)

<p align="center">
  <img  src="https://github.com/user-attachments/assets/5167bcaf-9bcd-4793-a473-90505e9fa5d8" alt="Reverse Immersion pipeline" width="50%"/>
</p>

## Practical Purpose

The practical purpose of reverse Immersion is to make interacting with a PC feel less like working with a large set of visible shortcuts and nested hierarchies, and more like a set of **automatically switching modes**. Each mode provides widgets with tools that are typical for that specific task/workflow type, and delivers a fitting visual experience down to small details.

The key difference from simply running the "right program in fullscreen" is that:
1) not every program can provide the intended effect on its own, and  
2) for each mode you can build dedicated supporting tools - and those tools may have different layouts and behaviors across different programs.

Beyond the practical aspect, this also creates an atmospheric visual effect that supports the selected interaction/work mode. For windowed games, it can provide an additional layer of immersion (assuming the relevant presentation file sets exist).

## Another Applied Task: The Latest Stage of Interface Evolution

Another applied problem that can be addressed through reverse Immersion is related to the latest stage in the evolution of interfaces:

**CLI (Command Line Interface) → GUI (Graphical User Interface) → IUI (CUI) (Intent–Conversational) User Interface / VUI (Voice User Interface)**

For interfaces where the input is the user’s intent (a prompt), the output today is typically only the final result of a stage. However, intermediate stages - and the process itself - could be controlled via an additional graphical UI that is formed dynamically based on the task, and accompanies the IUI (CUI).

Such a graphical UI could also be achieved using reverse Immersion, but with the focus shifted from "screen content" to **intent**.

<p align="center">
  <img src="https://github.com/user-attachments/assets/4db4c149-e74d-4939-b74d-7200c5e45ee7" alt="Intent-driven reverse Immersion: dynamic GUI accompaniment" width="60%"/>
</p>

