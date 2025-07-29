// ========== INICIALIZACIÓN ==========
function inicializarDashboardVeterinario() {
    console.log('Inicializando Dashboard Veterinario...');
    cargarTodasLasTablas();
}

// Cargar todas las tablas de una vez
async function cargarTodasLasTablas() {
    await Promise.all([
        cargarTabla('/api/veterinario/pendientes', 'tabla-pendientes', mostrarAnimalesPendientes, 9),
        cargarTabla('/api/veterinario/en-tratamiento', 'tabla-tratamiento', mostrarAnimalesEnTratamiento, 8),
        cargarTabla('/api/veterinario/listos', 'tabla-listos', mostrarAnimalesListos, 9)
    ]);
}

// ========== FUNCIÓN GENÉRICA PARA CARGAR DATOS ==========
async function cargarTabla(url, tablaId, funcionMostrar, colspan) {
    try {
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success && result.data.length > 0) {
            funcionMostrar(result.data);
        } else {
            mostrarMensajeEnTabla(tablaId, 'No hay datos disponibles', colspan);
        }
    } catch (error) {
        console.error(`Error cargando ${url}:`, error);
        mostrarMensajeEnTabla(tablaId, 'Error de conexión', colspan);
    }
}

// ========== FUNCIONES PARA MOSTRAR DATOS ==========
function mostrarAnimalesPendientes(animales) {
    const tbody = document.getElementById('tabla-pendientes');
    tbody.innerHTML = animales.map(animal => `
        <tr>
            <td>${animal.ID_ANIMAL}</td>
            <td><strong>${animal.NOMBRE_ANIMAL}</strong></td>
            <td><small>${animal.NOMBRE_CIENTIFICO}</small></td>
            <td>
                <small>
                    ${animal.EDAD || 'N/A'} años<br>
                    <span class="badge bg-secondary">${animal.SEXO}</span>
                </small>
            </td>
            <td>${animal.FECHA_RESCATE}</td>
            <td><small>${animal.LUGAR_RESCATE}</small></td>
            <td><small>${animal.NOMBRE_RESCATISTA}</small></td>
            <td><span class="badge bg-warning">${calcularDias(animal.FECHA_RESCATE)} días</span></td>
            <td>
                <button type="button" class="btn btn-sm btn-warning me-1" onclick="evaluarAnimal(${animal.ID_ANIMAL})">
                    Evaluar
                </button>
                <button type="button" class="btn btn-sm btn-outline-info" onclick="verDetalles(${animal.ID_ANIMAL})">
                    Ver
                </button>
            </td>
        </tr>
    `).join('');
}

function mostrarAnimalesEnTratamiento(tratamientos) {
    const tbody = document.getElementById('tabla-tratamiento');
    tbody.innerHTML = tratamientos.map(tratamiento => `
        <tr>
            <td>${tratamiento.ID_TRATAMIENTO}</td>
            <td><strong>${tratamiento.NOMBRE_ANIMAL}</strong></td>
            <td><small>${tratamiento.NOMBRE_CIENTIFICO}</small></td>
            <td><small>${tratamiento.DIAGNOSTICO || 'Sin diagnóstico'}</small></td>
            <td>${tratamiento.FECHA_INICIO}</td>
            <td><span class="badge bg-info">${calcularDias(tratamiento.FECHA_INICIO)} días</span></td>
            <td><span class="badge bg-primary">${tratamiento.ESTADO_SALUD || 'N/A'}</span></td>
            <td>
                <button type="button" class="btn btn-sm btn-info me-1" onclick="editarTratamiento(${tratamiento.ID_TRATAMIENTO})">
                    Editar
                </button>
                <button type="button" class="btn btn-sm btn-success" onclick="completarTratamiento(${tratamiento.ID_TRATAMIENTO})">
                    Completar
                </button>
            </td>
        </tr>
    `).join('');
}

function mostrarAnimalesListos(animales) {
    const tbody = document.getElementById('tabla-listos');
    tbody.innerHTML = animales.map(animal => `
        <tr>
            <td>${animal.ID_ANIMAL}</td>
            <td><strong>${animal.NOMBRE_ANIMAL}</strong></td>
            <td><small>${animal.NOMBRE_CIENTIFICO}</small></td>
            <td><small>${animal.DIAGNOSTICO_FINAL || 'Sin diagnóstico'}</small></td>
            <td>${animal.FECHA_FIN_TRATAMIENTO}</td>
            <td><small>${animal.NOMBRE_VETERINARIO}</small></td>
            <td><small>${animal.OBSERVACIONES || 'Sin observaciones'}</small></td>
            <td><span class="badge bg-success">Completado</span></td>
            <td>
                <button type="button" class="btn btn-sm btn-success me-1" onclick="asignarCuidador(${animal.ID_ANIMAL})">
                    Asignar
                </button>
                <button type="button" class="btn btn-sm btn-outline-primary" onclick="verHistorial(${animal.ID_ANIMAL})">
                    Historial
                </button>
            </td>
        </tr>
    `).join('');
}

// ========== ACCIONES PRINCIPALES ==========
function evaluarAnimal(idAnimal) {
    window.location.href = `/html/formulario?tipo=tratamientos&modo=crear&id_animal=${idAnimal}`;
}

function editarTratamiento(idTratamiento) {
    window.location.href = `/html/formulario?tipo=tratamientos&modo=editar&id=${idTratamiento}`;
}

async function completarTratamiento(idTratamiento) {
    if (!confirm('¿Está seguro de que desea completar este tratamiento?')) return;
    
    try {
        const response = await fetch(`/api/veterinario/completar/${idTratamiento}`, {
            method: 'PUT'
        });
        
        const result = await response.json();
        
        if (result.success) {
            mostrarMensaje('Tratamiento completado exitosamente', 'success');
            // Recargar solo las tablas necesarias
            cargarTabla('/api/veterinario/en-tratamiento', 'tabla-tratamiento', mostrarAnimalesEnTratamiento, 8);
            cargarTabla('/api/veterinario/listos', 'tabla-listos', mostrarAnimalesListos, 9);
        } else {
            mostrarMensaje(result.message, 'error');
        }
    } catch (error) {
        console.error('Error completando tratamiento:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

// ========== ACCIONES PENDIENTES (PLACEHOLDER) ==========
function asignarCuidador(idAnimal) {
    console.log(`TODO: Asignar cuidador al animal ID: ${idAnimal}`);
    // TODO: Implementar formulario o modal
}

function verDetalles(idAnimal) {
    console.log(`TODO: Ver detalles del animal ID: ${idAnimal}`);
    // TODO: Implementar modal de detalles
}

function verHistorial(idAnimal) {
    console.log(`TODO: Ver historial del animal ID: ${idAnimal}`);
    // TODO: Implementar página de historial
}

// ========== UTILIDADES ==========
function calcularDias(fecha) {
    const diferencia = new Date() - new Date(fecha);
    return Math.floor(diferencia / (1000 * 60 * 60 * 24));
}

function mostrarMensajeEnTabla(idTabla, mensaje, colspan) {
    document.getElementById(idTabla).innerHTML = `
        <tr><td colspan="${colspan}" class="text-center">${mensaje}</td></tr>
    `;
}

function mostrarMensaje(mensaje, tipo) {
    const alerta = document.createElement('div');
    alerta.className = `alert alert-${tipo === 'success' ? 'success' : 'danger'} alert-dismissible fade show`;
    alerta.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container');
    container.insertBefore(alerta, container.firstChild);
    
    setTimeout(() => alerta?.remove(), 5000);
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', inicializarDashboardVeterinario);