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
                <button type="button" class="btn btn-sm btn-warning" onclick="evaluarAnimal(${animal.ID_ANIMAL})">
                    <i class="bi bi-clipboard-pulse"></i> Evaluar
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
                <button type="button" class="btn btn-sm btn-outline-primary me-1" onclick="verDetalleCompleto(${tratamiento.ID_ANIMAL})">
                    <i class="bi bi-eye"></i> Ver
                </button>
                <button type="button" class="btn btn-sm btn-info me-1" onclick="editarTratamiento(${tratamiento.ID_TRATAMIENTO})">
                    <i class="bi bi-pencil"></i> Editar
                </button>
                <button type="button" class="btn btn-sm btn-success" onclick="completarTratamiento(${tratamiento.ID_TRATAMIENTO})">
                    <i class="bi bi-check-circle"></i> Completar
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
                    <i class="bi bi-person-plus"></i> Asignar
                </button>
                <button type="button" class="btn btn-sm btn-outline-primary" onclick="verDetalleCompleto(${animal.ID_ANIMAL})">
                    <i class="bi bi-eye"></i> Ver
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

// ========== FUNCIÓN PARA VER DETALLE COMPLETO ==========
async function verDetalleCompleto(idAnimal) {
    try {
        // Obtener información completa del animal
        const response = await fetch(`/api/veterinario/animal-completo/${idAnimal}`);
        const result = await response.json();
        
        if (result.success) {
            mostrarModalDetalleCompleto(result.data);
        } else {
            mostrarMensaje('Error cargando información del animal', 'error');
        }
    } catch (error) {
        console.error('Error cargando detalle:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

function mostrarModalDetalleCompleto(data) {
    const { animal, rescate, estadoSalud, tratamiento, medicamentos } = data;
    
    // Crear HTML del modal
    const modalHTML = `
        <div class="modal fade" id="modalDetalleCompleto" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-clipboard-data"></i> Información Completa - ${animal.nombre}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Información del Animal -->
                        <div class="row mb-4">
                            <div class="col-12">
                                <h6 class="text-primary"><i class="bi bi-info-circle"></i> Información del Animal</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <tr><td><strong>Nombre:</strong></td><td>${animal.nombre}</td></tr>
                                        <tr><td><strong>Especie:</strong></td><td>${animal.especie_nombre}</td></tr>
                                        <tr><td><strong>Edad:</strong></td><td>${animal.edad || 'N/A'} años</td></tr>
                                        <tr><td><strong>Sexo:</strong></td><td>${animal.sexo}</td></tr>
                                        <tr><td><strong>Raza:</strong></td><td>${animal.raza || 'N/A'}</td></tr>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- Información del Rescate -->
                        <div class="row mb-4">
                            <div class="col-12">
                                <h6 class="text-success"><i class="bi bi-search"></i> Información del Rescate</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <tr><td><strong>Fecha:</strong></td><td>${rescate.fecha_rescate}</td></tr>
                                        <tr><td><strong>Lugar:</strong></td><td>${rescate.lugar}</td></tr>
                                        <tr><td><strong>Rescatista:</strong></td><td>${rescate.nombre_rescatista}</td></tr>
                                        <tr><td><strong>Detalles:</strong></td><td>${rescate.detalles}</td></tr>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- Estado de Salud -->
                        <div class="row mb-4">
                            <div class="col-12">
                                <h6 class="text-warning"><i class="bi bi-heart-pulse"></i> Evaluación Médica</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <tr><td><strong>Fecha Evaluación:</strong></td><td>${estadoSalud.fecha_evaluacion}</td></tr>
                                        <tr><td><strong>Tipo Problema:</strong></td><td>${estadoSalud.tipo_problema}</td></tr>
                                        <tr><td><strong>Diagnóstico:</strong></td><td>${estadoSalud.diagnostico}</td></tr>
                                        <tr><td><strong>Estado:</strong></td><td><span class="badge bg-info">${estadoSalud.estado}</span></td></tr>
                                        <tr><td><strong>Veterinario:</strong></td><td>${estadoSalud.nombre_veterinario}</td></tr>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- Tratamiento -->
                        <div class="row mb-4">
                            <div class="col-12">
                                <h6 class="text-danger"><i class="bi bi-clipboard-pulse"></i> Plan de Tratamiento</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <tr><td><strong>Fecha Inicio:</strong></td><td>${tratamiento.fecha_inicio}</td></tr>
                                        <tr><td><strong>Descripción:</strong></td><td>${tratamiento.descripcion_tratamiento}</td></tr>
                                        <tr><td><strong>Observaciones:</strong></td><td>${tratamiento.observaciones_cuidado || 'N/A'}</td></tr>
                                        <tr><td><strong>Estado:</strong></td><td><span class="badge bg-success">${tratamiento.estado_tratamiento}</span></td></tr>
                                        <tr><td><strong>Días en Tratamiento:</strong></td><td>${calcularDias(tratamiento.fecha_inicio)} días</td></tr>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- Medicamentos -->
                        <div class="row">
                            <div class="col-12">
                                <h6 class="text-info"><i class="bi bi-capsule"></i> Medicamentos</h6>
                                ${medicamentos.length > 0 ? `
                                    <div class="table-responsive">
                                        <table class="table table-sm table-striped">
                                            <thead class="table-dark">
                                                <tr>
                                                    <th>Medicamento</th>
                                                    <th>Tipo</th>
                                                    <th>Dosis</th>
                                                    <th>Inicio</th>
                                                    <th>Fin</th>
                                                    <th>Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${medicamentos.map(med => `
                                                    <tr>
                                                        <td><strong>${med.nombre_medicamento}</strong></td>
                                                        <td><small class="text-muted">${med.tipo_medicamento}</small></td>
                                                        <td>${med.dosis}</td>
                                                        <td>${med.fecha_inicio_medicamento}</td>
                                                        <td>${med.fecha_fin_medicamento || 'Continuo'}</td>
                                                        <td>
                                                            ${new Date(med.fecha_fin_medicamento || '9999-12-31') >= new Date() 
                                                                ? '<span class="badge bg-success">Activo</span>' 
                                                                : '<span class="badge bg-secondary">Finalizado</span>'}
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : '<p class="text-muted">No se han asignado medicamentos.</p>'}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remover modal existente si existe
    const modalExistente = document.getElementById('modalDetalleCompleto');
    if (modalExistente) {
        modalExistente.remove();
    }
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalDetalleCompleto'));
    modal.show();
    
    // Limpiar modal del DOM cuando se cierre
    document.getElementById('modalDetalleCompleto').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
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