# Comps.md

## Objetivo

Este documento define el tratamiento del archivo Excel **Voucher Complementary / Comps** para cargar la información necesaria en la app SGOS y almacenarla en una base de datos PostgreSQL en Neon.Tech.

**Solo se deben procesar y almacenar los registros cuya columna `Estado` tenga el valor `QUEMADOS`.** Tanto en la lectura del Excel como en la base de datos, cualquier registro con otro estado debe ser descartado/ignorado.

La carga debe permitir importar el mismo archivo más de una vez sin duplicar registros, usando un campo único llamado:

```text
comps_uid
```

---

## Archivo de origen

El archivo Excel corresponde al reporte:

```text
VOUCHER COMPLEMENTARY
```

El archivo contiene filas superiores con título, logo y rango de fechas. La tabla de datos comienza más abajo.

En el archivo revisado:

```text
Fila 8 = encabezados
Fila 9 = inicio de los datos
```

En pandas se debe leer usando:

```python
header=7
```

Porque pandas cuenta las filas desde 0.

---

## Encabezados principales del Excel

El reporte contiene columnas como:

| Campo Excel | Descripción |
|---|---|
| Consumo Id | Identificador del consumo/voucher |
| Fecha Real | Fecha y hora real del movimiento |
| Fecha Jornada | Fecha operacional del casino |
| Cliente Id | Identificador del cliente |
| Nombre Cliente | Nombre del cliente |
| Cat Id | ID de categoría |
| Descripcion Cat | Categoría del producto |
| Producto Id | ID del producto |
| Descripcion Prod | Producto consumido |
| Complementary | Monto complementario |
| Consumo | Monto de consumo |
| Micros | Monto registrado en Micros |
| Qr | Código QR del voucher |
| Tipo | Tipo de voucher |
| Estado | Estado del voucher |
| Fecha Estado | Fecha y hora del estado |
| Usuario Id | ID del usuario |
| Nombre | Nombre del usuario |

---

## Columnas finales para cargar a Neon.Tech

Para la tabla de Comps, solo se cargarán las siguientes columnas operativas:

| Campo Excel | Campo en base de datos | Tipo recomendado |
|---|---|---|
| Fecha Jornada | fecha_jornada | DATE |
| Cliente Id | cliente_id | TEXT |
| Nombre Cliente | nombre_cliente | TEXT |
| Descripcion Cat | descripcion_cat | TEXT |
| Descripcion Prod | descripcion_prod | TEXT |
| Micros | micros | NUMERIC(12,0) |
| Estado | estado | TEXT |
| Usuario Id | usuario_id | TEXT |
| Nombre | nombre_usuario | TEXT |

Además, para evitar duplicados, se recomienda cargar también:

| Campo | Uso |
|---|---|
| id | ID interno automático de la base de datos |
| comps_uid | ID único de negocio para detectar duplicados |
| consumo_id | Campo de apoyo proveniente del Excel |
| archivo_origen | Nombre del archivo cargado |
| created_at | Fecha y hora de carga en la base de datos |

---

## Identificador único de Comps

Para evitar duplicados, el campo recomendado es:

```text
comps_uid
```

La combinación recomendada será:

```text
Fecha Jornada + Consumo Id + Cliente Id
```

Formato recomendado:

```text
COMPS-YYYYMMDD-CONSUMOID-CLIENTEID
```

Ejemplo:

```text
COMPS-20260101-229810-301720020100081038029
```

La razón de usar `Consumo Id` es que este campo identifica el consumo/voucher dentro del reporte. Al combinarlo con `Fecha Jornada` y `Cliente Id`, el identificador queda más trazable y seguro para cargas mensuales.

---

## Tabla recomendada en Neon.Tech / PostgreSQL

Nombre recomendado:

```text
comps_transacciones
```

SQL recomendado:

```sql
CREATE TABLE IF NOT EXISTS comps_transacciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    comps_uid TEXT NOT NULL UNIQUE,
    consumo_id TEXT NOT NULL,

    fecha_jornada DATE NOT NULL,
    cliente_id TEXT,
    nombre_cliente TEXT,
    descripcion_cat TEXT,
    descripcion_prod TEXT,
    micros NUMERIC(12,0),
    estado TEXT,
    usuario_id TEXT,
    nombre_usuario TEXT,

    archivo_origen TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

Si la tabla ya existe y el campo `micros` está creado como `double precision`, se puede mantener. Sin embargo, para montos de dinero se recomienda `NUMERIC(12,0)`.

---

## Restricción única

El campo `comps_uid` debe ser único:

```sql
ALTER TABLE comps_transacciones
ADD CONSTRAINT uq_comps_uid UNIQUE (comps_uid);
```

Si la tabla fue creada usando el SQL anterior, esta restricción ya queda incluida aquí:

```sql
comps_uid TEXT NOT NULL UNIQUE
```

---

## Lectura del Excel con pandas

```python
import pandas as pd
from pathlib import Path

ruta_excel = "RrtIformeGeneralENERO2026.xlsx"

# La fila 8 del Excel contiene los encabezados.
# En pandas se usa header=7 porque el conteo parte desde 0.
df = pd.read_excel(
    ruta_excel,
    sheet_name="RrtIformeGeneral",
    header=7,
    dtype={
        "Consumo Id": str,
        "Cliente Id": str,
        "Usuario Id": str,
    }
)
```

---

## Función para crear `comps_uid`

```python
import pandas as pd


def limpiar_texto(valor):
    if pd.isna(valor):
        return ""

    return str(valor).replace("'", "").strip()


def crear_comps_uid(row):
    """
    Crea el identificador único para cada registro de Comps.

    Formato:
    COMPS-YYYYMMDD-CONSUMOID-CLIENTEID
    """

    fecha_jornada = pd.to_datetime(row["Fecha Jornada"], dayfirst=True).strftime("%Y%m%d")
    consumo_id = limpiar_texto(row["Consumo Id"])
    cliente_id = limpiar_texto(row["Cliente Id"])

    return f"COMPS-{fecha_jornada}-{consumo_id}-{cliente_id}"
```

---

## Preparación de datos

```python
# Filtrar solo registros QUEMADOS (requerimiento de negocio)
df = df[df["Estado"].astype(str).str.strip().str.upper() == "QUEMADOS"].copy()

# Crear campo único
df["comps_uid"] = df.apply(crear_comps_uid, axis=1)

# Normalizar campos para base de datos
df["consumo_id"] = df["Consumo Id"].astype(str).str.replace("'", "", regex=False).str.strip()
df["fecha_jornada"] = pd.to_datetime(df["Fecha Jornada"], dayfirst=True).dt.date
df["cliente_id"] = df["Cliente Id"].astype(str).str.replace("'", "", regex=False).str.strip()
df["nombre_cliente"] = df["Nombre Cliente"].astype(str).str.strip()
df["descripcion_cat"] = df["Descripcion Cat"].astype(str).str.strip()
df["descripcion_prod"] = df["Descripcion Prod"].astype(str).str.strip()
df["micros"] = df["Micros"].fillna(0).astype(float).astype(int)
df["estado"] = df["Estado"].astype(str).str.strip()
df["usuario_id"] = df["Usuario Id"].astype(str).str.replace("'", "", regex=False).str.strip()
df["nombre_usuario"] = df["Nombre"].astype(str).str.strip()
df["archivo_origen"] = Path(ruta_excel).name
```

---

## Columnas finales para cargar

```python
columnas_finales = [
    "comps_uid",
    "consumo_id",
    "fecha_jornada",
    "cliente_id",
    "nombre_cliente",
    "descripcion_cat",
    "descripcion_prod",
    "micros",
    "estado",
    "usuario_id",
    "nombre_usuario",
    "archivo_origen",
]

df_final = df[columnas_finales]
```

---

## Inserción evitando duplicados

Para evitar que el mismo archivo o los mismos registros se carguen más de una vez, se debe usar:

```sql
ON CONFLICT (comps_uid) DO NOTHING
```

Ejemplo SQL:

```sql
INSERT INTO comps_transacciones (
    comps_uid,
    consumo_id,
    fecha_jornada,
    cliente_id,
    nombre_cliente,
    descripcion_cat,
    descripcion_prod,
    micros,
    estado,
    usuario_id,
    nombre_usuario,
    archivo_origen
)
VALUES (
    %(comps_uid)s,
    %(consumo_id)s,
    %(fecha_jornada)s,
    %(cliente_id)s,
    %(nombre_cliente)s,
    %(descripcion_cat)s,
    %(descripcion_prod)s,
    %(micros)s,
    %(estado)s,
    %(usuario_id)s,
    %(nombre_usuario)s,
    %(archivo_origen)s
)
ON CONFLICT (comps_uid) DO NOTHING;
```

---

## Ejemplo completo de procesamiento

```python
import pandas as pd
from pathlib import Path


def limpiar_texto(valor):
    if pd.isna(valor):
        return ""

    return str(valor).replace("'", "").strip()


def crear_comps_uid(row):
    fecha_jornada = pd.to_datetime(row["Fecha Jornada"], dayfirst=True).strftime("%Y%m%d")
    consumo_id = limpiar_texto(row["Consumo Id"])
    cliente_id = limpiar_texto(row["Cliente Id"])

    return f"COMPS-{fecha_jornada}-{consumo_id}-{cliente_id}"


def procesar_excel_comps(ruta_excel):
    ruta_excel = Path(ruta_excel)

    df = pd.read_excel(
        ruta_excel,
        sheet_name="RrtIformeGeneral",
        header=7,
        dtype={
            "Consumo Id": str,
            "Cliente Id": str,
            "Usuario Id": str,
        }
    )

    # Filtrar solo registros QUEMADOS (requerimiento de negocio)
    df = df[df["Estado"].astype(str).str.strip().str.upper() == "QUEMADOS"].copy()

    df["comps_uid"] = df.apply(crear_comps_uid, axis=1)

    df["consumo_id"] = df["Consumo Id"].astype(str).str.replace("'", "", regex=False).str.strip()
    df["fecha_jornada"] = pd.to_datetime(df["Fecha Jornada"], dayfirst=True).dt.date
    df["cliente_id"] = df["Cliente Id"].astype(str).str.replace("'", "", regex=False).str.strip()
    df["nombre_cliente"] = df["Nombre Cliente"].astype(str).str.strip()
    df["descripcion_cat"] = df["Descripcion Cat"].astype(str).str.strip()
    df["descripcion_prod"] = df["Descripcion Prod"].astype(str).str.strip()
    df["micros"] = df["Micros"].fillna(0).astype(float).astype(int)
    df["estado"] = df["Estado"].astype(str).str.strip()
    df["usuario_id"] = df["Usuario Id"].astype(str).str.replace("'", "", regex=False).str.strip()
    df["nombre_usuario"] = df["Nombre"].astype(str).str.strip()
    df["archivo_origen"] = ruta_excel.name

    columnas_finales = [
        "comps_uid",
        "consumo_id",
        "fecha_jornada",
        "cliente_id",
        "nombre_cliente",
        "descripcion_cat",
        "descripcion_prod",
        "micros",
        "estado",
        "usuario_id",
        "nombre_usuario",
        "archivo_origen",
    ]

    return df[columnas_finales]
```

---

## Resultado esperado en Neon.Tech

| id | comps_uid | consumo_id | fecha_jornada | cliente_id | nombre_cliente | descripcion_cat | descripcion_prod | micros | estado | usuario_id | nombre_usuario |
|---:|---|---|---|---|---|---|---|---:|---|---|---|
| 1 | COMPS-20260101-229810-301720020100081038029 | 229810 | 2026-01-01 | 301720020100081038029 | VIVIANA PAZ RIVAS AHERN | BEBIDAS | Monster Energy | 4000 | QUEMADO | 405051 |  |
| 2 | COMPS-20260101-229811-301720020100028820160 | 229811 | 2026-01-01 | 301720020100028820160 | MARIA SUSANA MACHUCA TAMAYO | COCKTELERIA | Daiquiri Sabores | 7500 | VALIDO | 225 | Marcelo Suarez |

---

## Filtro obligatorio por Estado

Tanto en la lectura del Excel como en cualquier consulta a la base de datos, **solo se consideran registros con `Estado = 'QUEMADOS'`**.

En pandas:

```python
df = df[df["Estado"].astype(str).str.strip().str.upper() == "QUEMADOS"].copy()
```

En SQL (consultas a `comps_transacciones`):

```sql
SELECT * FROM comps_transacciones
WHERE UPPER(TRIM(estado)) = 'QUEMADOS';
```

---

## Regla final

La base de datos debe manejar dos identificadores:

```text
id         = ID interno automático de Neon/PostgreSQL
comps_uid  = ID único de negocio para evitar duplicados desde el Excel
```

El campo `id` no se calcula manualmente.

El campo `comps_uid` se calcula antes de insertar cada fila en la base de datos.

Para este reporte, la combinación recomendada es:

```text
COMPS + Fecha Jornada + Consumo Id + Cliente Id
```

