// ============== ELEMENTOS ==============
const tabBusqueda = document.getElementById('tabBusqueda');
const tabCatalogo = document.getElementById('tabCatalogo');
const vistaBusqueda = document.getElementById('vistaBusqueda');
const vistaCatalogo = document.getElementById('vistaCatalogo');

document.getElementById('btnEnviar').addEventListener('click', enviarPregunta);
document.getElementById('btnLimpiar').addEventListener('click', limpiarBusqueda);
document.getElementById('preguntaInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') enviarPregunta();
});

tabBusqueda.addEventListener('click', () => cambiarVista('busqueda'));
tabCatalogo.addEventListener('click', () => cambiarVista('catalogo'));

let catalogoCargado = false; // evita volver a pedir el catálogo si ya lo tenemos

function cambiarVista(vista) {
    const esBusqueda = vista === 'busqueda';

    tabBusqueda.classList.toggle('is-activo', esBusqueda);
    tabCatalogo.classList.toggle('is-activo', !esBusqueda);
    tabBusqueda.setAttribute('aria-selected', String(esBusqueda));
    tabCatalogo.setAttribute('aria-selected', String(!esBusqueda));

    vistaBusqueda.hidden = !esBusqueda;
    vistaCatalogo.hidden = esBusqueda;

    if (!esBusqueda && !catalogoCargado) {
        cargarCatalogo();
    }
}

async function enviarPregunta() {
    const input = document.getElementById('preguntaInput');
    const pregunta = input.value.trim();

    const usarIA = document.getElementById('checkIA').checked;
    const limite = document.getElementById('selectLimite').value;

    if (!pregunta) return;

    const loading = document.getElementById('loading');
    const resultadoBox = document.getElementById('resultadoBox');

    loading.style.display = 'block';
    resultadoBox.style.display = 'none';
    resultadoBox.innerHTML = '';

    try {
        const response = await fetch('http://localhost:3000/api/preguntar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pregunta: pregunta,
                limite: limite,
                usarIA: usarIA
            })
        });

        const data = await response.json();

        if (data.error) {
            resultadoBox.innerHTML = `
                <div class="nodo-db" style="border-left-color: #ff6b6b;">
                    <h4 style="color: #ff6b6b;">Error</h4>
                    <p>${escaparHTML(data.error)}</p>
                </div>`;
        } else {
            let htmlRender = "";

            // 1. Vector de la consulta (tu pregunta convertida en números)
            if (data.vectorConsulta && data.vectorConsulta.length > 0) {
                htmlRender += `
                    <div class="caja-consulta">
                        <h3>Tu consulta vectorizada</h3>
                        <p class="texto-pregunta">"${escaparHTML(pregunta)}"</p>
                        <div class="vector-linea">[${data.vectorConsulta.join(', ')}, ...]</div>
                    </div>
                `;
            }

            // 2. Caja de IA (solo si Groq devolvió una respuesta)
            if (usarIA && data.respuesta) {
                htmlRender += `
                    <div class="caja-ia">
                        <h3>Síntesis de IA Generativa</h3>
                        <p>${escaparHTML(data.respuesta)}</p>
                    </div>
                `;
            }

            // 3. Nodos vectoriales recuperados
            if (data.nodos && data.nodos.length > 0) {
                htmlRender += `<h3 class="titulo-seccion">Nodos recuperados del espacio vectorial (Top ${data.nodos.length})</h3>`;

                data.nodos.forEach((nodo, index) => {
                    htmlRender += `
                        <div class="nodo-db">
                            <h4>Resultado ${index + 1}: ${escaparHTML(nodo.titulo)}</h4>
                            <p><strong>Contexto:</strong> ${escaparHTML(nodo.contenido)}</p>

                            <div class="metadatos-vector">
                                <div>Distancia matemática (coseno): ${nodo.distancia}</div>
                                <div style="margin-top: 5px; color: var(--acento-db);">Vector almacenado: [${nodo.vector.join(', ')}, ...]</div>
                            </div>
                        </div>
                    `;
                });
            } else {
                htmlRender += `<p class="estado-vacio">No se encontraron coincidencias cercanas en la base de datos.</p>`;
            }

            resultadoBox.innerHTML = htmlRender;
        }

    } catch (error) {
        resultadoBox.innerHTML = `
            <div class="nodo-db" style="border-left-color: #ff6b6b;">
                <h4 style="color: #ff6b6b;">Error de conexión</h4>
                <p>No se pudo conectar con el servidor backend. ¿Está corriendo node server.js?</p>
            </div>`;
        console.error(error);
    } finally {
        loading.style.display = 'none';
        resultadoBox.style.display = 'block';
    }
}

function limpiarBusqueda() {
    const input = document.getElementById('preguntaInput');
    const resultadoBox = document.getElementById('resultadoBox');

    input.value = '';
    document.getElementById('checkIA').checked = true;
    document.getElementById('selectLimite').value = "3";
    input.focus();

    resultadoBox.style.display = 'none';
    resultadoBox.innerHTML = '';
}

async function cargarCatalogo() {
    const loadingCatalogo = document.getElementById('loadingCatalogo');
    const catalogoBox = document.getElementById('catalogoBox');

    loadingCatalogo.style.display = 'block';
    catalogoBox.innerHTML = '';

    try {
        const response = await fetch('http://localhost:3000/api/todos');
        const data = await response.json();

        if (data.error) {
            catalogoBox.innerHTML = `
                <div class="nodo-db" style="border-left-color: #ff6b6b;">
                    <h4 style="color: #ff6b6b;">Error</h4>
                    <p>${escaparHTML(data.error)}</p>
                </div>`;
            return;
        }

        if (!data.nodos || data.nodos.length === 0) {
            catalogoBox.innerHTML = `<p class="estado-vacio">La colección está vacía. Corré el script de ingesta primero.</p>`;
            return;
        }

        catalogoBox.innerHTML = data.nodos.map((nodo, index) => `
            <div class="item-catalogo">
                <div class="fila-titulo">
                    <span class="indice">${String(index + 1).padStart(2, '0')}</span>
                    <h4>${escaparHTML(nodo.titulo)}</h4>
                </div>
                <p class="contenido-resumen">${escaparHTML(nodo.contenido)}</p>
                <div class="vector-linea">[${nodo.vector.join(', ')}, ...]</div>
            </div>
        `).join('');

        catalogoCargado = true;

    } catch (error) {
        catalogoBox.innerHTML = `
            <div class="nodo-db" style="border-left-color: #ff6b6b;">
                <h4 style="color: #ff6b6b;">Error de conexión</h4>
                <p>No se pudo conectar con el servidor backend. ¿Está corriendo node server.js?</p>
            </div>`;
        console.error(error);
    } finally {
        loadingCatalogo.style.display = 'none';
    }
}

function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}