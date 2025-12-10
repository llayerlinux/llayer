![image](https://github.com/user-attachments/assets/6e8706dc-2cba-4f34-a753-fb22cc662d82)

![](https://img.shields.io/github/last-commit/Litesav-L/lastlayer?style=for-the-badge&color=303030) ![](https://img.shields.io/badge/DECEMBER-2025-12?style=for-the-badge) ![](https://img.shields.io/github/repo-size/Litesav-L/lastlayer?style=for-the-badge&cacheSeconds=30) ![](https://img.shields.io/badge/Linux-%23171717?style=for-the-badge&logo=linux&logoColor=white) ![](https://img.shields.io/badge/Arch-%23007ACC?style=for-the-badge&logo=arch-linux&logoColor=white) ![](https://img.shields.io/badge/Hyprland-%239566f2?style=for-the-badge&logoColor=white)

# ![icon](https://github.com/user-attachments/assets/27330896-e1fd-47d2-83cb-463c46a73475) lastlayer (llayer)

Una capa de interfaz dinámica: una nueva abstracción por encima del entorno de escritorio que te permite controlar el entorno en múltiples niveles y transformarlo al instante.

![image](https://github.com/user-attachments/assets/a8cf79e7-ad19-4686-8b66-7a5f7b8bf223)


Contenido

- Update 1.1
- Instalación
- Rices adaptados de inicio (sin conexión)
- Funcionalidades
- Estándar de rice
- Adaptar un rice
- Hoja de ruta
- Probado en

## Update 1.1
1. Se ha abierto el código fuente completo (tal y como estaba previsto).
2. Se han eliminado las analíticas de países/rices.
3. Se ha añadido la funcionalidad para mostrar y, opcionalmente, enviar métricas promedio de velocidad de instalación/aplicación por tema (el envío está desactivado por defecto).
4. Se ha añadido la capacidad de completar y ver metadatos extra del rice: una publicación de Reddit (con análisis de datos generales) y un enlace de YouTube.
5. Se ha actualizado la tarjeta del rice (tema): se han implementado dos modos de visualización con un interruptor: tema local y tema en línea.
6. Se ha añadido un menú de configuración para gestionar listas de barras, habilitando el soporte para barras personalizables más raras y aún no incluidas, y otros widgets dentro de los rices.
7. Se ha actualizado la funcionalidad de punto de restauración (guardar/restaurar).
8. Se ha mejorado el algoritmo de aplicar/instalar rices; ambas operaciones son ahora un 30% más rápidas bajo las mismas condiciones de prueba.
9. Se ha mejorado el sistema de plugins: se ha añadido la capacidad de corregir problemas con la dependencia externa hyprpm dentro del programa, y de ver registros internos del terminal para otras operaciones de plugins.
10. Se ha preparado una base arquitectónica más amplia para integrar rices de otros niveles (rEFInd, GRUB, SDDM, etc.) y para dar soporte a otros compositores de ventanas.

## Instalación

```bash
git clone https://github.com/llayerlinux/lastlayer.git
cd lastlayer
./install.sh
```

Nota

Todas las dependencias necesarias se instalan automáticamente mediante `install.sh`: swww, yad, webkit2gtk.

## Rices adaptados de inicio (sin conexión)

Si el servidor no está disponible temporalmente:

1. Descarga y extrae el archivo:
   https://drive.google.com/file/d/1PiXFYCzl5wRDr8SQUB8qu3i93fifvZur/view?usp=sharing
2. Haz clic en + en la barra inferior de botones para la importación local
3. Ve al directorio del rice en tu gestor de archivos y ábrelo

## Funcionalidades
### Gestión de rices

- Cambio de rice con un clic. El tiempo medio de aplicación es de ~2 segundos (y sigue mejorando).
- Instala rices desde internet o impórtalos localmente desde el sistema de archivos.
- Comparte rices. Sube tus propios rices (dotfiles) al servidor para acceso público.
- Edita/elimina el rice que hayas subido desde la GUI.
- Abre el repositorio de configuración, consulta distribuciones compatibles y sincroniza la información principal mediante Git.

### Configs y plugins

- Gestiona configuraciones desde la GUI.
- Gestiona plugins desde la GUI:
  - añadir repositorios de plugins
  - añadir parámetros personalizados a un plugin
  - soporte para distintos tipos de parámetros (por ejemplo, un selector de color)

### Herramientas de estabilidad

- Corrige estados temporales problemáticos de gestores de ventanas en mosaico compatibles.
- Guarda y restaura estados externos del entorno.

### Seguridad y aislamiento

- Comprobación de seguridad de los scripts de rice antes de ejecutarlos + reglas de seguridad personalizadas.
- Aislamiento en dos niveles de dependencias del rice: estándar + sistema de prefijos controlados (beta).

Si se encuentran enlaces simbólicos en un script de rice, tienen prioridad y el mecanismo estándar se desactiva.

### UX y calidad de vida

- Configura la animación de cambio de rice (actualmente usa `swww`):
  - tipo de animación
  - FPS
  - duración
  - ángulo de la onda
- Opciones adicionales:
  - aplicar un rice automáticamente tras el arranque (opcional)
  - mantener o cerrar la ventana de lista de rices después de la selección
  - habilitar el registro del tiempo de aplicación/instalación
- Soporte multilingüe: actualmente se admiten 4 idiomas.
- Parámetros de lastlayer:
  - cambiar el tema de la interfaz
  - control básico de sonido

## Estándar de rice

![](https://github.com/user-attachments/assets/35e63df9-981f-4748-abe1-1e3f98dda7d0) ![](https://github.com/user-attachments/assets/a9feb54e-7a3f-4f9f-90c7-2f66886bccb9) ![](https://github.com/user-attachments/assets/dd231164-f0c9-438e-b805-9fff8acfee8c)
![](https://github.com/user-attachments/assets/04885899-f7f7-450d-ade2-799f0e8c5346)

### Tarjeta del rice (actual)

La tarjeta del rice es uno de los pop-ups principales y se ampliará en futuras versiones.

Un rice debe incluir:

- Vista previa (512x512 o 1024x1024)
- Enlace al repositorio
- Autor (el avatar se analiza automáticamente desde Git)
- Autor de la adaptación (opcional)
- Etiquetas (opcional)
- Categoría de funcionalidad (opcional; se permiten varias)
- Distribuciones compatibles (opcional; si no se especifica, lastlayer genera la lista automáticamente basándose en el script)

Planificado
- Conversión automática entre distribuciones y gestores de ventanas en mosaico
- Sistema de valoración (más detalles en la hoja de ruta)

## Adaptar un rice existente / crear uno nuevo

En las primeras versiones, el programa requiere temporalmente una estructura de rice predecible.

### Estructura mínima aceptable (Hyprland)

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

### Estructura recomendada

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

### Significado de los archivos

#### hyprland/

- `lastlayer.conf`: Archivo especial que contiene las anulaciones de configuración de lastlayer. lastlayer lo aplica después de aplicar la configuración principal de Hyprland.

#### start-scripts/

- `install_theme_apps.sh` (optional)  
  Instala aplicaciones complementarias. Se ejecuta solo en la primera instalación de un rice.
- `set_after_install_actions.sh`  
  Inicia aplicaciones complementarias. Se ejecuta cada vez que se aplica un rice.

#### config/ (optional)

Directorio con archivos de configuración de aplicaciones complementarias.

Consejo

Para ejemplos, revisa los rices predefinidos en la sección Network de lastlayer (o el archivo de inicio anterior). Siguen el patrón común de dividir la configuración de Hyprland en varios archivos y referenciarlos desde `hyprland.conf`.

Notas sobre compatibilidad y scripts (enfoque actual)
- Por ahora, lastlayer espera una estructura de rice predecible. En versiones futuras podrás importar rices heredados sin reestructurarlos (los rices que ya sigan este diseño permanecerán retrocompatibles).
- Los scripts del rice instalan y lanzan aplicaciones complementarias para que todas las acciones sean transparentes y fáciles de revisar.
- lastlayer detecta comandos potencialmente peligrosos y no los ejecuta sin el consentimiento explícito del usuario.

## Hoja de ruta

- Código abierto con arquitectura preparada para futuras funciones
- Integrar metadatos de valoración de Reddit y un enlace de demo de YouTube en las tarjetas de rice
- Cambiar rices a lo largo de todo el flujo del PC (GRUB, rEFInd, pantalla de inicio de sesión)
- Dar soporte a otros gestores de ventanas populares (rices, configs, plugins)
- Convertir/mapear rices entre gestores de ventanas (módulo de sistema de parámetros equivalentes) y convertir paquetes de instalación/aplicación entre distribuciones
- Módulo de compatibilidad hacia atrás para rices heredados
- Mejoras de UI: arrastrar y soltar, filtros por etiquetas, paginación para elementos de Network
- Experimental: cambiar según el modo de trabajo actual o según el contexto de la ventana enfocada
- Generación por IA de entornos/rices (basada en prompts y contexto)

Nota

El código es completamente de código abierto desde la v1.1. Se aceptan sugerencias e informes de issues

## Probado en ✅

- Hyprland + Arch
