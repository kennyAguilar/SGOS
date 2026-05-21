# SGOS — Guía de Diseño de Interfaz (Carbon Design System)

Sistema de Gestión de Operaciones de Slots (SGOS) · Basado en **Carbon Design System v11**
**Tema Base:** Gray 100 (Dark Theme) — Optimizado para dashboards de analítica de datos y alta densidad de información.

---

## 1. Identidad Visual y Paleta de Colores

Adoptamos el esquema de tokens oficiales de Carbon para temas oscuros. El color base de la interfaz pasa a ser un gris profundo, manteniendo acentos específicos para el contexto de casino (oro/amarillo y alertas), bajo la nomenclatura estricta del sistema de diseño.

### Superficies (Core Layering)
| Token Carbon | Hex | Uso en SGOS |
|---|---|---|
| `$background` | `#161616` | Fondo general de la aplicación (G100 Base) |
| `$layer-01` | `#262626` | Contenedores principales, tablas de reportes, cards de módulos |
| `$layer-02` | `#393939` | Cards elevadas, elementos anidados, inputs, modales |
| `$layer-03` | `#525252` | Menús desplegables, hovers sobre elementos de nivel 2 |

### Texto y Lectura
| Token Carbon | Hex | Uso |
|---|---|---|
| `$text-primary` | `#f4f4f4` | Títulos, KPIs principales, texto interactivo |
| `$text-secondary` | `#c6c6c6` | Labels de formularios, subtítulos, metadatos |
| `$text-helper` | `#8d8d8d` | Textos de soporte, hints de validación, estados deshabilitados |
| `$text-error` | `#ffb3b8` | Texto de error crítico o estados de alerta negativos |

### Acentos y Estados (Sintaxis Carbon)
| Token | Hex | Uso en SGOS |
|---|---|---|
| `$interactive` | `#d4af37` | **Acento de Marca (Oro):** Enlaces activos, primary actions, CTAs |
| `$support-success` | `#24a148` | Éxito, cargas Getnet correctas, coin-in positivo |
| `$support-error` | `#da1e28` | Errores de validación, diferencias críticas en auditoría COMPS |
| `$support-warning` | `#f1c21b` | Advertencias, alertas pendientes de revisión |
| `$support-info` | `#0043ce` | Información general, logs de carga del sistema |

---

## 2. Tipografía

Carbon utiliza **IBM Plex Sans** como su tipografía nativa para asegurar una legibilidad perfecta en entornos técnicos y datos tabulares.

**Familia principal:** `IBM Plex Sans` (Google Fonts)  
**Fallback:** `system-ui, sans-serif`

| Token Carbon | Weight | Size | Uso en SGOS |
|---|---|---|---|
| `$body-short-01` | 400 | 14px | Texto general, celdas de tablas de reportes, listas |
| `$label-01` | 500 | 12px | Etiquetas de inputs, headers de columnas en tablas |
| `$heading-01` | 600 | 14px | Títulos de secciones secundarias, nombres de cards |
| `$heading-03` | 400 | 20px | Títulos de páginas (Histórico Getnet, COMPS Index) |
| `$code-01` | 400 | 12px | Monospace para IDs de transacciones, logs de carga |

- `line-height`: Ajustado automáticamente por tokens (`1.286` para UI corta, `1.428` para lectura).
- Renderizado: `-webkit-font-smoothing: antialiased;`

---

## 3. Espaciado (Carbon Spacing Scale)

Sistema basado en pasos fijos de la escala de Carbon para garantizar una alineación matemática perfecta en dashboards de control.

| Token Carbon | Valor | Uso típico en Layouts |
|---|---|---|
| `$spacing-01` | 2px | Bordes internos, microajustes de alineación |
| `$spacing-03` | 8px | Espacio entre inputs, separación icono-texto |
| `$spacing-05` | 16px | Padding interno de tablas y formularios estándar |
| `$spacing-07` | 32px | Espacio entre secciones de un dashboard, padding general de la página |
| `$spacing-09` | 48px | Separación de bloques mayores (ej. Login Card o Hero) |

---

## 4. Estructura y Componentes Core

### Layout Base (UI Shell de Carbon)
La estructura web sigue estrictamente el componente **UI Shell** de Carbon, optimizado para aplicaciones de escritorio de alta densidad:

```html
<header class="cds--header">
  <span class="cds--header__name">SGOS [Casino Royale Theme]</span>
  </header>

<aside class="cds--side-nav">
  </aside>

<main class="cds--content">
  <div class="cds--grid">
    {% block content %}{% endblock %}
  </div>
</main>