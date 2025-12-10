# lastlayer (llayer)

Eine dynamische Interface-Schicht – eine neue Abstraktion oberhalb des Desktop-Umfelds, mit der sich die Umgebung auf mehreren Ebenen steuern und sofort transformieren lässt.

## Inhalt

- Update 1.1
- Installation
- Starter-Archiv angepasster Rices (offline)
- Funktionen
- Rice-Standard
- Ein Rice anpassen
- Roadmap
- Getestet auf

## Update 1.1

1. Der vollständige Quellcode wurde freigegeben (wie zuvor geplant).
2. Länder-/Rices-Analytik wurde entfernt.
3. Funktionalität hinzugefügt, um durchschnittliche Install-/Apply-Geschwindigkeitsmetriken pro Theme anzuzeigen und optional zu senden (Senden ist standardmäßig deaktiviert).
4. Möglichkeit hinzugefügt, zusätzliche Rice-Metadaten auszufüllen und anzusehen: ein Reddit-Post (mit Parsing allgemeiner Daten) und ein YouTube-Link.
5. Rice-(Theme-)Karte aktualisiert: zwei Anzeigemodi mit Umschalter implementiert — lokales Theme und Online-Theme.
6. Einstellungsmenü zum Verwalten von Bar-Listen hinzugefügt, um seltenere und noch nicht integrierte anpassbare Bars sowie andere Widgets innerhalb von Rices zu unterstützen.
7. Funktion „Wiederherstellungspunkt“ (save/restore) aktualisiert.
8. Apply-/Install-Algorithmus für Rices verbessert; beide Vorgänge sind unter denselben Testbedingungen jetzt um 30 % schneller.
9. Plugin-System verbessert: Möglichkeit hinzugefügt, Probleme mit der externen hyprpm-Abhängigkeit innerhalb des Programms zu beheben, und interne Terminal-Logs für andere Plugin-Operationen anzuzeigen.
10. Breitere architektonische Basis vorbereitet, um Rices anderer Ebenen (rEFInd, GRUB, SDDM usw.) zu integrieren und weitere Window-Compositoren zu unterstützen.

## Installation

```bash
git clone https://github.com/llayerlinux/lastlayer.git
cd lastlayer
./install.sh
```

> **Hinweis**  
> Alle erforderlichen Abhängigkeiten werden automatisch durch `install.sh` installiert: swww, yad, webkit2gtk.

## Starter-Archiv angepasster Rices (offline)

Wenn der Server vorübergehend nicht verfügbar ist:

1. Archiv herunterladen und entpacken:  
   https://drive.google.com/file/d/1PiXFYCzl5wRDr8SQUB8qu3i93fifvZur/view?usp=sharing
2. Für den lokalen Import unten in der Button-Leiste auf **+** klicken
3. Im Dateimanager zum Rice-Verzeichnis navigieren und es öffnen

## Funktionen

### Rice-Verwaltung

- Rices mit einem Klick wechseln. Durchschnittliche Apply-Zeit ~2 Sekunden (und wird weiter verbessert).
- Rices aus dem Internet installieren oder lokal aus dem Dateisystem importieren.
- Rices teilen: eigene Rices (Dotfiles) auf den Server hochladen, damit sie öffentlich zugänglich sind.
- Das hochgeladene Rice über die GUI bearbeiten/entfernen.
- Konfigurations-Repository öffnen, unterstützte Distributionen ansehen und Kerninformationen per Git synchronisieren.

### Konfigurationen und Plugins

- Konfigurationen über die GUI verwalten.
- Plugins über die GUI verwalten:
  - Plugin-Repositories hinzufügen
  - eigene Parameter zu einem Plugin hinzufügen
  - verschiedene Parametertypen unterstützen (z. B. ein Color Picker)

### Stabilitäts-Tools

- Problematische temporäre Zustände unterstützter Tiling-Window-Manager beheben.
- Externe Umgebungszustände speichern und wiederherstellen.

### Sicherheit und Isolation

- Sicherheitsprüfung von Rice-Skripten vor der Ausführung + eigene Sicherheitsregeln.
- Zweistufige Isolation von Rice-Abhängigkeiten: Standard + kontrolliertes Prefix-System (Beta).

Wenn in einem Rice-Skript Symlinks gefunden werden, haben sie Priorität und der Standardmechanismus wird deaktiviert.

### UX und Quality of Life

- Rice-Wechsel-Animation konfigurieren (nutzt derzeit `swww`):
  - Animationstyp
  - FPS
  - Dauer
  - Wellenwinkel
- Zusätzliche Optionen:
  - Rice nach dem Booten automatisch anwenden (optional)
  - Rice-Listenfenster nach der Auswahl offen lassen oder schließen
  - Logging der Apply-/Install-Zeit aktivieren
- Mehrsprachige Unterstützung: derzeit werden 4 Sprachen unterstützt.
- lastlayer-Parameter:
  - Interface-Theme wechseln
  - grundlegende Sound-Steuerung

## Rice-Standard

### Rice-Karte (aktuell)

Die Rice-Karte ist eines der zentralen Pop-ups und wird in zukünftigen Versionen erweitert.

Ein Rice sollte enthalten:

- Vorschau (512x512 oder 1024x1024)
- Repository-Link
- Autor (Avatar wird automatisch aus Git ausgelesen)
- Autor der Anpassung (optional)
- Tags (optional)
- Funktionskategorie (optional; mehrere möglich)
- Unterstützte Distributionen (optional; wenn nicht angegeben, generiert lastlayer die Liste automatisch basierend auf dem Skript)

Geplant:

- Automatische Konvertierung zwischen Distributionen und Tiling-Window-Managern
- Bewertungssystem (Details siehe Roadmap)

## Ein vorhandenes Rice anpassen / ein neues erstellen

In den ersten Versionen verlangt das Programm vorübergehend eine vorhersehbare Rice-Struktur.

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

### Bedeutung der Dateien

- `preview.png` - Bild, das dem Nutzer in der Rice-Liste angezeigt wird
- `wallpaper.png` - Standard-Desktop-Hintergrund
- `hyprland.conf` - Verweise auf Hyprland-Konfigurationsdateien (direkte Parameter ohne Links sind ebenfalls möglich). Dateien, die zu dieser Konfiguration gehören, müssen in `hyprland/` liegen.
- `lastlayer.conf` - lastlayer-Konfiguration, die das Umschalten konsistent hält, Hilfs-Terminals während des Umschaltens ausblendet und die erforderlichen Sichtbarkeitsattribute für das Programmfenster setzt

### start-scripts/

- `install_theme_apps.sh` (optional)  
  Installiert begleitende Anwendungen. Läuft nur bei der ersten Installation eines Rice.
- `set_after_install_actions.sh`  
  Startet begleitende Anwendungen. Läuft jedes Mal, wenn ein Rice angewendet wird.

### config/ (optional)

Verzeichnis mit Konfigurationsdateien begleitender Anwendungen.

> **Tipp**  
> Beispiele findest du in den Preset-Rices im Abschnitt **Network** von lastlayer (oder im Starter-Archiv oben). Sie folgen dem gängigen Muster, die Hyprland-Konfiguration in mehrere Dateien aufzuteilen und sie aus `hyprland.conf` zu referenzieren.

Hinweise zu Kompatibilität und Skripten (aktueller Ansatz):

- Derzeit erwartet lastlayer eine vorhersehbare Rice-Struktur. In zukünftigen Versionen kannst du Legacy-Rices importieren, ohne sie umzustrukturieren (Rices, die diesem Layout bereits folgen, bleiben abwärtskompatibel).
- Rice-Skripte installieren und starten begleitende Anwendungen, damit alle Aktionen transparent und leicht prüfbar bleiben.
- lastlayer erkennt potenziell gefährliche Befehle und führt sie nicht ohne ausdrückliche Zustimmung des Nutzers aus.

## Roadmap

- Codebasis als Open Source veröffentlicht, mit Architektur als Grundlage für zukünftige Features
- Reddit-Bewertungsmetadaten und einen YouTube-Demo-Link in Rice-Karten integrieren
- Rices über den gesamten PC-Flow hinweg wechseln (GRUB, rEFInd, Login-Screen)
- Unterstützung weiterer populärer Window-Manager (Rices, Konfigurationen, Plugins)
- Rices zwischen Window-Managern konvertieren/mappen (Modul für äquivalente Parameter) und Install-/Apply-Pakete zwischen Distributionen konvertieren
- Abwärtskompatibilitätsmodul für Legacy-Rices
- UI-Verbesserungen: Drag and Drop, Tag-Filter, Pagination für Network-Items
- Experimentell: Umschalten nach aktuellem Arbeitsmodus oder anhand des Kontexts des fokussierten Fensters
- KI-Generierung von Umgebungen/Rices (prompt- und kontextbasiert)

> **Hinweis**  
> Der Code ist seit v1.1 vollständig Open Source. Vorschläge und Issue-Reports sind willkommen.

## Getestet auf ✅

- Hyprland + Arch
