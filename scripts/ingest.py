import csv
import weaviate
import weaviate.classes as wvc

# Conexión exclusiva a los puertos locales
client = weaviate.connect_to_local(port=8090, grpc_port=50060)

try:
    nombre_coleccion = "Articulo"
    
    if client.collections.exists(nombre_coleccion):
        client.collections.delete(nombre_coleccion)
        print(f"🗑️ Colección antigua '{nombre_coleccion}' eliminada.")

    # Creación de la colección (Ignorar el DeprecationWarning amarillo)
    mi_coleccion = client.collections.create(
        name=nombre_coleccion,
        vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_transformers(),
        properties=[
            wvc.config.Property(name="titulo", data_type=wvc.config.DataType.TEXT),
            wvc.config.Property(name="contenido", data_type=wvc.config.DataType.TEXT)
        ]
    )
    print(f"Colección '{nombre_coleccion}' re-creada.")

    archivo_csv = "datos/netflix_titles_10_rows.csv"  
    contador_exito = 0
    contador_errores = 0

    print(f"Iniciando indexación masiva controlada (Modo Seguro CPU)...")

    # LA SOLUCIÓN: Lotes fijos de 20 en 20, con 1 sola petición concurrente a la vez.
    with mi_coleccion.batch.fixed_size(batch_size=20, concurrent_requests=1) as batch:
        with open(archivo_csv, mode="r", encoding="utf-8") as file:
            lector = csv.reader(file)
            next(lector) # Saltar la línea de encabezados
            
            for num_linea, fila in enumerate(lector, start=2):
                if len(fila) == 12:
                    tipo = fila[1].strip()
                    titulo = fila[2].strip()
                    director = fila[3].strip()
                    elenco = fila[4].strip()
                    fecha_agregada = fila[6].strip()
                    anio = fila[7].strip()
                    genero = fila[10].strip()
                    descripcion = fila[11].strip()
                    
                    info_extra = ""
                    if director:
                        info_extra += f" Dirigida por {director}."
                    if elenco:
                        info_extra += f" El elenco incluye a: {elenco}."
                    if fecha_agregada:
                        info_extra += f" Se agregó a la plataforma el {fecha_agregada}."

                    contenido_estructurado = f"{tipo} titulada '{titulo}' del año {anio}.{info_extra} Género: {genero}. Sinopsis: {descripcion}"
                    
                    if titulo and descripcion:
                        try:
                            batch.add_object(properties={
                                "titulo": titulo,
                                "contenido": contenido_estructurado
                            })
                            contador_exito += 1
                            
                            # Imprimir progreso
                            if contador_exito % 50 == 0:
                                print(f"⏳ Vectorizando... Llevamos {contador_exito} películas.")
                                
                            # EL FRENO AUTOMÁTICO PARA LA DEMO
                            if contador_exito >= 200:
                                print("Límite estratégico de 800 registros alcanzado.")
                                break # Rompe el ciclo y termina la ingesta
                                
                        except Exception:
                            contador_errores += 1
                else:
                    contador_errores += 1
            
                # También debemos romper el ciclo principal de lectura del archivo
                if contador_exito >= 200:
                    break

    print("\n" + "="*50)
    print("RESUMEN DE LA INGESTA ENRIQUECIDA:")
    print(f"Películas indexadas: {contador_exito}")
    print(f"Filas descartadas: {contador_errores}")
    print("="*50)

finally:
    client.close()
    print("Conexión con Weaviate cerrada.")