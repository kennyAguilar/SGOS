# **📊 SGOS Reportes \- Design System**

Este documento establece los lineamientos visuales y de experiencia de usuario (UX) para el proyecto **SGOS Reportes**. El diseño está optimizado para entornos de análisis de datos intensivos, priorizando la legibilidad y la reducción de la fatiga visual.

## **🌓 Concepto: "Deep Slate" (Dark Mode)**

Se ha seleccionado una paleta de colores basada en tonalidades de gris oscuro y azul profundo para garantizar un contraste suave pero efectivo, inspirado en el esquema de color de herramientas profesionales como GitHub y VS Code.

### **🎨 Paleta de Colores**

| Aplicación | Color Hex | Propósito |
| :---- | :---- | :---- |
| **Fondo Base** | \#0D1117 | Fondo principal de la aplicación |
| **Superficie** | \#161B22 | Tarjetas, tablas y contenedores secundarios |
| **Bordes** | \#30363D | Divisiones, separadores y bordes de celdas |
| **Texto Primario** | \#C9D1D9 | Títulos y contenido de lectura principal |
| **Texto Secundario** | \#8B949E | Metadatos, etiquetas y leyendas |
| **Acento (Acción)** | \#58A6FF | Botones primarios, enlaces y estados activos |
| **Éxito (Excel)** | \#238636 | Botón de exportación y validaciones correctas |
| **Alerta (Error)** | \#F85149 | Discrepancias críticas (Diferencias SRW vs SGOS) |

## **🔡 Tipografía y Jerarquía**

En un sistema de reportes financieros y operativos, la precisión de los números es vital. Por ello, la estrategia tipográfica es híbrida:

1. **Interfaz UI:** Inter o Segoe UI (Sans-serif).  
   * *Uso:* Menús, encabezados de sección y navegación.  
2. **Cifras y Datos (Reportes):** Roboto Mono o JetBrains Mono.  
   * **¿Por qué?** Las fuentes monoespaciadas aseguran que cada dígito ocupe el mismo espacio horizontal. Esto permite que los puntos decimales y las comas se alineen verticalmente, facilitando la auditoría visual rápida de montos.  
   * *Ejemplo:*  
     $1,240.50  
     $  980.00

## **📐 Componentes Perfeccionados**

### **1\. Tablas de Datos (Data Grids)**

* **Hover State:** Las filas deben resaltar sutilmente con el color \#1F242C para evitar que el usuario pierda la línea de lectura en reportes largos.  
* **Zebra Striping:** Aplicar un fondo ligeramente diferente (\#161B22) a las filas pares para mejorar la diferenciación visual sin saturar la pantalla.  
* **Sticky Headers:** Los encabezados deben permanecer fijos al hacer scroll para no perder el contexto de las columnas.

### **2\. Estados de Validación (QA)**

Cuando el sistema compare datos entre **SRW** y **SGOS**, los estilos deben comunicar el estado de la información:

* **Coincidencia Exacta:** Texto en color de éxito (\#238636).  
* **Diferencia \< 1%:** Texto en Naranja (\#D29922) \- Requiere atención.  
* **Diferencia \> 1%:** Fondo en Rojo tenue con borde brillante \- Error crítico de cuadratura.

### **3\. Botonera de Acción**

El botón de **"Exportar a Excel"** debe ser el elemento con mayor peso visual fuera de la tabla, utilizando el verde institucional de las hojas de cálculo para una asociación cognitiva rápida.

## **💡 Sugerencias de Perfeccionamiento UX**

1. **Skeleton Screens:** Mientras el sistema procesa los datos de los servidores, muestra siluetas de tablas en lugar de un icono de carga genérico.  
2. **Filtros Colapsables:** Dado que el reporte general maneja múltiples variables (Salas, Fechas, Máquinas), utiliza un panel lateral que pueda ocultarse para maximizar el área de datos.  
3. **Tooltips de Datos:** Al pasar el cursor sobre un monto total, mostrar un pequeño desglose (SRW vs SGOS) para transparencia inmediata.

*Diseño generado para la optimización de reportes operativos \- v1.0*