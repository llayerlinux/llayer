# lastlayer (llayer)

Una capa de interfaz dinámica: una nueva abstracción por encima del entorno de escritorio que te permite controlar el entorno a varios niveles y transformarlo al instante.

## Contenido

- Update 1.1
- Instalación
- Rices adaptados de inicio (offline)
- Funciones
- Estándar de rice
- Adaptar un rice
- Hoja de ruta
- Probado en

## Update 1.1

1. Se ha publicado el código fuente completo (tal como estaba previsto).
2. Se han eliminado las analíticas de países/rices.
3. Se añadió la funcionalidad para mostrar y, opcionalmente, enviar métricas medias de velocidad de instalación/aplicación por tema (el envío está desactivado por defecto).
4. Se añadió la posibilidad de rellenar y ver metadatos adicionales del rice: una publicación de Reddit (con análisis de datos generales) y un enlace de YouTube.
5. Se actualizó la tarjeta de rice (tema): se implementaron dos modos de visualización con un interruptor: tema local y tema en línea.
6. Se añadió un menú de ajustes para gestionar listas de barras, habilitando el soporte para barras personalizables más raras y aún no incluidas, así como otros widgets dentro de los rices.
7. Se actualizó la funcionalidad de punto de restauración (save/restore).
8. Se mejoró el algoritmo de aplicación/instalación de rices; ambas operaciones son ahora un 30% más rápidas en las mismas condiciones de prueba.
9. Se mejoró el sistema de plugins: se añadió la posibilidad de corregir problemas con la dependencia externa hyprpm dentro del programa y de ver los registros internos del terminal para otras operaciones de plugins.
10. Se preparó una base arquitectónica más amplia para integrar rices de otros niveles (rEFInd, GRUB, SDDM, etc.) y para dar soporte a otros compositores de ventanas.

## Instalación

```bash
git clone https://github.com/llayerlinux/lastlayer.git
cd lastlayer
./install.sh
```

> **Nota**  
> Todas las dependencias necesarias se instalan automáticamente mediante `install.sh`: swww, yad, webkit2gtk.

## Rices adaptados de inicio (offline)

Si el servidor no está disponible temporalmente:

1. Descarga y extrae el archivo:  
   https://drive.google.com/file/d/1PiXFYCzl5wRDr8SQUB8qu3i93fifvZur/view?usp=sharing
2. Haz clic en **+** en la barra de botones inferior para importar localmente
3. Ve al directorio del rice en tu gestor de archivos y ábrelo

## Funciones

### Gestión de rices

- Cambiar de rice con un clic. El tiempo medio de aplicación es de ~2 segundos (y sigue mejorando).
- Instalar rices desde internet o importarlos localmente desde el sistema de archivos.
- Compartir rices: sube tus propios rices (dotfiles) al servidor para acceso público.
- Editar/eliminar desde la GUI el rice que subiste.
- Abrir el repositorio de configuración, ver las distribuciones compatibles y sincronizar la información principal mediante Git.

### Configuraciones y plugins

- Gestionar configuraciones desde la GUI.
- Gestionar plugins desde la GUI:
  - añadir repositorios de plugins
  - añadir parámetros personalizados a un plugin
  - admitir distintos tipos de parámetros (por ejemplo, un selector de color)

### Herramientas de estabilidad

- Corregir estados temporales problemáticos de gestores de ventanas en mosaico compatibles.
- Guardar y restaurar estados del entorno externo.

### Seguridad y aislamiento

- Comprobación de seguridad de scripts de rice antes de ejecutarlos + reglas de seguridad personalizadas.
- Aislamiento en dos niveles de dependencias de rices: estándar + sistema de prefijos controlado (beta).

Si se encuentran enlaces simbólicos en un script de rice, tienen prioridad y el mecanismo estándar se desactiva.

### UX y calidad de vida

- Configurar la animación de cambio de rice (actualmente usa `swww`):
  - tipo de animación
  - FPS
  - duración
  - ángulo de onda
- Opciones adicionales:
  - aplicar automáticamente un rice tras el arranque (opcional)
  - mantener abierta o cerrar la ventana de lista de rices tras la selección
  - activar el registro del tiempo de aplicación/instalación
- Soporte multilingüe: actualmente se admiten 4 idiomas.
- Parámetros de lastlayer:
  - cambiar el tema de la interfaz
  - control básico del sonido

## Estándar de rice

### Tarjeta de rice (actual)

La tarjeta de rice es una de las ventanas emergentes principales y se ampliará en futuras versiones.

Un rice debería incluir:

- Vista previa (512x512 o 1024x1024)
- Enlace al repositorio
- Autor (el avatar se obtiene automáticamente desde Git)
- Autor de la adaptación (opcional)
- Etiquetas (opcional)
- Categoría de funcionalidad (opcional; se permiten varias)
- Distribuciones compatibles (opcional; si no se especifica, lastlayer genera la lista automáticamente en función del script)

Planificado:

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
    ├── install_theme_apps.sh (opcional)
    └── set_after_install_actions.sh
├── config/ (opcional)
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
    ├── install_theme_apps.sh (opcional)
    └── set_after_install_actions.sh
├── config/ (opcional)
```

### Significado de los archivos

- `preview.png` - imagen que se muestra al usuario en la lista de rices
- `wallpaper.png` - fondo de escritorio predeterminado
- `hyprland.conf` - referencias a archivos de configuración de Hyprland (también son posibles parámetros directos sin enlaces). Los archivos relacionados con esta configuración deben colocarse en `hyprland/`.
- `lastlayer.conf` - configuración de lastlayer que mantiene el cambio consistente, oculta terminales auxiliares durante el cambio y establece los atributos de visibilidad necesarios para la ventana del programa

### start-scripts/

- `install_theme_apps.sh` (opcional)  
  Instala aplicaciones acompañantes. Solo se ejecuta en la primera instalación de un rice.
- `set_after_install_actions.sh`  
  Inicia aplicaciones acompañantes. Se ejecuta cada vez que se aplica un rice.

### config/ (opcional)

Directorio con archivos de configuración de las aplicaciones acompañantes.

> **Consejo**  
> Para ver ejemplos, revisa los rices predefinidos en la sección **Network** de lastlayer (o el archivo inicial de arriba). Siguen el patrón habitual de dividir la configuración de Hyprland en varios archivos y referenciarlos desde `hyprland.conf`.

Notas sobre compatibilidad y scripts (enfoque actual):

- Por ahora, lastlayer espera una estructura de rice predecible. En futuras versiones podrás importar rices heredados sin reestructurarlos (los rices que ya siguen este diseño seguirán siendo retrocompatibles).
- Los scripts de rice instalan e inician aplicaciones acompañantes para que todas las acciones sean transparentes y fáciles de revisar.
- lastlayer detecta comandos potencialmente peligrosos y no los ejecutará sin el consentimiento explícito del usuario.

## Hoja de ruta

- Se liberó el código como open source con una arquitectura preparada para futuras funciones
- Integrar metadatos de valoraciones de Reddit y un enlace de demostración de YouTube en las tarjetas de rice
- Cambiar rices a través de todo el flujo del PC (GRUB, rEFInd, pantalla de inicio de sesión)
- Dar soporte a otros gestores de ventanas populares (rices, configuraciones, plugins)
- Convertir/mapear rices entre gestores de ventanas (módulo de sistema de parámetros equivalentes) y convertir paquetes de instalación/aplicación entre distribuciones
- Módulo de retrocompatibilidad para rices heredados
- Mejoras de la UI: drag and drop, filtros por etiquetas, paginación para elementos de Network
- Experimental: cambiar por modo de trabajo actual o por el contexto de la ventana enfocada
- Generación con IA de entornos/rices (basada en prompt y contexto)

> **Nota**  
> El código es totalmente de código abierto desde la v1.1. Se agradecen sugerencias y reportes de issues.

## Probado en ✅

- Hyprland + Arch
