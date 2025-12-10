# lastlayer (llayer)

Une couche d'interface dynamique — une nouvelle abstraction au-dessus de l'environnement de bureau qui permet de contrôler l'environnement à plusieurs niveaux et de le transformer instantanément.

## Sommaire

- Mise à jour 1.1
- Installation
- Rices adaptés de démarrage (hors ligne)
- Fonctionnalités
- Standard de rice
- Adapter un rice
- Feuille de route
- Testé sur

## Mise à jour 1.1

1. Le code source complet a été rendu public (comme prévu).
2. Les analytics pays/rices ont été supprimés.
3. Ajout d'une fonctionnalité permettant d'afficher et, optionnellement, d'envoyer des métriques moyennes de vitesse d'installation/application par thème (l'envoi est désactivé par défaut).
4. Ajout de la possibilité de renseigner et de consulter des métadonnées supplémentaires d'un rice : un post Reddit (avec parsing des données générales) et un lien YouTube.
5. Mise à jour de la carte de rice (thème) : deux modes d'affichage avec un interrupteur — thème local et thème en ligne.
6. Ajout d'un menu de paramètres pour gérer des listes de barres, afin de prendre en charge des barres personnalisables plus rares et pas encore intégrées, ainsi que d'autres widgets à l'intérieur des rices.
7. Mise à jour de la fonctionnalité de point de restauration (save/restore).
8. Amélioration de l'algorithme d'application/installation des rices ; les deux opérations sont désormais 30 % plus rapides dans les mêmes conditions de test.
9. Amélioration du système de plugins : possibilité de corriger les problèmes liés à la dépendance externe hyprpm directement dans le programme, et d'afficher les logs internes du terminal pour d'autres opérations de plugin.
10. Préparation d'une base d'architecture plus large pour intégrer des rices d'autres niveaux (rEFInd, GRUB, SDDM, etc.) et pour supporter d'autres compositeurs de fenêtres.

## Installation

```bash
git clone https://github.com/llayerlinux/lastlayer.git
cd lastlayer
./install.sh
```

> **Remarque**  
> Toutes les dépendances nécessaires sont installées automatiquement par `install.sh` : swww, yad, webkit2gtk.

## Rices adaptés de démarrage (hors ligne)

Si le serveur est temporairement indisponible :

1. Télécharger et extraire l'archive :  
   https://drive.google.com/file/d/1PiXFYCzl5wRDr8SQUB8qu3i93fifvZur/view?usp=sharing
2. Cliquer sur **+** dans la barre de boutons en bas pour l'import local
3. Naviguer vers le répertoire du rice dans votre gestionnaire de fichiers et l'ouvrir

## Fonctionnalités

### Gestion des rices

- Changer de rice en un clic. Le temps moyen d'application est d'environ ~2 secondes (et continue de s'améliorer).
- Installer des rices depuis Internet ou les importer localement depuis le système de fichiers.
- Partager des rices : envoyer vos propres rices (dotfiles) sur le serveur pour un accès public.
- Modifier/supprimer via l'interface graphique le rice que vous avez publié.
- Ouvrir le dépôt de configuration, voir les distributions supportées et synchroniser les informations principales via Git.

### Configurations et plugins

- Gérer les configurations via l'interface graphique.
- Gérer les plugins via l'interface graphique :
  - ajouter des dépôts de plugins
  - ajouter des paramètres personnalisés à un plugin
  - prendre en charge différents types de paramètres (par exemple, un sélecteur de couleur)

### Outils de stabilité

- Corriger des états temporaires problématiques des gestionnaires de fenêtres en tuilage supportés.
- Sauvegarder et restaurer des états d'environnement externes.

### Sécurité et isolation

- Vérification de sécurité des scripts de rice avant exécution + règles de sécurité personnalisées.
- Isolation à deux niveaux des dépendances des rices : standard + système de préfixes contrôlé (bêta).

Si des liens symboliques sont trouvés dans un script de rice, ils sont prioritaires et le mécanisme standard est désactivé.

### UX et qualité de vie

- Configurer l'animation de changement de rice (utilise actuellement `swww`) :
  - type d'animation
  - FPS
  - durée
  - angle de l'onde
- Options supplémentaires :
  - appliquer automatiquement un rice après le démarrage (optionnel)
  - garder ou fermer la fenêtre de liste des rices après la sélection
  - activer la journalisation du temps d'application/installation
- Support multilingue : 4 langues sont actuellement supportées.
- Paramètres lastlayer :
  - changer le thème de l'interface
  - contrôle audio de base

## Standard de rice

### Carte de rice (actuelle)

La carte de rice est l'une des fenêtres principales et sera étendue dans les futures versions.

Un rice devrait inclure :

- Aperçu (512x512 ou 1024x1024)
- Lien vers le dépôt
- Auteur (l'avatar est récupéré automatiquement depuis Git)
- Auteur de l'adaptation (optionnel)
- Tags (optionnel)
- Catégorie de fonctionnalités (optionnel ; plusieurs possibles)
- Distributions supportées (optionnel ; si non précisé, lastlayer génère automatiquement la liste à partir du script)

Prévu :

- Conversion automatique entre distributions et gestionnaires de fenêtres en tuilage
- Système de notation (plus de détails dans la feuille de route)

## Adapter un rice existant / en créer un nouveau

Dans les premières versions, le programme requiert temporairement une structure de rice prévisible.

### Structure minimale acceptable (Hyprland)

```text
RICE_NAME/
├── preview.png
├── wallpaper.png
├── hyprland.conf
├── hyprland/
│   ├── lastlayer.conf
└── start-scripts/
    ├── install_theme_apps.sh (optionnel)
    └── set_after_install_actions.sh
├── config/ (optionnel)
```

### Structure recommandée

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
    ├── install_theme_apps.sh (optionnel)
    └── set_after_install_actions.sh
├── config/ (optionnel)
```

### Signification des fichiers

- `preview.png` - image affichée à l'utilisateur dans la liste des rices
- `wallpaper.png` - fond d'écran par défaut
- `hyprland.conf` - références vers des fichiers de configuration Hyprland (des paramètres directs sans liens sont également possibles). Les fichiers liés à cette configuration doivent être placés dans `hyprland/`.
- `lastlayer.conf` - configuration lastlayer qui garantit un changement cohérent, masque les terminaux auxiliaires pendant le changement et définit les attributs de visibilité requis pour la fenêtre du programme

### start-scripts/

- `install_theme_apps.sh` (optionnel)  
  Installe les applications associées. S'exécute uniquement lors de la première installation d'un rice.
- `set_after_install_actions.sh`  
  Lance les applications associées. S'exécute à chaque application d'un rice.

### config/ (optionnel)

Dossier contenant les fichiers de configuration des applications associées.

> **Astuce**  
> Pour des exemples, consultez les rices prédéfinis dans la section **Network** de lastlayer (ou l'archive de démarrage ci-dessus). Ils suivent le schéma courant consistant à découper la configuration Hyprland en plusieurs fichiers et à les référencer depuis `hyprland.conf`.

Notes sur la compatibilité et les scripts (approche actuelle) :

- Pour le moment, lastlayer attend une structure de rice prévisible. Dans les futures versions, il sera possible d'importer des rices « legacy » sans les restructurer (les rices qui suivent déjà cette mise en page resteront rétrocompatibles).
- Les scripts de rice installent et lancent les applications associées afin que toutes les actions soient transparentes et faciles à vérifier.
- lastlayer détecte les commandes potentiellement dangereuses et ne les exécutera pas sans consentement explicite de l'utilisateur.

## Feuille de route

- Mise en open source du code avec une architecture préparée pour les futures fonctionnalités
- Intégrer des métadonnées de notation Reddit et un lien de démo YouTube dans les cartes de rice
- Changer de rices sur l'ensemble du flux du PC (GRUB, rEFInd, écran de connexion)
- Supporter d'autres gestionnaires de fenêtres populaires (rices, configs, plugins)
- Convertir/cartographier les rices entre gestionnaires de fenêtres (module de système de paramètres équivalents) et convertir les paquets d'installation/application entre distributions
- Module de rétrocompatibilité pour les rices legacy
- Améliorations UI : drag and drop, filtres par tags, pagination des éléments Network
- Expérimental : changer selon le mode de travail actuel, ou selon le contexte de la fenêtre focalisée
- Génération IA d'environnements/rices (basée sur prompt et contexte)

> **Remarque**  
> Le code est entièrement open source depuis la v1.1. Les suggestions et les rapports d'issues sont les bienvenus.

## Testé sur ✅

- Hyprland + Arch
