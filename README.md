# Demostración Busqueda Vectorial Con Weaviate — Netflix RAG

Proyecto del curso **IF0007 – Bases de Datos I**.

Grupo 4 — Base de datos vectorial asignada: **Weaviate**.

## Qué es esto

Un sistema RAG (Retrieval-Augmented Generation) sencillo: una base de datos vectorial
(Weaviate) almacena un set de títulos de Netflix como embeddings. El usuario hace una
pregunta en lenguaje natural, el sistema busca los nodos más cercanos por similitud de
coseno, y opcionalmente le pasa ese contexto a un modelo de lenguaje (Groq / Llama 3.1)
para redactar una respuesta en español.

La interfaz web tiene dos vistas:

- **Búsqueda**: consulta semántica en lenguaje natural, con el vector de la consulta y
  los vectores/distancias de cada resultado visibles ("detrás de escena").
- **Catálogo completo**: muestra los nodos crudos almacenados en la colección, sin
  pasar por búsqueda ni por la IA generativa.

## Requisitos previos

- **Docker Desktop** (corriendo): https://www.docker.com/products/docker-desktop
- **Node.js** 18 o superior: https://nodejs.org
- **Python** 3.10 o superior: https://www.python.org/downloads
- Una API key gratuita de **Groq**: https://console.groq.com

### Clonación

Sigue estos pasos para obtener una copia del proyecto y ejecutarlo en tu computadora:

1. Abre tu terminal.
2. Clona este repositorio ejecutando el siguiente comando:
   ```bash
   git clone https://github.com/JorjaniEsp/weavite-demo.git

## Guía de instalación (en orden)

### 1. Levantar la infraestructura (Docker)

```powershell
docker compose up -d
```

Levanta dos contenedores: `weaviate` (puerto `8090` HTTP / `50060` gRPC) y
`t2v-transformers` (motor de embeddings, puerto `8091`).

Verificá que ambos estén corriendo:

```powershell
docker ps
```

### 2. Instalar dependencias de Python

```powershell
pip install -r requirements.txt
```

### 2.a Posible fallo de pip
En dado caso que pip no funcione, pruebe de la siguiente manera:

```powershell
py -m pip install -r requirements.txt
```

### 3. Cargar los datos (ingesta)

```powershell
python scripts/ingest.py
```

Esto borra y recrea la colección `Articulo`, y carga las películas del CSV
(el límite está definido en la variable `LIMITE_DEMO` dentro del script).

### 4. Instalar dependencias de Node

```powershell
npm install
```

### 5. Levantar el servidor

```powershell
npm start
```

### 6. Abrir la aplicación

http://localhost:3000

## Uso

- **Pestaña Búsqueda**: escribí una pregunta en lenguaje natural (ej. *"películas de
  acción con robos"*), elegí cuántos nodos recuperar, y activá o desactivá la síntesis
  con IA según quieras ver solo los datos crudos o una respuesta redactada.
- **Pestaña Catálogo completo**: muestra todas las películas indexadas con su vector
  almacenado, sin pasar por ninguna búsqueda.

## Paso opcional — Plan de respaldo (sin navegador)

Si durante la demostración el navegador, Node o la conexión a Groq fallan, este script
permite consultar la base de datos vectorial directamente desde la terminal:

```powershell
python scripts/busqueda.py
```
