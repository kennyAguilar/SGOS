# Getnet.md

## Objetivo

Este documento define el tratamiento del archivo Excel descargado desde SGOS para cargar la información de operaciones Getnet en la aplicación SGOS y almacenarla en una base de datos PostgreSQL en Neon.Tech.

La carga debe permitir importar el mismo archivo más de una vez sin duplicar registros, usando un campo único llamado `operacion_uid`.

---

## Archivo de origen

El archivo Excel descargado contiene la información en la hoja:

```text
Sheet1
```

La tabla comienza en la fila 2:

```text
A2:I2 = encabezados
```

Los datos comienzan desde la fila 3.

Encabezados esperados:

| Columna Excel | Campo |
|---|---|
| A | Jornada |
| B | Fecha |
| C | Id Cliente |
| D | Monto |
| E | Voucher |
| F | Slot Attendant |
| G | Validador |
| H | Forma Pago |
| I | Ingreso CAWA |

---

## Campos necesarios para la aplicación

De la tabla original se necesitan principalmente estos campos:

| Campo Excel | Uso en la app |
|---|---|
| Jornada | Fecha operacional de la transacción |
| Monto | Monto de la operación |
| Slot Attendant | Usuario/asistente que realizó la operación |
| Forma Pago | Medio de pago utilizado |

Además, para crear el identificador único de la operación, también se deben leer estos campos:

| Campo Excel | Uso interno |
|---|---|
| Fecha | Parte del identificador único |
| Id Cliente | Se usan los últimos 12 dígitos |
| Voucher | Parte del identificador único |

---

## Tratamiento de fechas

### Campo `Jornada`

En el Excel, el campo `Jornada` viene en formato:

```text
Año-Mes-Día
```

Ejemplo:

```text
2025-04-03
```

Para mostrarlo en la aplicación se debe presentar como:

```text
Día/Mes/Año
```

Ejemplo:

```text
03/04/2025
```

### Recomendación para base de datos

En la base de datos se recomienda guardar `jornada` como tipo `DATE`, no como texto.

La conversión a formato `dd/mm/yyyy` debe hacerse solo para mostrar en pantalla o reportes.

---

## Identificador único de operación

Para evitar duplicados al cargar el Excel en la base de datos, se debe crear el campo:

```text
operacion_uid
```

La combinación definida será:

```text
fecha + últimos 12 dígitos del id_cliente + monto + voucher
```

Formato recomendado:

```text
YYYYMMDDHHMM-ULTIMOS12IDCLIENTE-MONTO-VOUCHER
```

Ejemplo:

```text
202504032202-100794916572-1000-000003
```

Este campo debe ser único en la base de datos.

---

## Tabla en Neon.Tech / PostgreSQL

Nombre recomendado de la tabla:

```text
getnet_transacciones
```

SQL para crear la tabla:

```sql
CREATE TABLE IF NOT EXISTS getnet_transacciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    jornada DATE NOT NULL,
    fecha TIMESTAMP NOT NULL,
    id_cliente TEXT NOT NULL,
    monto NUMERIC(12,0) NOT NULL,
    voucher TEXT NOT NULL,

    slot_attendant TEXT,
    validador TEXT,
    forma_pago TEXT,
    ingreso_cawa TEXT,

    operacion_uid TEXT NOT NULL UNIQUE,

    archivo_origen TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Explicación de campos de la tabla

| Campo BD | Tipo | Descripción |
|---|---|---|
| id | BIGINT | ID interno automático de la base de datos |
| jornada | DATE | Fecha operacional de la transacción |
| fecha | TIMESTAMP | Fecha y hora real de la transacción |
| id_cliente | TEXT | Identificador completo del cliente |
| monto | NUMERIC | Monto de la operación |
| voucher | TEXT | Número de voucher de la operación |
| slot_attendant | TEXT | Usuario o asistente registrado en SGOS |
| validador | TEXT | Usuario validador, si aplica |
| forma_pago | TEXT | Medio de pago, por ejemplo débito |
| ingreso_cawa | TEXT | Código de ingreso CAWA |
| operacion_uid | TEXT | Campo único para evitar duplicados |
| archivo_origen | TEXT | Nombre del archivo Excel importado |
| created_at | TIMESTAMP | Fecha y hora de carga en la base de datos |

---

## Función Python para crear `operacion_uid`

```python
import pandas as pd


def crear_operacion_uid(row):
    """
    Crea un identificador único para cada operación Getnet.

    Formato:
    fecha + últimos 12 dígitos del id_cliente + monto + voucher
    """

    # Fecha con año, mes, día, hora y minuto
    fecha = pd.to_datetime(row["Fecha"], dayfirst=True).strftime("%Y%m%d%H%M")

    # Limpiar Id Cliente y tomar los últimos 12 dígitos
    id_cliente = str(row["Id Cliente"]).replace("'", "").strip()
    ultimos_12 = id_cliente[-12:]

    # Normalizar monto
    monto = int(float(row["Monto"]))

    # Normalizar voucher con 6 dígitos
    voucher = str(row["Voucher"]).replace("'", "").strip().zfill(6)

    return f"{fecha}-{ultimos_12}-{monto}-{voucher}"
```

---

## Lectura del Excel con pandas

Como los encabezados comienzan en la fila 2, se debe leer el archivo usando:

```python
import pandas as pd

ruta_excel = "archivo_getnet.xlsx"

 df = pd.read_excel(
    ruta_excel,
    sheet_name="Sheet1",
    header=1,
    dtype={
        "Id Cliente": str,
        "Voucher": str,
    }
)
```

`header=1` significa que pandas usará la segunda fila del Excel como encabezado.

---

## Limpieza y preparación de datos

```python
# Crear ID único de operación
df["operacion_uid"] = df.apply(crear_operacion_uid, axis=1)

# Normalizar campos principales
df["jornada"] = pd.to_datetime(df["Jornada"]).dt.date
df["fecha"] = pd.to_datetime(df["Fecha"], dayfirst=True)
df["id_cliente"] = df["Id Cliente"].astype(str).str.replace("'", "", regex=False).str.strip()
df["monto"] = df["Monto"].astype(float).astype(int)
df["voucher"] = df["Voucher"].astype(str).str.replace("'", "", regex=False).str.strip().str.zfill(6)
df["slot_attendant"] = df["Slot Attendant"].astype(str).str.strip()
df["validador"] = df["Validador"].astype(str).str.strip()
df["forma_pago"] = df["Forma Pago"].astype(str).str.strip()
df["ingreso_cawa"] = df["Ingreso CAWA"].astype(str).str.strip()
```

---

## Columnas finales para cargar a la base de datos

```python
columnas_finales = [
    "jornada",
    "fecha",
    "id_cliente",
    "monto",
    "voucher",
    "slot_attendant",
    "validador",
    "forma_pago",
    "ingreso_cawa",
    "operacion_uid",
]

df_final = df[columnas_finales]
```

---

## Inserción evitando duplicados

Para evitar duplicar registros, se debe usar:

```sql
ON CONFLICT (operacion_uid) DO NOTHING
```

Ejemplo:

```sql
INSERT INTO getnet_transacciones (
    jornada,
    fecha,
    id_cliente,
    monto,
    voucher,
    slot_attendant,
    validador,
    forma_pago,
    ingreso_cawa,
    operacion_uid,
    archivo_origen
)
VALUES (
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s
)
ON CONFLICT (operacion_uid) DO NOTHING;
```

---

## Ejemplo completo de carga

```python
import pandas as pd
import pg8000.dbapi  # driver del proyecto — NO psycopg2
from pathlib import Path


def crear_operacion_uid(row):
    fecha = pd.to_datetime(row["Fecha"], dayfirst=True).strftime("%Y%m%d%H%M")
    id_cliente = str(row["Id Cliente"]).replace("'", "").strip()
    ultimos_12 = id_cliente[-12:]
    monto = int(float(row["Monto"]))
    voucher = str(row["Voucher"]).replace("'", "").strip().zfill(6)

    return f"{fecha}-{ultimos_12}-{monto}-{voucher}"


def procesar_excel_getnet(ruta_excel):
    ruta_excel = Path(ruta_excel)

    df = pd.read_excel(
        ruta_excel,
        sheet_name="Sheet1",
        header=1,
        dtype={
            "Id Cliente": str,
            "Voucher": str,
        }
    )

    df["operacion_uid"] = df.apply(crear_operacion_uid, axis=1)

    df["jornada"] = pd.to_datetime(df["Jornada"]).dt.date
    df["fecha"] = pd.to_datetime(df["Fecha"], dayfirst=True)
    df["id_cliente"] = df["Id Cliente"].astype(str).str.replace("'", "", regex=False).str.strip()
    df["monto"] = df["Monto"].astype(float).astype(int)
    df["voucher"] = df["Voucher"].astype(str).str.replace("'", "", regex=False).str.strip().str.zfill(6)
    df["slot_attendant"] = df["Slot Attendant"].astype(str).str.strip()
    df["validador"] = df["Validador"].astype(str).str.strip()
    df["forma_pago"] = df["Forma Pago"].astype(str).str.strip()
    df["ingreso_cawa"] = df["Ingreso CAWA"].astype(str).str.strip()
    df["archivo_origen"] = ruta_excel.name

    columnas_finales = [
        "jornada",
        "fecha",
        "id_cliente",
        "monto",
        "voucher",
        "slot_attendant",
        "validador",
        "forma_pago",
        "ingreso_cawa",
        "operacion_uid",
        "archivo_origen",
    ]

    return df[columnas_finales]


def cargar_getnet_a_db(df_final, filename, _get_conn, _put_conn):
    """
    Inserta filas en getnet_transacciones usando pg8000.
    Usa los helpers _get_conn() / _put_conn() definidos en app.py.
    Los placeholders son posicionales (%s), NO nombrados (pg8000 no soporta %(name)s).
    """
    sql = """
    INSERT INTO getnet_transacciones (
        jornada, fecha, id_cliente, monto, voucher,
        slot_attendant, validador, forma_pago, ingreso_cawa,
        operacion_uid, archivo_origen
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (operacion_uid) DO NOTHING
    """

    registros = [
        (
            row["jornada"],
            row["fecha"].to_pydatetime(),
            row["id_cliente"],
            int(row["monto"]),
            row["voucher"],
            row["slot_attendant"],
            row["validador"],
            row["forma_pago"],
            row["ingreso_cawa"],
            row["operacion_uid"],
            filename,
        )
        for _, row in df_final.iterrows()
    ]

    inserted = 0
    conn = _get_conn()
    try:
        cur = conn.cursor()
        for record in registros:
            cur.execute(sql, record)
            inserted += cur.rowcount
        conn.commit()
        cur.close()
    finally:
        _put_conn(conn)

    return {
        "rows_total":    len(registros),
        "rows_inserted": inserted,
        "rows_skipped":  len(registros) - inserted,
    }


# Uso
ruta_excel = "archivo_getnet.xlsx"
df_final = procesar_excel_getnet(ruta_excel)
resultado = cargar_getnet_a_db(df_final, Path(ruta_excel).name, _get_conn, _put_conn)
print(resultado)
# {'rows_total': 850, 'rows_inserted': 850, 'rows_skipped': 0}
```

---

## Resultado esperado en la base de datos

| id | jornada | fecha | id_cliente | monto | voucher | slot_attendant | forma_pago | operacion_uid |
|---:|---|---|---|---:|---|---|---|---|
| 1 | 2025-04-03 | 2025-04-03 22:02 | 301720020100794916572 | 1000 | 000003 | mramirez | Debito | 202504032202-100794916572-1000-000003 |
| 2 | 2025-04-03 | 2025-04-03 22:34 | 301720020100794916572 | 1000 | 000004 | mramirez | Debito | 202504032234-100794916572-1000-000004 |

---

## Regla final

La base de datos debe manejar dos identificadores:

```text
id              = ID interno automático de Neon/PostgreSQL
operacion_uid   = ID único de negocio para evitar duplicados desde el Excel
```

El campo `id` no se calcula manualmente.

El campo `operacion_uid` se calcula antes de insertar cada fila en la base de datos.

