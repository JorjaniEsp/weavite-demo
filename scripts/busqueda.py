import weaviate
import weaviate.classes as wvc

# 1. Conexión directa al motor local
client = weaviate.connect_to_local(port=8090, grpc_port=50060)

try:
    mi_coleccion = client.collections.get("Articulo")

    
    print("Escribe tu consulta (o presiona Enter con la línea vacía para salir).")

    while True:
        # 3. Captura interactiva
        consulta = input("\n¿Qué quieres buscar?: ")
        
        if not consulta.strip():
            print("Cerrando el buscador de seguridad. ¡Éxitos en la presentación!")
            break

        print("Calculando distancias en el espacio vectorial...\n")

        # 4. Búsqueda semántica pura en Weaviate
        resultado = mi_coleccion.query.near_text(
            query=consulta,
            limit=2, # Traemos los 2 nodos más cercanos
            return_metadata=wvc.query.MetadataQuery(distance=True),
            include_vector=True # Fundamental para el punto 3 de la rúbrica
        )

        if not resultado.objects:
            print("No se encontraron coincidencias en la base de datos.")
            continue

        # 5. Despliegue de resultados y el "detrás de escena"
        for i, obj in enumerate(resultado.objects, 1):
            print(f"--- RESULTADO {i} ---")
            print(f"Título: {obj.properties['titulo']}")
            print(f"Contexto: {obj.properties['contenido']}")
            
            # La distancia matemática (más cerca a 0.0 es mejor coincidencia)
            print(f"Distancia de Coseno: {obj.metadata.distance:.4f}")
            
            # Extracción del arreglo numérico 
            vector_crudo = obj.vector.get("default")
            if vector_crudo:
                # Mostramos solo los primeros 5 flotantes para no inundar la terminal
                print(f"Vector Interno: [{vector_crudo[0]:.4f}, {vector_crudo[1]:.4f}, {vector_crudo[2]:.4f}, {vector_crudo[3]:.4f}, {vector_crudo[4]:.4f} ...]")
            print("-" * 60)

except Exception as e:
    print(f"Ocurrió un error de conexión: {e}")

finally:
    # 6. Cierre seguro
    client.close()