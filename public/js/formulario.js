// ========== CONFIGURACIONES DE TABLAS ==========
const tablaConfigs = {
    rescates: {
        titulo: 'Rescate',
        endpoint: '/api/rescates',
        dashboardUrl: '/dashboard_rescatista',
        campos: [
            { 
                name: 'fecha_rescate', 
                type: 'date', 
                label: 'Fecha del Rescate', 
                required: true,
                placeholder: 'Seleccione la fecha del rescate'
            },
            { 
                name: 'lugar', 
                type: 'text', 
                label: 'Lugar del Rescate', 
                required: true,
                placeholder: 'Ej: Parque Central, San José'
            },
            { 
                name: 'detalles', 
                type: 'textarea', 
                label: 'Detalles del Rescate', 
                required: true,
                placeholder: 'Describa los detalles del rescate, condiciones encontradas, etc.',
                rows: 4
            },
            { 
                name: 'id_rescatista', 
                type: 'select', 
                label: 'Rescatista Asignado', 
                required: true,
                endpoint: '/api/empleados',
                placeholder: 'Seleccione un rescatista'
            }
        ]
    },
    // Configuración para futuras tablas
    animales: {
        titulo: 'Animal',
        endpoint: '/api/animales',
        dashboardUrl: '/dashboard_animales',
        campos: [
            { name: 'nombre', type: 'text', label: 'Nombre del Animal', required: true },
            { name: 'especie', type: 'text', label: 'Especie', required: true },
            { name: 'edad', type: 'number', label: 'Edad (años)', required: false },
            { name: 'id_rescate', type: 'select', label: 'Rescate Asociado', required: true, endpoint: '/api/rescates' }
        ]
    }
};

// ========== VARIABLES GLOBALES ==========
let configuracionActual = null;
let modoActual = null; // 'crear' o 'editar'
let idActual = null;
let datosOriginales = null;

// ========== INICIALIZACIÓN ==========
function inicializarFormulario() {
    const params = obtenerParametrosURL();
    
    if (!params.tipo || !tablaConfigs[params.tipo]) {
        mostrarError('Tipo de formulario no válido');
        return;
    }
    
    configuracionActual = tablaConfigs[params.tipo];
    modoActual = params.modo || 'crear';
    idActual = params.id || null;
    
    configurarInterfaz();
    generarCampos();
    
    if (modoActual === 'editar' && idActual) {
        cargarDatosParaEditar();
    }
}

// ========== CONFIGURACIÓN DE INTERFAZ ==========
function configurarInterfaz() {
    // Actualizar título
    const titulo = modoActual === 'crear' ? 
        `Agregar ${configuracionActual.titulo}` : 
        `Editar ${configuracionActual.titulo}`;
    
    document.getElementById('form-title').innerHTML = 
        `<i class="bi bi-${modoActual === 'crear' ? 'plus' : 'pencil'}-circle"></i> ${titulo}`;
    
    // Actualizar breadcrumb
    const breadcrumbDashboard = document.getElementById('breadcrumb-dashboard');
    breadcrumbDashboard.href = configuracionActual.dashboardUrl;
    breadcrumbDashboard.textContent = `Dashboard ${configuracionActual.titulo}s`;
    
    document.getElementById('breadcrumb-current').textContent = titulo;
    
    // Actualizar botón submit
    document.getElementById('submit-btn').innerHTML = 
        `<i class="bi bi-${modoActual === 'crear' ? 'plus' : 'check'}-circle"></i> ${modoActual === 'crear' ? 'Crear' : 'Actualizar'}`;
}

// ========== GENERACIÓN DINÁMICA DE CAMPOS ==========
function generarCampos() {
    const container = document.getElementById('form-fields');
    container.innerHTML = '';
    
    configuracionActual.campos.forEach(campo => {
        const div = document.createElement('div');
        div.className = 'col-md-6 mb-3';
        
        // Para textarea usar columna completa
        if (campo.type === 'textarea') {
            div.className = 'col-12 mb-3';
        }
        
        div.innerHTML = generarHTMLCampo(campo);
        container.appendChild(div);
    });
    
    // Configurar event listeners
    configurarEventListeners();
}

function generarHTMLCampo(campo) {
    const requiredAttr = campo.required ? 'required' : '';
    const requiredLabel = campo.required ? '<span class="text-danger">*</span>' : '';
    
    let inputHTML = '';
    
    switch (campo.type) {
        case 'text':
        case 'date':
        case 'number':
            inputHTML = `
                <input type="${campo.type}" 
                       class="form-control" 
                       id="${campo.name}" 
                       name="${campo.name}" 
                       placeholder="${campo.placeholder || ''}"
                       ${requiredAttr}>
            `;
            break;
            
        case 'textarea':
            inputHTML = `
                <textarea class="form-control" 
                         id="${campo.name}" 
                         name="${campo.name}" 
                         rows="${campo.rows || 3}"
                         placeholder="${campo.placeholder || ''}"
                         ${requiredAttr}></textarea>
            `;
            break;
            
        case 'select':
            inputHTML = `
                <select class="form-select" 
                       id="${campo.name}" 
                       name="${campo.name}" 
                       ${requiredAttr}>
                    <option value="">${campo.placeholder || 'Seleccione una opción'}</option>
                </select>
            `;
            break;
    }
    
    return `
        <label for="${campo.name}" class="form-label">
            ${campo.label} ${requiredLabel}
        </label>
        ${inputHTML}
        <div class="invalid-feedback" id="${campo.name}-error"></div>
    `;
}

// ========== CARGA DE DATOS PARA SELECTS ==========
async function configurarEventListeners() {
    // Cargar datos para campos select
    for (const campo of configuracionActual.campos) {
        if (campo.type === 'select' && campo.endpoint) {
            await cargarOpcionesSelect(campo);
        }
    }
    
    // Configurar evento de envío del formulario
    document.getElementById('dynamic-form').addEventListener('submit', manejarEnvio);
}

async function cargarOpcionesSelect(campo) {
    try {
        const response = await fetch(campo.endpoint);
        const result = await response.json();
        
        if (result.success) {
            const select = document.getElementById(campo.name);
            
            // Limpiar opciones existentes (excepto la primera)
            select.innerHTML = `<option value="">${campo.placeholder || 'Seleccione una opción'}</option>`;
            
            // Agregar nuevas opciones
            result.data.forEach(item => {
                const option = document.createElement('option');
                
                // Determinar valor y texto basado en el endpoint
                if (campo.endpoint.includes('empleados')) {
                    option.value = item.ID_EMPLEADO;
                    option.textContent = `${item.NOMBRE} ${item.APELLIDOS}`;
                } else if (campo.endpoint.includes('rescates')) {
                    option.value = item.ID_RESCATE;
                    option.textContent = `Rescate #${item.ID_RESCATE} - ${item.LUGAR}`;
                }
                
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error(`Error cargando opciones para ${campo.name}:`, error);
        mostrarError(`Error cargando datos para ${campo.label}`);
    }
}

// ========== CARGA DE DATOS PARA EDICIÓN ==========
async function cargarDatosParaEditar() {
    try {
        mostrarLoading(true);
        
        const url = `${configuracionActual.endpoint}/${idActual}`;
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            datosOriginales = result.data;
            llenarFormulario(result.data);
        } else {
            mostrarError('No se pudo cargar los datos para editar');
        }
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarError('Error de conexión al cargar los datos');
    } finally {
        mostrarLoading(false);
    }
}

function llenarFormulario(datos) {
    configuracionActual.campos.forEach(campo => {
        const elemento = document.getElementById(campo.name);
        const valor = datos[campo.name.toUpperCase()] || datos[campo.name] || '';
        
        if (elemento) {
            elemento.value = valor;
        }
    });
}

// ========== MANEJO DEL ENVÍO ==========
async function manejarEnvio(event) {
    event.preventDefault();
    
    if (!validarFormulario()) {
        return;
    }
    
    const datos = obtenerDatosFormulario();
    
    try {
        mostrarLoading(true);
        
        const url = modoActual === 'crear' ? 
            configuracionActual.endpoint : 
            `${configuracionActual.endpoint}/${idActual}`;
            
        const method = modoActual === 'crear' ? 'POST' : 'PUT';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datos)
        });
        
        const result = await response.json();
        
        if (result.success) {
            const mensaje = modoActual === 'crear' ? 
                `${configuracionActual.titulo} creado exitosamente` : 
                `${configuracionActual.titulo} actualizado exitosamente`;
            
            mostrarExito(mensaje);
            
            // Redirigir después de 2 segundos
            setTimeout(() => {
                window.location.href = configuracionActual.dashboardUrl;
            }, 2000);
        } else {
            mostrarError(result.message || 'Error al procesar la solicitud');
        }
    } catch (error) {
        console.error('Error enviando formulario:', error);
        mostrarError('Error de conexión');
    } finally {
        mostrarLoading(false);
    }
}

// ========== UTILIDADES ==========
function obtenerParametrosURL() {
    const params = new URLSearchParams(window.location.search);
    return {
        tipo: params.get('tipo'),
        modo: params.get('modo'),
        id: params.get('id')
    };
}

function obtenerDatosFormulario() {
    const datos = {};
    
    configuracionActual.campos.forEach(campo => {
        const elemento = document.getElementById(campo.name);
        if (elemento) {
            datos[campo.name] = elemento.value.trim();
        }
    });
    
    return datos;
}

function validarFormulario() {
    let esValido = true;
    
    configuracionActual.campos.forEach(campo => {
        const elemento = document.getElementById(campo.name);
        const errorDiv = document.getElementById(`${campo.name}-error`);
        
        // Limpiar errores previos
        elemento.classList.remove('is-invalid');
        errorDiv.textContent = '';
        
        // Validar campo requerido
        if (campo.required && (!elemento.value || elemento.value.trim() === '')) {
            elemento.classList.add('is-invalid');
            errorDiv.textContent = `${campo.label} es obligatorio`;
            esValido = false;
        }
    });
    
    return esValido;
}

function mostrarLoading(mostrar) {
    const overlay = document.getElementById('loading-overlay');
    if (mostrar) {
        overlay.style.setProperty('display', 'flex', 'important');
    } else {
        overlay.style.setProperty('display', 'none', 'important');
    }
}

function mostrarError(mensaje) {
    mostrarAlerta(mensaje, 'danger');
}

function mostrarExito(mensaje) {
    mostrarAlerta(mensaje, 'success');
}

function mostrarAlerta(mensaje, tipo) {
    // Remover alertas existentes
    const alertasExistentes = document.querySelectorAll('.alert');
    alertasExistentes.forEach(alerta => alerta.remove());
    
    const alerta = document.createElement('div');
    alerta.className = `alert alert-${tipo} alert-dismissible fade show`;
    alerta.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container');
    container.insertBefore(alerta, container.firstChild);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (alerta.parentNode) {
            alerta.remove();
        }
    }, 5000);
}

function volver() {
    if (confirm('¿Estás seguro de que deseas salir? Los cambios no guardados se perderán.')) {
        window.location.href = configuracionActual.dashboardUrl;
    }
}