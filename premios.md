# Premios.md

## Objetivo

Este documento define el tratamiento inicial del archivo Excel de **Premios** para ser cargado en la app SGOS.

El primer tratamiento necesario es crear una columna nueva llamada:

```text
Jornada
```

Esta columna se debe calcular a partir del campo:

```text
Fecha
```

---

## Archivo de origen

El archivo Excel contiene la información en la hoja correspondiente del reporte de Premios.

La tabla comienza en la fila 2:

```text
A2:M2 = encabezados
```

Los datos comienzan desde la fila 3.

Encabezados esperados:

| Columna Excel | Campo |
|---|---|
| A | Fecha |
| B | Máquina |
| C | ID Mensaje |
| D | Cliente |
| E | Monto Transferido |
| F | Propina |
| G | Transferencia Final |
| H | Slot Attendant |
| I | Monto Slot Atten. |
| J | Validador |
| K | Monto Validador |
| L | Tipo de Pago |
| M | Ingreso CAWA |

---

## Regla de Jornada

La jornada operacional no corresponde exactamente al día calendario.

La jornada comienza a las:

```text
10:00
```

Y termina a las:

```text
09:00 del día siguiente
```

Se usa formato horario militar de 24 horas.

---

## Lógica para calcular Jornada

La regla es:

```text
Si la hora de Fecha es menor a 10:00, la Jornada corresponde al día anterior.
Si la hora de Fecha es igual o mayor a 10:00, la Jornada corresponde al mismo día.
```

Ejemplos:

| Fecha original | Hora | Jornada calculada |
|---|---:|---|
| 01-01-2025 12:50 | 12:50 | 01-01-2025 |
| 01-01-2025 17:14 | 17:14 | 01-01-2025 |
| 02-01-2025 00:30 | 00:30 | 01-01-2025 |
| 02-01-2025 08:59 | 08:59 | 01-01-2025 |
| 02-01-2025 09:00 | 09:00 | 01-01-2025 |
| 02-01-2025 10:00 | 10:00 | 02-01-2025 |

---

## Importante sobre el límite de las 09:00

Como la jornada termina a las 09:00 del día siguiente, toda operación entre:

```text
00:00 y 09:00
```

pertenece a la jornada del día anterior.

Desde las:

```text
10:00
```

comienza una nueva jornada.

---

## Fórmula en Excel

Si el campo `Fecha` está en la celda `A3`, se puede crear la columna `Jornada` con esta fórmula:

```excel
=SI(HORA(A3)<10;ENTERO(A3)-1;ENTERO(A3))
```

Luego se debe dar formato de fecha a la celda:

```text
dd-mm-aaaa
```

O también:

```text
dd/mm/aaaa
```

---

## Versión recomendada en Python con pandas

Para la app SGOS, se recomienda calcular la jornada en Python antes de cargar los datos a la base de datos.

```python
import pandas as pd


def calcular_jornada(fecha):
    """
    Calcula la jornada operacional.

    Regla:
    - Desde las 10:00 hasta las 23:59 corresponde al mismo día.
    - Desde las 00:00 hasta las 09:59 corresponde al día anterior.
    """

    fecha = pd.to_datetime(fecha, dayfirst=True)

    if fecha.hour < 10:
        return (fecha - pd.Timedelta(days=1)).date()

    return fecha.date()
```

---

## Aplicar la Jornada al DataFrame

```python
# Leer Excel
 df = pd.read_excel(
    ruta_excel,
    sheet_name="Sheet1"
)

# Convertir Fecha a datetime
df["Fecha"] = pd.to_datetime(df["Fecha"], dayfirst=True)

# Crear nueva columna Jornada
df["Jornada"] = df["Fecha"].apply(calcular_jornada)
```

---

## Formato recomendado para guardar en base de datos

En la base de datos, la columna `jornada` debe guardarse como tipo:

```sql
DATE
```

No se recomienda guardar la jornada como texto.

Para mostrarla en pantalla, reportes o Excel, se puede formatear como:

```text
dd/mm/yyyy
```

---

## Columnas finales para cargar a Neon.Tech

Del Excel de Premios, solo se deben cargar a la base de datos las siguientes columnas:

| Campo en Excel | Campo en base de datos | Tipo recomendado |
|---|---|---|
| Fecha | fecha | TIMESTAMP |
| Jornada | jornada | DATE |
| Cliente | cliente | TEXT |
| Transferencia Final | transferencia_final | NUMERIC(12,0) |
| Slot Attendant | slot_attendant | TEXT |
| Tipo de Pago | tipo_pago | TEXT |

> Nota: en el Excel el campo correcto es `Slot Attendant`. Si aparece escrito como `Slot Attendadnt`, se debe corregir el nombre antes de procesar.

---

## Tabla recomendada en Neon.Tech / PostgreSQL

Nombre recomendado:

```text
premios_transacciones
```

SQL pa## Ejemplo de resultado esperado

| Fecha | Jornada | Cliente | Transferencia Final | Slot Attendant | Tipo de Pago |
|---|---|---|---:|---|---|
| 01-01-2025 12:50 | 01-01-2025 | xATED ALWAYS AS IDENTITY PRIMARY KEY,

    fecha TIMESTAMP NOT NULL,
    jornada DATE NOT NULL,
    cliente TEXT NOT NULL,
    transferencia_final NUMERIC(12,0) NOT NULL,
    slot_attendant TEXT,
    tipo_pago TEXT,

    archivo_origen TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Preparación de columnas finales en Python

Después de calcular la columna `Jornada`, se debe dejar un DataFrame final solo con las columnas necesarias para Neon.Tech:

```python
columnas_finales = [
    "fecha",
    "jornada",
    "cliente",
    "transferencia_final",
    "slot_attendant",
    "tipo_pago",
]

# Renombrar columnas del Excel al formato usado en base de datos
df_final = df.rename(columns={
    "Fecha": "fecha",
    "Jornada": "jornada",
    "Cliente": "cliente",
    "Transferencia Final": "transferencia_final",
    "Slot Attendant": "slot_attendant",
    "Tipo de Pago": "tipo_pago",
})

# Mantener solo las columnas que serán cargadas a Neon.Tech
df_final = df_final[columnas_finales]
```

---

## Inserción en Neon.Tech

```sql
INSERT INTO premios_transacciones (
    fecha,
    jornada,
    cliente,
    transferencia_final,
    slot_attendant,
    tipo_pago,
    archivo_origen
)
VALUES (
    %(fecha)s,
    %(jornada)s,
    %(cliente)s,
    %(transferencia_final)s,
    %(slot_attendant)s,
    %(tipo_pago)s,
    %(archivo_origen)s
);
```

---

## Ejemplo de resultado esperado

| Fecha | Jornada | Máquina | Cliente | Monto Transferido | Tipo de Pago |
|---|---|---|---|---:|---|
| 01-01-2025 12:50 | 01-01-2025 | 300751 | x30172002010062550408x | 1000080 | Progressive Jackpot HP |
| 02-01-2025 00:30 | 01-01-2025 | 300623 | x30172002010103449213x | 48970 | MDC Purse Clear |
| 02-01-2025 09:00 | 01-01-2025 | 300017 | x30172002010103450862x | 6050 | MDC Purse Clear |
| 02-01-2025 10:00 | 02-01-2025 | 300018 | x30172002010017987622x | 5000 | MDC Purse Clear |

---

## Regla final

La columna `Jornada` se calcula siempre desde la columna `Fecha`.

```text
Fecha >= 10:00  → Jornada del mismo día
Fecha < 10:00   → Jornada del día anterior
```

Esta regla permite agrupar correctamente las operaciones según la jornada operacional del casino y no solamente según el día calendario.

