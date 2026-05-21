# **Protocolo de Gestión de Datos: Excel \<-\> Neo.Tech**

Este documento establece las reglas maestras para el procesamiento, carga y descarga de datos entre archivos Excel y la base de datos **Neo.Tech**.

## **1\. Archivo: SGOS-PREMIOS**

### **1.1 Configuración de Origen e Identificación**

* **Nombre del archivo fuente:** SGOS-Premios (proveniente de la App del Casino).  
* **Rango de encabezado:** El encabezado real se encuentra en el rango A2:M2. Los datos comienzan en la fila 3\.  
* **Tabla de destino en Neo.Tech:** SGOS-PREMIOS.

### **1.2 Mapeo de Columnas (Selección Crítica)**

Solo se deben procesar y cargar las siguientes columnas hacia la base de datos:

| Columna Excel (Origen) | Columna BD (Destino) | Tipo de Dato | Observación |
| :---- | :---- | :---- | :---- |
| Fecha | Fecha\_Original | DateTime | Formato original con hora. |
| (Cálculo de Jornada) | Jornada\_Contable | Date | Basado en regla de 08:00 AM. |
| Máquina | ID\_Maquina | Integer | Identificador de la unidad. |
| Cliente | ID\_Cliente | **String** | ID alfanumérico limpio (sin 'x'). |
| Transferencia Final | Monto\_Final | Decimal | Valor neto pagado. |
| Slot Attendant | Usuario\_Attendant | String | Nombre del usuario que valida. |
| Tipo de Pago | Categoria\_Pago | String | Clasificación del premio. |

### **1.3 Reglas de Transformación y Negocio**

#### **A. Lógica de Jornada Diaria (Corte 08:00 AM)**

La Jornada\_Contable debe calcularse para que el día operativo cierre a las 07:59:59 AM del día siguiente:

* **Regla de Cálculo:**  
  * Si la hora de la transacción está entre las **00:00:00 y las 07:59:59**, la Jornada\_Contable es igual a la Fecha \- 1 día.  
  * Si la hora de la transacción es igual o posterior a las **08:00:00**, la Jornada\_Contable es igual a la Fecha.  
* **Ejemplo:** Una transacción del 02-01-2025 05:30 pertenece a la jornada del 01-01-2025.

#### **B. Limpieza del Campo "Cliente"**

* **Tratamiento de Cadena:** Los datos en la columna "Cliente" vienen con una "x" al principio y al final (Ej: x30172...x).  
* **Acción Obligatoria:** Eliminar el primer y último carácter ("x") antes de guardar en la base de datos.  
* **Formato:** Mantener siempre como **Texto** (String) para preservar ceros a la izquierda.

## **2\. Instrucciones para la IA**

### **Al Subir Datos (Upload)**

1. **Validación:** Confirmar que el encabezado está en la fila 2\.  
2. **Transformación:** Aplicar la lógica de jornada y limpieza de "x" en IDs de cliente simultáneamente.  
3. **Carga:** Insertar solo las columnas mapeadas en la tabla SGOS-PREMIOS.

### **Al Descargar Datos (Export)**

1. **Formato de Archivo:** Generar siempre .xlsx.  
2. **Preservación de Datos:**  
   * La columna Cliente **debe** tener formato de celda de "Texto" (@ en Excel) para evitar que se convierta a notación científica.  
   * La columna Jornada\_Contable debe mostrarse como DD-MM-YYYY.  
   * La columna Monto\_Final debe exportarse con formato contable o numérico sin decimales.  
3. **Nombre del Archivo:** Reporte\_SGOS\_PREMIOS\_YYYYMMDD.xlsx.