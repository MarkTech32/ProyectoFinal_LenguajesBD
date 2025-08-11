// ========== VARIABLES GLOBALES ==========
let esCuidador = false;
let idUsuarioActual = null;

// ========== INICIALIZACIÓN ==========
function inicializarDashboardCuidador() {
    console.log('Inicializando Dashboard Cuidador...');
    verificarRolUsuario();
}

// ========== VERIFICAR ROL DEL USUARIO ==========
async function verificarRolUsuario() {
    try {
        const response = await fetch('/api/cuidador/verificar-rol');
        const result = await response.json();
        
        if (result.success) {
            esCuidador = result.data.es_cuidador;
            idUsuarioActual = result.data.id_usuario;
            console.log('Usuario es cuidador:', esCuidador);
            
            // Cargar animales después de verificar rol
            cargarAnimalesEnCuidado();
        } else {
            mostrarMensaje('Error verificando permisos', 'error');
        }
    } catch (error) {
        console.error('Error verificando rol:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

// ========== CARGAR ANIMALES EN CUIDADO ==========
async function cargarAnimalesEnCuidado() {
    try {
        const response = await fetch('/api/cuidador/animales-en-cuidado');
        const result = await response.json();
        
        if (result.success) {
            mostrarAnimalesEnCuidado(result.data);
        } else {
            mostrarMensajeEnTabla('No hay animales en cuidado', 9);
        }
    } catch (error) {
        console.error('Error cargando animales:', error);
        mostrarMensajeEnTabla('Error de conexión', 9);
    }
}

// ========== MOSTRAR ANIMALES EN TABLA ==========
function mostrarAnimalesEnCuidado(animales) {
    const tbody = document.getElementById('tabla-animales-cuidado');
    
    if (animales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay animales en cuidado</td></tr>';
        return;
    }
    
    tbody.innerHTML = animales.map(animal => {
        // Determinar estado visual
        const estadoAnimal = animal.ESTADO_ANIMAL || 'En cuidado';
        const badgeClass = estadoAnimal === 'Listo para liberación' ? 'bg-success' : 'bg-primary';
        
        // Determinar botones según rol
        let botonesAccion = `
            <button type="button" class="btn btn-sm btn-outline-primary me-1" onclick="verDetalleAnimal(${animal.ID_TRATAMIENTO}, '${animal.NOMBRE_ANIMAL}')">
                <i class="bi bi-eye"></i> Ver
            </button>
        `;
        
        if (esCuidador) {
            botonesAccion += `
                <button type="button" class="btn btn-sm btn-warning me-1" onclick="editarObservacion(${animal.ID_TRATAMIENTO}, '${animal.NOMBRE_ANIMAL}')">
                    <i class="bi bi-pencil"></i> Editar
                </button>
                <button type="button" class="btn btn-sm btn-success" onclick="pasarALiberacion(${animal.ID_ANIMAL}, '${animal.NOMBRE_ANIMAL}')">
                    <i class="bi bi-send"></i> Liberar
                </button>
            `;
        }
        
        return `
            <tr>
                <td>${animal.ID_ANIMAL}</td>
                <td><strong>${animal.NOMBRE_ANIMAL}</strong></td>
                <td><small>${animal.NOMBRE_CIENTIFICO}</small></td>
                <td><small>${animal.NOMBRE_CUIDADOR}</small></td>
                <td>${animal.FECHA_ASIGNACION}</td>
                <td><small>${animal.DIAGNOSTICO_FINAL || 'Sin diagnóstico'}</small></td>
                <td><small>${animal.ULTIMA_OBSERVACION || 'Sin observaciones'}</small></td>
                <td><span class="badge ${badgeClass}">${estadoAnimal}</span></td>
                <td>${botonesAccion}</td>
            </tr>
        `;
    }).join('');
}

// ========== VER DETALLE DEL ANIMAL CON HISTORIAL (LIMPIO) ==========
async function verDetalleAnimal(idTratamiento, nombreAnimal) {
    try {
        // Cargar historial de observaciones
        const response = await fetch(`/api/cuidador/historial-observaciones/${idTratamiento}`);
        const result = await response.json();
        
        if (!result.success) {
            mostrarMensaje('Error al cargar historial de observaciones', 'error');
            return;
        }
        
        const observaciones = result.data;
        
        // Generar HTML del historial
        let historialHTML = '';
        if (observaciones.length === 0) {
            historialHTML = '<p class="text-muted">No hay observaciones registradas aún.</p>';
        } else {
            historialHTML = observaciones.map((obs, index) => `
                <div class="card mb-3 ${index === 0 ? 'border-primary' : ''}">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${obs.NOMBRE_CUIDADOR}</strong>
                            ${index === 0 ? '<span class="badge bg-primary ms-2">Más reciente</span>' : ''}
                        </div>
                        <small class="text-muted">${formatearFecha(obs.FECHA_OBSERVACION)}</small>
                    </div>
                    <div class="card-body">
                        <p class="mb-2">${obs.OBSERVACION}</p>
                        <span class="badge ${obs.ESTADO_ANIMAL === 'Listo para liberación' ? 'bg-success' : 'bg-info'}">
                            ${obs.ESTADO_ANIMAL}
                        </span>
                    </div>
                </div>
            `).join('');
        }
        
        // Crear HTML del modal
        const modalHTML = `
            <div class="modal fade" id="modalDetalleAnimal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-clipboard-data"></i> Detalle del Animal - ${nombreAnimal}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-4">
                                <div class="col-12">
                                    <h6 class="text-primary">
                                        <i class="bi bi-chat-square-text"></i> Historial de Observaciones de Cuidadores
                                    </h6>
                                    <hr>
                                    <div style="max-height: 400px; overflow-y: auto;">
                                        ${historialHTML}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            ${esCuidador ? `
                            <button type="button" class="btn btn-warning" onclick="editarObservacion(${idTratamiento}, '${nombreAnimal}')">
                                <i class="bi bi-pencil"></i> Agregar Observación
                            </button>
                            ` : ''}
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remover modal existente si existe
        const modalExistente = document.getElementById('modalDetalleAnimal');
        if (modalExistente) {
            modalExistente.remove();
        }
        
        // Agregar modal al DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modalDetalleAnimal'));
        modal.show();
        
        // Limpiar modal del DOM cuando se cierre
        document.getElementById('modalDetalleAnimal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
        
    } catch (error) {
        console.error('Error cargando detalle del animal:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

// ========== EDITAR/AGREGAR OBSERVACIÓN (LIMPIO) ==========
function editarObservacion(idTratamiento, nombreAnimal) {
    if (!esCuidador) {
        mostrarMensaje('Solo los cuidadores pueden agregar observaciones', 'error');
        return;
    }
    
    // Crear HTML del modal
    const modalHTML = `
        <div class="modal fade" id="modalEditarObservacion" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-pencil-square"></i> Agregar Observación
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="formObservacion">
                            <div class="mb-3">
                                <label class="form-label"><strong>Animal:</strong></label>
                                <p class="text-muted">${nombreAnimal}</p>
                            </div>
                            
                            <div class="mb-3">
                                <label for="observacionTexto" class="form-label">
                                    Observación <span class="text-danger">*</span>
                                </label>
                                <textarea 
                                    class="form-control" 
                                    id="observacionTexto" 
                                    rows="4" 
                                    placeholder="Describa el estado actual del animal, su progreso, comportamiento, alimentación, etc."
                                    required
                                    maxlength="500"
                                ></textarea>
                                <div class="form-text">Máximo 500 caracteres</div>
                            </div>
                            
                            <div class="mb-3">
                                <label for="estadoAnimal" class="form-label">
                                    Estado del Animal <span class="text-danger">*</span>
                                </label>
                                <select class="form-select" id="estadoAnimal" required>
                                    <option value="">Seleccione el estado...</option>
                                    <option value="En cuidado">En cuidado</option>
                                    <option value="Listo para liberación">Listo para liberación</option>
                                </select>
                                <div class="form-text">
                                    <strong>En cuidado:</strong> El animal aún necesita supervisión<br>
                                    <strong>Listo para liberación:</strong> El animal está preparado para ser liberado
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            Cancelar
                        </button>
                        <button type="button" class="btn btn-primary" onclick="guardarObservacion(${idTratamiento})">
                            <i class="bi bi-check-circle"></i> Guardar Observación
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remover modal existente si existe
    const modalExistente = document.getElementById('modalEditarObservacion');
    if (modalExistente) {
        modalExistente.remove();
    }
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalEditarObservacion'));
    modal.show();
    
    // Limpiar modal del DOM cuando se cierre
    document.getElementById('modalEditarObservacion').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

// ========== GUARDAR OBSERVACIÓN ==========
async function guardarObservacion(idTratamiento) {
    try {
        const observacion = document.getElementById('observacionTexto').value.trim();
        const estadoAnimal = document.getElementById('estadoAnimal').value;
        
        // Validar campos
        if (!observacion || !estadoAnimal) {
            mostrarMensaje('Todos los campos son obligatorios', 'error');
            return;
        }
        
        if (observacion.length > 500) {
            mostrarMensaje('La observación no puede exceder 500 caracteres', 'error');
            return;
        }
        
        // Enviar datos al servidor
        const response = await fetch('/api/cuidador/observaciones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id_tratamiento: idTratamiento,
                observacion: observacion,
                estado_animal: estadoAnimal
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarObservacion'));
            modal.hide();
            
            // Mostrar mensaje de éxito
            mostrarMensaje('Observación agregada exitosamente', 'success');
            
            // Recargar tabla
            cargarAnimalesEnCuidado();
            
        } else {
            mostrarMensaje(result.message || 'Error al guardar observación', 'error');
        }
        
    } catch (error) {
        console.error('Error guardando observación:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

// ========== UTILIDAD PARA FORMATEAR FECHAS ==========
function formatearFecha(fechaString) {
    const fecha = new Date(fechaString);
    const opciones = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return fecha.toLocaleDateString('es-ES', opciones);
}

// ========== PASAR ANIMAL A LIBERACIÓN ==========
function pasarALiberacion(idAnimal, nombreAnimal) {
    if (!esCuidador) {
        mostrarMensaje('Solo los cuidadores pueden pasar animales a liberación', 'error');
        return;
    }
    
    // Crear HTML del modal de confirmación
    const modalHTML = `
        <div class="modal fade" id="modalPasarLiberacion" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-send"></i> Pasar a Liberación
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label"><strong>Animal:</strong></label>
                            <p class="text-muted">${nombreAnimal} (ID: ${idAnimal})</p>
                        </div>
                        
                        <div class="alert alert-warning">
                            <i class="bi bi-exclamation-triangle"></i>
                            <strong>¿Está seguro?</strong><br>
                            Esta acción marcará al animal como listo para liberación y será transferido al departamento de liberaciones.
                        </div>
                        
                        <div class="mb-3">
                            <label for="observacionFinal" class="form-label">
                                Observación Final <span class="text-danger">*</span>
                            </label>
                            <textarea 
                                class="form-control" 
                                id="observacionFinal" 
                                rows="3" 
                                placeholder="Ej: Animal completamente recuperado, comportamiento normal, listo para retornar a su hábitat natural"
                                required
                                maxlength="500"
                            ></textarea>
                            <div class="form-text">Describa por qué el animal está listo para ser liberado</div>
                        </div>
                        
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle"></i>
                            Se creará automáticamente una observación final con estado "Listo para liberación".
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            Cancelar
                        </button>
                        <button type="button" class="btn btn-success" onclick="confirmarPasarLiberacion(${idAnimal}, '${nombreAnimal}')">
                            <i class="bi bi-check-circle"></i> Confirmar y Pasar a Liberación
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remover modal existente si existe
    const modalExistente = document.getElementById('modalPasarLiberacion');
    if (modalExistente) {
        modalExistente.remove();
    }
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalPasarLiberacion'));
    modal.show();
    
    // Limpiar modal del DOM cuando se cierre
    document.getElementById('modalPasarLiberacion').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

// ========== CONFIRMAR PASAR A LIBERACIÓN ==========
async function confirmarPasarLiberacion(idAnimal, nombreAnimal) {
    try {
        const observacionFinal = document.getElementById('observacionFinal').value.trim();
        
        // Validar observación
        if (!observacionFinal) {
            mostrarMensaje('La observación final es obligatoria', 'error');
            return;
        }
        
        if (observacionFinal.length > 500) {
            mostrarMensaje('La observación no puede exceder 500 caracteres', 'error');
            return;
        }
        
        // Primero obtener el ID del tratamiento del animal
        const tratamientoId = await obtenerIdTratamientoPorAnimal(idAnimal);
        
        if (!tratamientoId) {
            mostrarMensaje('No se encontró el tratamiento del animal', 'error');
            return;
        }
        
        // Agregar observación final con estado "Listo para liberación"
        const response = await fetch('/api/cuidador/observaciones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id_tratamiento: tratamientoId,
                observacion: observacionFinal,
                estado_animal: 'Listo para liberación'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalPasarLiberacion'));
            modal.hide();
            
            // Mostrar mensaje de éxito
            mostrarMensaje(`${nombreAnimal} ha sido marcado como listo para liberación exitosamente`, 'success');
            
            // Recargar tabla
            cargarAnimalesEnCuidado();
            
        } else {
            mostrarMensaje(result.message || 'Error al pasar animal a liberación', 'error');
        }
        
    } catch (error) {
        console.error('Error pasando animal a liberación:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

// ========== FUNCIÓN AUXILIAR PARA OBTENER ID DE TRATAMIENTO ==========
async function obtenerIdTratamientoPorAnimal(idAnimal) {
    try {
        const response = await fetch(`/api/veterinario/tratamiento-por-animal/${idAnimal}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            return result.data.id_tratamiento;
        }
        
        return null;
    } catch (error) {
        console.error('Error obteniendo ID de tratamiento:', error);
        return null;
    }
}

// ========== UTILIDADES ==========
function mostrarMensajeEnTabla(mensaje, colspan) {
    document.getElementById('tabla-animales-cuidado').innerHTML = `
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
document.addEventListener('DOMContentLoaded', inicializarDashboardCuidador);