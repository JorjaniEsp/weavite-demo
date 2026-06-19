import express from 'express';
import weaviate from 'weaviate-client';
import { OpenAI } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 1. Configurar Groq
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1' 
});

app.use(express.json());
app.use(cors());

const rutaVista = path.resolve(__dirname, '../vista');
app.use(express.static(rutaVista));

// Endpoint del contenedor t2v-transformers, ahora expuesto al host 
const TRANSFORMERS_URL = 'http://localhost:8091/vectors';

/**
 * Le pide directamente al contenedor t2v-transformers el embedding
 * de un texto, sin pasar por Weaviate. Esto nos permite mostrar
 * "tu consulta convertida en números" en el frontend.
 */
async function obtenerVectorConsulta(texto) {
  try {
    const respuesta = await fetch(TRANSFORMERS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texto })
    });

    if (!respuesta.ok) {
      console.warn(` t2v-transformers respondió con status ${respuesta.status}`);
      return null;
    }

    const data = await respuesta.json();
    // El endpoint /vectors del contenedor devuelve { text, vector }
    return Array.isArray(data.vector) ? data.vector.slice(0, 5) : null;

  } catch (error) {
    console.warn(' No se pudo obtener el vector de la consulta:', error.message);
    return null; // No rompemos la búsqueda si esto falla
  }
}

// 2. Ruta API Inteligente y Dinámica
app.post('/api/preguntar', async (req, res) => {
  // Recibimos los parámetros del nuevo panel de control web
  const { pregunta, limite = 3, usarIA = true } = req.body;

  if (!pregunta) {
    return res.status(400).json({ error: 'La pregunta es obligatoria.' });
  }

  let client;
  try {
    console.log(`\nConsulta: "${pregunta}" | IA Activada: ${usarIA} | Nodos a buscar: ${limite}`);

    // 3. Conectar localmente a Weaviate 
    client = await weaviate.connectToLocal({
      port: 8090,
      grpcPort: 50060
    });
    
    const miColeccion = client.collections.get('Articulo');

    // NUEVO: Pedimos el vector de la pregunta en paralelo a la búsqueda,
    // para no agregar latencia extra a la demo.
    const vectorConsultaPromise = obtenerVectorConsulta(pregunta);

    // 4. Búsqueda nativa en Weaviate (Sin traducir, usando transformers)
    const resultadoBD = await miColeccion.query.nearText(pregunta, {
      limit: parseInt(limite),
      returnProperties: ['titulo', 'contenido'],
      returnMetadata: ['distance'], // Para la distancia matemática
      includeVector: true // Clave para obtener el arreglo numérico
    });

    const vectorConsulta = await vectorConsultaPromise;

    if (!resultadoBD.objects || resultadoBD.objects.length === 0) {
      await client.close();
      return res.json({ 
        respuesta: "No encontré información relacionada en los documentos indexados de Weaviate.",
        nodos: [],
        vectorConsulta: vectorConsulta
      });
    }

    // 5. Procesar los nodos crudos para el requerimiento "Detrás de escena"
    const nodosRecuperados = resultadoBD.objects.map(obj => {
      // Extraemos el vector (según la versión de la librería, puede venir en obj.vectors.default o obj.vector)
      const vectorCrudo = obj.vectors?.default || obj.vector || [];
      const vectorRecortado = vectorCrudo.slice(0, 5); // Tomamos solo 5 números para la demo visual
      
      return {
        titulo: obj.properties.titulo,
        contenido: obj.properties.contenido,
        distancia: obj.metadata?.distance ? obj.metadata.distance.toFixed(4) : "N/A",
        vector: vectorRecortado
      };
    });

    console.log(`🔍 Se recuperaron ${nodosRecuperados.length} nodos del espacio vectorial.`);

    // 6. PASO GENERATIVO: Solo se ejecuta si el usuario activó la IA
    let respuestaFormateada = null;

    if (usarIA) {
      console.log('🤖 Sintetizando respuesta con Groq...');
      // Concatenamos el contenido de todos los nodos recuperados para dárselo a Groq
      const contextoUnido = nodosRecuperados.map(n => n.contenido).join("\n\n");
      
      const contextoCortado = contextoUnido.length > 4000 
        ? contextoUnido.substring(0, 4000) + "... [Texto truncado]" 
        : contextoUnido;

      const respuestaIA = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant", 
        messages: [
          { 
            role: "system", 
            content: `Eres un asistente analítico estricto. Tu ÚNICA fuente de información es el CONTEXTO RECUPERADO. Respondes siempre en español, sin importar el idioma del contexto.

            REGLA 1 (Relevancia temática, no léxica): Considera que el contexto "responde a la pregunta" si está relacionado por TEMA o SIGNIFICADO, aunque no use las mismas palabras exactas. Ejemplos: "astronautas" coincide con misiones espaciales, tripulación o viajeros del espacio; "pistoleros" coincide con crímenes armados o atracos; "amor" coincide con romance o relaciones. Razona por significado, igual que lo haría una búsqueda semántica.

            REGLA 2 (Fidelidad a los datos): Solo puedes usar hechos que estén literalmente en el CONTEXTO RECUPERADO (títulos, nombres, años, géneros, sinopsis). Nunca inventes datos que no estén ahí.

            REGLA 3 (Cuándo declarar ausencia): Si, aplicando la Regla 1, ningún elemento del contexto se relaciona razonablemente con el tema de la pregunta, responde EXACTAMENTE: "Lo siento, la información solicitada no se encuentra en la base de datos." No la uses si hay alguna coincidencia temática válida, aunque sea parcial.` 
          },
          { 
            role: "user", 
            content: `PREGUNTA: ${pregunta}\n\nCONTEXTO RECUPERADO:\n"${contextoCortado}"` 
          }
        ],
        temperature: 0.1
      });

      respuestaFormateada = respuestaIA.choices[0].message.content;
    }

    // 7. Enviar JSON estructurado al Frontend
    res.json({
      respuesta: respuestaFormateada,
      nodos: nodosRecuperados,
      vectorConsulta: vectorConsulta // NUEVO: pregunta convertida en números
    });

  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).json({ error: `Error interno: ${error.message}` });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

//  Ruta para el catálogo completo 
// Extrae los nodos puros (sin búsqueda semántica, sin Groq) para mostrar
// "el espacio vectorial crudo" en la vista de Catálogo.
app.get('/api/todos', async (req, res) => {
  let client;
  try {
    console.log('\n📂 Solicitando catálogo completo de la colección...');

    client = await weaviate.connectToLocal({
      port: 8090,
      grpcPort: 50060
    });

    const miColeccion = client.collections.get('Articulo');

    // fetchObjects trae los objetos tal cual están almacenados,
    // sin pasar por ninguna búsqueda por similitud.
    const resultadoBD = await miColeccion.query.fetchObjects({
      returnProperties: ['titulo', 'contenido'],
      includeVector: true
    });

    const nodosCompletos = resultadoBD.objects.map(obj => {
      const vectorCrudo = obj.vectors?.default || obj.vector || [];
      return {
        titulo: obj.properties.titulo,
        contenido: obj.properties.contenido,
        vector: vectorCrudo.slice(0, 5)
      };
    });

    console.log(` Catálogo completo: ${nodosCompletos.length} películas.`);

    res.json({ nodos: nodosCompletos });

  } catch (error) {
    console.error('Error al obtener el catálogo completo:', error);
    res.status(500).json({ error: `Error interno: ${error.message}` });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});