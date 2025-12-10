![image](https://github.com/user-attachments/assets/6e8706dc-2cba-4f34-a753-fb22cc662d82)

![](https://img.shields.io/github/last-commit/Litesav-L/lastlayer?style=for-the-badge&color=303030) ![](https://img.shields.io/badge/DECEMBER-2025-12?style=for-the-badge) ![](https://img.shields.io/github/repo-size/Litesav-L/lastlayer?style=for-the-badge&cacheSeconds=30) ![](https://img.shields.io/badge/Linux-%23171717?style=for-the-badge&logo=linux&logoColor=white) ![](https://img.shields.io/badge/Arch-%23007ACC?style=for-the-badge&logo=arch-linux&logoColor=white) ![](https://img.shields.io/badge/Hyprland-%239566f2?style=for-the-badge&logoColor=white)

# ![icon](https://github.com/user-attachments/assets/27330896-e1fd-47d2-83cb-463c46a73475) lastlayer (llayer)

Une couche d’interface dynamique — une nouvelle abstraction au-dessus de l’environnement de bureau qui te permet de contrôler l’environnement à plusieurs niveaux et de le transformer instantanément.

![image](https://github.com/user-attachments/assets/a8cf79e7-ad19-4686-8b66-7a5f7b8bf223)


Sommaire

- Update 1.1
- Installation
- Rices adaptés de démarrage (hors ligne)
- Fonctionnalités
- Standard de rice
- Adapter un rice
- Feuille de route
- Testé sur

## Update 1.1
1. Le code source complet a été ouvert (comme prévu).
2. Les statistiques pays/rices ont été supprimées.
3. Ajout d’une fonctionnalité pour afficher et, éventuellement, envoyer des métriques moyennes de vitesse d’installation/application par thème (l’envoi est désactivé par défaut).
4. Ajout de la possibilité de remplir et de consulter des métadonnées supplémentaires pour un rice : un post Reddit (avec analyse de données générales) et un lien YouTube.
5. Mise à jour de la carte de rice (thème) : deux modes d’affichage avec un interrupteur : thème local et thème en ligne.
6. Ajout d’un menu de paramètres pour gérer des listes de barres, permettant de prendre en charge des barres personnalisables plus rares et pas encore intégrées, ainsi que d’autres widgets dans les rices.
7. Mise à jour de la fonctionnalité de point de restauration (sauvegarde/restauration).
8. Amélioration de l’algorithme d’application/installation des rices ; les deux opérations sont désormais 30% plus rapides dans les mêmes conditions de test.
9. Amélioration du système de plugins : ajout de la possibilité de corriger des problèmes liés à la dépendance externe hyprpm directement dans le programme, et de consulter des logs internes du terminal pour d’autres opérations de plugins.
10. Préparation d’une base architecturale plus large pour intégrer des rices d’autres niveaux (rEFInd, GRUB, SDDM, etc.) et pour prendre en charge d’autres compositeurs de fenêtres.

## Installation

```bash
git clone https://github.com/llayerlinux/lastlayer.git
cd lastlayer
./install.sh
```

Note

Toutes les dépendances requises sont installées automatiquement par `install.sh` : swww, yad, webkit2gtk.

## Rices adaptés de démarrage (hors ligne)

Si le serveur est temporairement indisponible :

1. Télécharge et extrait l’archive :
   https://drive.google.com/file/d/1PiXFYCzl5wRDr8SQUB8qu3i93fifvZur/view?usp=sharing
2. Clique sur + dans la barre de boutons inférieure pour l’import local
3. Va dans le répertoire du rice via ton gestionnaire de fichiers et ouvre-le

## Fonctionnalités
### Gestion des rices

- Changement de rice en un clic. Le temps moyen d’application est d’environ 2 secondes (et continue de s’améliorer).
- Installe des rices depuis internet ou importe-les localement depuis le système de fichiers.
- Partage des rices. Téléverse tes propres rices (dotfiles) sur le serveur pour un accès public.
- Modifie/supprime le rice que tu as téléversé depuis l’interface.
- Ouvre le dépôt de configuration, consulte les distributions prises en charge et synchronise les infos principales via Git.

### Configs et plugins

- Gère les configurations via l’interface.
- Gère les plugins via l’interface :
  - ajouter des dépôts de plugins
  - ajouter des paramètres personnalisés à un plugin
  - prendre en charge différents types de paramètres (par exemple, un sélecteur de couleur)

### Outils de stabilité

- Corrige des états temporaires problématiques des gestionnaires de fenêtres en mosaïque pris en charge.
- Sauvegarde et restaure des états externes de l’environnement.

### Sécurité et isolation

- Vérification de sécurité des scripts de rice avant exécution + règles de sécurité personnalisées.
- Isolation à deux niveaux des dépendances d’un rice : standard + système de préfixes contrôlés (bêta).

Si des liens symboliques sont trouvés dans un script de rice, ils sont prioritaires et le mécanisme standard est désactivé.

### UX et confort

- Configure l’animation de changement de rice (utilise actuellement `swww`) :
  - type d’animation
  - FPS
  - durée
  - angle de vague
- Options supplémentaires :
  - appliquer automatiquement un rice après le démarrage (optionnel)
  - garder ou fermer la fenêtre de liste des rices après la sélection
  - activer l’enregistrement du temps d’application/installation
- Support multilingue : 4 langues sont actuellement prises en charge.
- Paramètres lastlayer :
  - changer le thème de l’interface
  - contrôle sonore de base

## Standard de rice

![](https://github.com/user-attachments/assets/35e63df9-981f-4748-abe1-1e3f98dda7d0) ![](https://github.com/user-attachments/assets/a9feb54e-7a3f-4f9f-90c7-2f66886bccb9) ![](https://github.com/user-attachments/assets/dd231164-f0c9-438e-b805-9fff8acfee8c)
![](https://github.com/user-attachments/assets/04885899-f7f7-450d-ade2-799f0e8c5346)

### Carte de rice (actuelle)

La carte de rice est l’un des pop-ups principaux et sera étendue dans les futures versions.

Un rice doit inclure :

- Aperçu (512x512 ou 1024x1024)
- Lien du dépôt
- Auteur (l’avatar est automatiquement récupéré depuis Git)
- Auteur de l’adaptation (optionnel)
- Tags (optionnel)
- Catégorie de fonctionnalité (optionnel ; plusieurs autorisées)
- Distributions prises en charge (optionnel ; si non précisé, lastlayer génère la liste automatiquement d’après le script)

Prévu
- Conversion automatique entre distributions et gestionnaires de fenêtres en mosaïque
- Système de notation (plus de détails dans la feuille de route)

## Adapter un rice existant / en créer un nouveau

Dans les premières versions, le programme nécessite temporairement une structure de rice prévisible.

### Structure minimale acceptable (Hyprland)

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
    ├── install_theme_apps.sh (optional)
    └── set_after_install_actions.sh
├── config/ (optional)
```

### Signification des fichiers

#### hyprland/

- `lastlayer.conf` : Fichier spécial contenant les surcharges de configuration de lastlayer. Il est appliqué par lastlayer après l’application de la configuration Hyprland principale.

#### start-scripts/

- `install_theme_apps.sh` (optional)  
  Installe les applications associées. S’exécute uniquement lors de la première installation d’un rice.
- `set_after_install_actions.sh`  
  Lance les applications associées. S’exécute à chaque application d’un rice.

#### config/ (optional)

Répertoire contenant les fichiers de configuration des applications associées.

Astuce

Pour des exemples, consulte les rices prédéfinis dans la section Network de lastlayer (ou l’archive de démarrage ci-dessus). Ils suivent le schéma courant consistant à découper la configuration Hyprland en plusieurs fichiers et à les référencer depuis `hyprland.conf`.

Notes sur la compatibilité et les scripts (approche actuelle)
- Pour l’instant, lastlayer attend une structure de rice prévisible. Dans les futures versions, tu pourras importer des rices legacy sans les restructurer (les rices qui suivent déjà ce modèle resteront rétrocompatibles).
- Les scripts de rice installent et lancent les applications associées afin que toutes les actions soient transparentes et faciles à vérifier.
- lastlayer détecte les commandes potentiellement dangereuses et ne les exécute pas sans le consentement explicite de l’utilisateur.

## Feuille de route

- Code open source avec une architecture préparée pour les fonctionnalités futures
- Intégrer des métadonnées de note Reddit et un lien de démo YouTube dans les cartes de rice
- Changer les rices sur l’ensemble du flux PC (GRUB, rEFInd, écran de connexion)
- Prendre en charge d’autres gestionnaires de fenêtres populaires (rices, configs, plugins)
- Convertir/cartographier les rices entre gestionnaires de fenêtres (module de système de paramètres équivalents) et convertir les paquets d’installation/application entre distributions
- Module de rétrocompatibilité pour les rices legacy
- Améliorations UI : glisser-déposer, filtres de tags, pagination des éléments Network
- Expérimental : basculer selon le mode de travail actuel ou selon le contexte de la fenêtre focalisée
- Génération d’environnements/rices par IA (basée sur prompts et contexte)

Note

Le code est entièrement open source depuis la v1.1. Suggestions et rapports d’issues bienvenus

## Testé sur ✅

- Hyprland + Arch
