// ========== VARIABLES GLOBALES ==========
let esRescatista = false;

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async function() {
    await verificarRolUsuario();
    cargarTodasLasTablas();
});

// ========== VERIFICAR ROL DEL USUARIO ==========
async function verificarRolUsuario() {
    try {
        const response = await fetch('/api/liberaciones/verificar-rol');
        const result = await response.json();
        esRescatista = result.success ? result.data.es_rescatista : false;
    } catch (error) {
        console.error('Error verificando rol:', error);
        esRescatista = false;
    }
}

// ========== CARGAR TABLAS ==========
async function cargarTodasLasTablas() {
    cargarAnimalesListosParaLiberar();
    cargarAnimalesLiberados();
}

async function cargarAnimalesListosParaLiberar() {
    try {
        const response = await fetch('/api/liberaciones/listos-para-liberar');
        const result = await response.json();
        
        const tbody = document.getElementById('tabla-listos-liberar');
        
        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map(animal => `
                <tr>
                    <td>${animal.ID_ANIMAL}</td>
                    <td><strong>${animal.NOMBRE_ANIMAL}</strong></td>
                    <td><small>${animal.NOMBRE_CIENTIFICO}</small></td>
                    <td><small>${animal.NOMBRE_CUIDADOR}</small></td>
                    <td><small>${animal.ULTIMA_OBSERVACION || 'Sin observaciones'}</small></td>
                    <td>${animal.FECHA_PREPARACION}</td>
                    <td><span class="badge bg-warning text-dark">Listo para liberar</span></td>
                    <td>
                        <button type="button" class="btn btn-sm btn-outline-primary me-1" onclick="verDetalleAnimal(${animal.ID_ANIMAL})">
                            <i class="bi bi-eye"></i> Ver
                        </button>
                        ${esRescatista ? `
                        <button type="button" class="btn btn-sm btn-success" onclick="asignarLiberacion(${animal.ID_ANIMAL}, '${animal.NOMBRE_ANIMAL}')">
                            <i class="bi bi-send"></i> Asignar
                        </button>
                        ` : ''}
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay animales listos para liberar</td></tr>';
        }
    } catch (error) {
        document.getElementById('tabla-listos-liberar').innerHTML = '<tr><td colspan="8" class="text-center">Error de conexión</td></tr>';
    }
}

async function cargarAnimalesLiberados() {
    try {
        const response = await fetch('/api/liberaciones/animales-liberados');
        const result = await response.json();
        
        const tbody = document.getElementById('tabla-animales-liberados');
        
        if (result.success && result.data.length > 0) {
            tbody.innerHTML = result.data.map(animal => {
                const seguimientos = animal.TOTAL_SEGUIMIENTOS > 0 
                    ? `${animal.TOTAL_SEGUIMIENTOS} seguimiento(s)<br><small>Último: ${animal.ULTIMO_SEGUIMIENTO || 'N/A'}</small>`
                    : '<span class="text-muted">Sin seguimientos</span>';
                
                return `
                    <tr>
                        <td>${animal.ID_ANIMAL}</td>
                        <td><strong>${animal.NOMBRE_ANIMAL}</strong></td>
                        <td><small>${animal.NOMBRE_CIENTIFICO}</small></td>
                        <td>${animal.FECHA_LIBERACION}</td>
                        <td><small>${animal.LUGAR_LIBERACION}</small></td>
                        <td><small>${animal.NOMBRE_RESCATISTA}</small></td>
                        <td><small>${animal.OBSERVACIONES}</small></td>
                        <td><small>${seguimientos}</small></td>
                        <td>
                            <button type="button" class="btn btn-sm btn-outline-primary me-1" onclick="verSeguimientos(${animal.ID_LIBERACION}, '${animal.NOMBRE_ANIMAL}')">
                                <i class="bi bi-eye"></i> Ver
                            </button>
                            ${esRescatista ? `
                            <button type="button" class="btn btn-sm btn-info" onclick="agregarSeguimiento(${animal.ID_LIBERACION}, '${animal.NOMBRE_ANIMAL}')">
                                <i class="bi bi-plus-circle"></i> Seguimiento
                            </button>
                            ` : ''}
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay animales liberados</td></tr>';
        }
    } catch (error) {
        document.getElementById('tabla-animales-liberados').innerHTML = '<tr><td colspan="9" class="text-center">Error de conexión</td></tr>';
    }
}

// ========== VER DETALLE DEL ANIMAL ==========
async function verDetalleAnimal(idAnimal) {
    try {
        const response = await fetch(`/api/veterinario/animal-completo/${idAnimal}`);
        const result = await response.json();
        
        if (!result.success) {
            mostrarMensaje('Error al cargar información del animal', 'error');
            return;
        }
        
        const { animal, rescate, estadoSalud, tratamiento } = result.data;
        
        mostrarModal('modalDetalle', `
            <div class="modal fade" id="modalDetalle" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Información - ${animal.nombre}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <h6 class="text-primary">Animal</h6>
                            <p><strong>Especie:</strong> ${animal.especie_nombre}<br>
                            <strong>Edad:</strong> ${animal.edad || 'N/A'} años<br>
                            <strong>Sexo:</strong> ${animal.sexo}</p>
                            
                            <h6 class="text-success">Rescate</h6>
                            <p><strong>Fecha:</strong> ${rescate.fecha_rescate || 'N/A'}<br>
                            <strong>Lugar:</strong> ${rescate.lugar || 'N/A'}</p>
                            
                            ${estadoSalud.diagnostico ? `
                            <h6 class="text-warning">Estado de Salud</h6>
                            <p><strong>Diagnóstico:</strong> ${estadoSalud.diagnostico}<br>
                            <strong>Estado:</strong> ${estadoSalud.estado}</p>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    } catch (error) {
        mostrarMensaje('Error de conexión', 'error');
    }
}

// ========== ASIGNAR LIBERACIÓN ==========
function asignarLiberacion(idAnimal, nombreAnimal) {
    if (!esRescatista) {
        mostrarMensaje('Solo los rescatistas pueden asignar liberaciones', 'error');
        return;
    }
    
    mostrarModal('modalAsignar', `
        <div class="modal fade" id="modalAsignar" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Asignar Liberación</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Animal:</strong> ${nombreAnimal}</p>
                        
                        <div class="mb-3">
                            <label class="form-label">Lugar de Liberación *</label>
                            <input type="text" class="form-control" id="lugarLiberacion" placeholder="Ej: Parque Nacional Corcovado" maxlength="150" required>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Observaciones *</label>
                            <textarea class="form-control" id="observacionesLiberacion" rows="3" placeholder="Condiciones de liberación..." maxlength="300" required></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-success" onclick="confirmarLiberacion(${idAnimal})">Confirmar</button>
                    </div>
                </div>
            </div>
        </div>
    `);
}

async function confirmarLiberacion(idAnimal) {
    const lugar = document.getElementById('lugarLiberacion').value.trim();
    const observaciones = document.getElementById('observacionesLiberacion').value.trim();
    
    if (!lugar || !observaciones) {
        mostrarMensaje('Todos los campos son obligatorios', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/liberaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_animal: idAnimal,
                lugar_liberacion: lugar,
                observaciones: observaciones
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('modalAsignar')).hide();
            mostrarMensaje('Liberación creada exitosamente', 'success');
            cargarTodasLasTablas();
        } else {
            mostrarMensaje(result.message, 'error');
        }
    } catch (error) {
        mostrarMensaje('Error de conexión', 'error');
    }
}

// ========== VER SEGUIMIENTOS ==========
async function verSeguimientos(idLiberacion, nombreAnimal) {
    try {
        const response = await fetch(`/api/liberaciones/seguimientos/${idLiberacion}`);
        const result = await response.json();
        
        const seguimientos = result.success ? result.data : [];
        const historial = seguimientos.length > 0 
            ? seguimientos.map(seg => `
                <div class="card mb-2">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <strong>${seg.NOMBRE_RESCATISTA}</strong>
                            <small>${new Date(seg.FECHA_SEGUIMIENTO).toLocaleDateString()}</small>
                        </div>
                        <p class="mb-1"><strong>Método:</strong> ${seg.METODO_SEGUIMIENTO}</p>
                        <p class="mb-1"><strong>Estado:</strong> ${seg.ESTADO_ANIMAL}</p>
                        <p class="mb-0">${seg.OBSERVACIONES}</p>
                    </div>
                </div>
            `).join('')
            : '<p class="text-muted">No hay seguimientos registrados</p>';
        
        mostrarModal('modalSeguimientos', `
            <div class="modal fade" id="modalSeguimientos" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Seguimientos - ${nombreAnimal}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
                            ${historial}
                        </div>
                        <div class="modal-footer">
                            ${esRescatista ? `
                            <button type="button" class="btn btn-info" onclick="agregarSeguimiento(${idLiberacion}, '${nombreAnimal}')">
                                Agregar Seguimiento
                            </button>
                            ` : ''}
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    } catch (error) {
        mostrarMensaje('Error de conexión', 'error');
    }
}

// ========== AGREGAR SEGUIMIENTO ==========
function agregarSeguimiento(idLiberacion, nombreAnimal) {
    if (!esRescatista) {
        mostrarMensaje('Solo los rescatistas pueden agregar seguimientos', 'error');
        return;
    }
    
    mostrarModal('modalNuevoSeguimiento', `
        <div class="modal fade" id="modalNuevoSeguimiento" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Nuevo Seguimiento</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Animal:</strong> ${nombreAnimal}</p>
                        
                        <div class="mb-3">
                            <label class="form-label">Método *</label>
                            <select class="form-select" id="metodo" required>
                                <option value="">Seleccione...</option>
                                <option value="GPS">GPS</option>
                                <option value="Cámaras trampa">Cámaras trampa</option>
                                <option value="Avistamiento directo">Avistamiento directo</option>
                                <option value="Reporte de comunidad">Reporte de comunidad</option>
                            </select>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Estado *</label>
                            <select class="form-select" id="estado" required>
                                <option value="">Seleccione...</option>
                                <option value="Adaptándose bien">Adaptándose bien</option>
                                <option value="Con dificultades">Con dificultades</option>
                                <option value="Estable">Estable</option>
                                <option value="Necesita atención">Necesita atención</option>
                            </select>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Ubicación</label>
                            <input type="text" class="form-control" id="ubicacion" placeholder="Opcional" maxlength="150">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Observaciones *</label>
                            <textarea class="form-control" id="observacionesSeg" rows="3" maxlength="400" required></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-info" onclick="guardarSeguimiento(${idLiberacion})">Guardar</button>
                    </div>
                </div>
            </div>
        </div>
    `);
}

async function guardarSeguimiento(idLiberacion) {
    const metodo = document.getElementById('metodo').value;
    const estado = document.getElementById('estado').value;
    const ubicacion = document.getElementById('ubicacion').value.trim();
    const observaciones = document.getElementById('observacionesSeg').value.trim();
    
    if (!metodo || !estado || !observaciones) {
        mostrarMensaje('Campos obligatorios incompletos', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/liberaciones/seguimientos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_liberacion: idLiberacion,
                metodo_seguimiento: metodo,
                estado_animal: estado,
                ubicacion_avistamiento: ubicacion || null,
                observaciones: observaciones
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            bootstrap.Modal.getInstance(document.getElementById('modalNuevoSeguimiento')).hide();
            mostrarMensaje('Seguimiento agregado exitosamente', 'success');
            cargarAnimalesLiberados();
        } else {
            mostrarMensaje(result.message, 'error');
        }
    } catch (error) {
        mostrarMensaje('Error de conexión', 'error');
    }
}

// ========== UTILIDADES ==========
function mostrarModal(id, html) {
    const existente = document.getElementById(id);
    if (existente) existente.remove();
    
    document.body.insertAdjacentHTML('beforeend', html);
    new bootstrap.Modal(document.getElementById(id)).show();
    
    document.getElementById(id).addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

function mostrarMensaje(mensaje, tipo) {
    const alerta = document.createElement('div');
    alerta.className = `alert alert-${tipo === 'success' ? 'success' : 'danger'} alert-dismissible fade show`;
    alerta.innerHTML = `${mensaje}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    
    document.querySelector('.container').insertBefore(alerta, document.querySelector('.container').firstChild);
    setTimeout(() => alerta?.remove(), 5000);
}