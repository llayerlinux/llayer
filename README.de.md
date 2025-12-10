<div align="center">
  <img width="50%" height="320" alt="image" src="https://github.com/user-attachments/assets/6e8706dc-2cba-4f34-a753-fb22cc662d82" />
</div>

<div align="center">
  <img src="https://img.shields.io/github/last-commit/Litesav-L/lastlayer?style=for-the-badge&color=303030" />
  <img src="https://img.shields.io/badge/DECEMBER-2025-12?style=for-the-badge" />
  <img src="https://img.shields.io/github/repo-size/Litesav-L/lastlayer?style=for-the-badge&cacheSeconds=30" />
  <img src="https://img.shields.io/badge/Linux-%23171717?style=for-the-badge&logo=linux&logoColor=white" />
  <img src="https://img.shields.io/badge/Arch-%23007ACC?style=for-the-badge&logo=arch-linux&logoColor=white" />
  <img src="https://img.shields.io/badge/Hyprland-%239566f2?style=for-the-badge&logoColor=white" />
</div>

# <img width="64" height="120" alt="icon" src="https://github.com/user-attachments/assets/27330896-e1fd-47d2-83cb-463c46a73475" /> lastlayer (llayer)

**Eine dynamische Interface-Schicht – eine neue Abstraktion oberhalb der Desktop-Umgebung, mit der du die Umgebung auf mehreren Ebenen steuern und sie sofort transformieren kannst.**

<p align="center">
  <img width="1594" height="1383" alt="image" src="https://github.com/user-attachments/assets/a8cf79e7-ad19-4686-8b66-7a5f7b8bf223" />
</p>

<details>
<summary><b>Contents</b></summary>

- [Update 1.1](#update-11)
- [Installation](#installation-)
- [Starter-angepasste Rices (offline)](#starter-angepasste-rices-offline)
- [Funktionen](#funktionen-)
- [Rice-Standard](#rice-standard-)
- [Ein vorhandenes Rice anpassen](#ein-vorhandenes-rice-anpassen--ein-neues-erstellen-)
- [Roadmap](#roadmap-)
- [Getestet auf](#getestet-auf-)
</details>

## Update 1.1

1. Der vollständige Quellcode wurde geöffnet (wie zuvor geplant).
2. Länder-/Rices-Analytik wurde entfernt.
3. Funktionalität hinzugefügt, um durchschnittliche Install-/Apply-Geschwindigkeitsmetriken pro Theme anzuzeigen und optional zu senden (Senden ist standardmäßig deaktiviert).
4. Möglichkeit hinzugefügt, zusätzliche Rice-Metadaten auszufüllen und anzusehen: ein Reddit-Post (mit Parsing allgemeiner Daten) und ein YouTube-Link.
5. Die Rice-(Theme-)Karte aktualisiert: zwei Anzeigemodi mit Umschalter implementiert: lokales Theme und Online-Theme.
6. Ein Einstellungsmenü hinzugefügt, um Leistenlisten zu verwalten – unterstützt seltenere und noch nicht enthaltene anpassbare Bars und andere Widgets innerhalb von Rices.
7. Die Restore-Point-(Speichern/Wiederherstellen-)Funktionalität aktualisiert.
8. Den Rice-Apply-/Install-Algorithmus verbessert; beide Vorgänge sind unter denselben Testbedingungen jetzt 30% schneller.
9. Das Plugin-System verbessert: Möglichkeit hinzugefügt, Probleme mit der externen hyprpm-Abhängigkeit innerhalb des Programms zu beheben, sowie interne Terminal-Logs für andere Plugin-Operationen einzusehen.
10. Eine breitere architektonische Grundlage für die Integration von Rices anderer Ebenen (rEFInd, GRUB, SDDM usw.) und für die Unterstützung anderer Window-Compositoren vorbereitet.

## Installation 📦

```bash
git clone https://github.com/llayerlinux/lastlayer.git
cd lastlayer
./install.sh
```

> [!NOTE]
> Alle erforderlichen Abhängigkeiten werden automatisch durch `install.sh` installiert: **swww**, **yad**, **webkit2gtk**.

## Starter-angepasste Rices (offline)

Falls der Server vorübergehend nicht erreichbar ist:

1. Lade das Archiv herunter und entpacke es:  
   https://drive.google.com/file/d/1PiXFYCzl5wRDr8SQUB8qu3i93fifvZur/view?usp=sharing
2. Klicke **+** in der unteren Button-Leiste für den lokalen Import
3. Navigiere im Dateimanager zum Rice-Verzeichnis und öffne es

## Funktionen 💡

### Rice-Verwaltung

- **Ein-Klick-Rice-Wechsel.** Die durchschnittliche Apply-Zeit liegt bei ~2 Sekunden (und wird weiter verbessert).
- **Installiere Rices** aus dem Internet oder **importiere sie lokal** aus dem Dateisystem.
- **Teile Rices.** Lade deine eigenen Rices (Dotfiles) auf den Server hoch, damit sie öffentlich verfügbar sind.
- **Bearbeite/entferne** das hochgeladene Rice in der GUI.
- **Öffne das Konfigurations-Repository**, sieh dir unterstützte Distributionen an und synchronisiere Kerninformationen via Git.

### Configs und Plugins

- Verwalte Konfigurationen über die GUI.
- Verwalte Plugins über die GUI:
  - Plugin-Repositories hinzufügen
  - benutzerdefinierte Parameter zu einem Plugin hinzufügen
  - verschiedene Parametertypen unterstützen (z. B. einen Farbwähler)

### Stabilitäts-Tools

- Problematische temporäre Zustände unterstützter Tiling-Window-Manager beheben.
- Externe Umgebungszustände speichern und wiederherstellen.

### Sicherheit und Isolation

- Sicherheitsprüfung von Rice-Skripten vor der Ausführung + eigene Sicherheitsregeln.
- Zweistufige Isolation der Rice-Abhängigkeiten: Standard + kontrolliertes Präfix-System (Beta).  
  Wenn in einem Rice-Skript Symlinks gefunden werden, haben sie Priorität und der Standardmechanismus wird deaktiviert.

### UX und Quality of Life

- Konfiguriere die Rice-Wechsel-Animation (verwendet aktuell `swww`):
  - Animationstyp
  - FPS
  - Dauer
  - Wellenwinkel
- Zusätzliche Optionen:
  - ein Rice nach dem Boot automatisch anwenden (optional)
  - das Rice-Listen-Fenster nach der Auswahl offen lassen oder schließen
  - Logging der Apply/Install-Zeit aktivieren
- Mehrsprachige Unterstützung: derzeit werden 4 Sprachen unterstützt.
- lastlayer-Parameter:
  - das Interface-Theme wechseln
  - grundlegende Sound-Steuerung

## Rice-Standard 🎨

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

### Rice-Karte (aktuell)

Die Rice-Karte ist eines der zentralen Pop-ups und wird in zukünftigen Versionen erweitert.

Ein Rice sollte enthalten:

- **Vorschau** (512x512 oder 1024x1024)
- **Repository-Link**
- **Autor** (Avatar wird automatisch aus Git geparst)
- **Adaptionsautor** (optional)
- **Tags** (optional)
- **Funktionskategorie** (optional; mehrere erlaubt)
- **Unterstützte Distributionen** (optional; wenn nicht angegeben, generiert lastlayer die Liste automatisch basierend auf dem Skript)

<details>
<summary><b>Geplant</b></summary>

- Automatische Konvertierung zwischen Distributionen und Tiling-Window-Managern
- Bewertungssystem (mehr Details in der Roadmap)

</details>

## Ein vorhandenes Rice anpassen / ein neues erstellen 🎨

In den ersten Versionen benötigt das Programm vorübergehend eine vorhersehbare Rice-Struktur.

### Minimal akzeptable Struktur (Hyprland)

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

### Empfohlene Struktur

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

### Dateibedeutungen

- `preview.png` – Bild, das dem Nutzer in der Rice-Liste angezeigt wird
- `wallpaper.png` – Standard-Desktop-Hintergrund
- `hyprland.conf` – Referenzen zu Hyprland-Konfigurationsdateien (direkte Parameter ohne Links sind ebenfalls möglich). Dateien, die zu dieser Konfiguration gehören, müssen in `hyprland/` liegen.
- `lastlayer.conf` – lastlayer-Konfiguration, die das Umschalten konsistent hält, Hilfsterminals während des Umschaltens ausblendet und die erforderlichen Sichtbarkeitsattribute für das Programmfenster setzt.

### start-scripts/

- `install_theme_apps.sh` (optional)  
  Installiert begleitende Anwendungen. Läuft nur bei der ersten Installation eines Rice.
- `set_after_install_actions.sh`  
  Startet begleitende Anwendungen. Läuft jedes Mal, wenn ein Rice angewendet wird.

### config/ (optional)

Verzeichnis mit Konfigurationsdateien begleitender Anwendungen.

> [!TIP]
> Beispiele findest du in den Preset-Rices im Bereich **lastlayer Network** (oder im Starter-Archiv oben). Sie folgen dem üblichen Muster, die Hyprland-Konfiguration in mehrere Dateien aufzuteilen und sie aus `hyprland.conf` zu referenzieren.

<details>
<summary><b>Hinweise zur Kompatibilität und zu Skripten (aktueller Ansatz)</b></summary>

- Vorerst erwartet lastlayer eine vorhersehbare Rice-Struktur. In zukünftigen Versionen wirst du Legacy-Rices ohne Umstrukturierung importieren können (Rices, die dieses Layout bereits einhalten, bleiben rückwärtskompatibel).
- Rice-Skripte installieren und starten begleitende Anwendungen, um alle Aktionen transparent und leicht überprüfbar zu halten.
- lastlayer erkennt potenziell gefährliche Befehle und führt sie ohne ausdrückliche Zustimmung des Nutzers nicht aus.

</details>

## Roadmap 🔮

- [x] Codebasis als Open Source veröffentlicht, Architektur für zukünftige Features vorbereitet
- [x] Reddit-Rating-Metadaten und einen YouTube-Demo-Link in Rice-Karten integrieren
- [ ] Rices über den gesamten PC-Flow wechseln (GRUB, rEFInd, Login-Screen)
- [ ] Unterstützung weiterer populärer Window-Manager (Rices, Configs, Plugins)
- [ ] Rices zwischen Window-Managern konvertieren/mappen (Modul für äquivalente Parameter) und Install/Apply-Pakete zwischen Distributionen konvertieren
- [ ] Modul für Abwärtskompatibilität für Legacy-Rices
- [ ] UI-Verbesserungen: Drag & Drop, Tag-Filter, Pagination für Network-Items
- [ ] Experimentell: Wechsel nach aktuellem Arbeitsmodus oder nach Kontext des fokussierten Fensters
- [ ] KI-Generierung von Umgebungen/Rices (prompt- und kontextbasiert)

> [!NOTE]
> Der Code ist seit v1.1 vollständig Open Source. Vorschläge und Issue-Reports sind willkommen.

## Getestet auf ✅

- Hyprland + Arch
