import fs from 'fs';
import { execSync } from 'child_process';

// 1. Definir el contenido del docker-compose con los puertos corregidos (8090)
const dockerComposeContent = `version: '3.4'
services:
  weaviate:
    command:
    - --host
    - 0.0.0.0
    - --port
    - '8080'
    - --scheme
    - http
    image: cr.weaviate.io/semitechnologies/weaviate:1.27.0
    ports:
    - 8090:8080
    - 50060:50051
    restart: on-failure:0
    environment:
      CONTEXTIONARY_URL: contextionary:9999
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
      PERSISTENCE_DATA_PATH: '/var/lib/weaviate'
      DEFAULT_VECTORIZER_MODULE: 'text2vec-contextionary'
      ENABLE_MODULES: 'text2vec-contextionary'
      CLUSTER_HOSTNAME: 'node1'
  contextionary:
    image: cr.weaviate.io/semitechnologies/contextionary:en0.16.0-v1.2.1
    ports:
    - 9999:9999
    environment:
      OCCURRENCE_STRATEGY: logtext
`;

console.log('🛠️ Creando archivo docker-compose.yml...');
fs.writeFileSync('docker-compose.yml', dockerComposeContent);

try {
  console.log('🚀 Levantando contenedores en Docker Desktop (Asegúrate de tenerlo abierto)...');
  // Ejecuta el comando de docker directamente desde Node.js
  execSync('docker compose up -d', { stdio: 'inherit' });
  console.log('✅ Servidor de Weaviate corriendo exitosamente en el puerto 8090.');
  
  console.log('\n📌 RECUERDA CONFIGURAR TU EXTENSIÓN DE VS CODE ASÍ:');
  console.log('   - Weaviate HTTP Host: 127.0.0.1');
  console.log('   - Weaviate HTTP Port: 8090');
  console.log('   - Weaviate gRPC Host: 127.0.0.1');
  console.log('   - Weaviate gRPC Port: 50060\n');

} catch (error) {
  console.error('❌ Error al levantar Docker. Verifica que Docker Desktop esté abierto e inténtalo de nuevo.');
}