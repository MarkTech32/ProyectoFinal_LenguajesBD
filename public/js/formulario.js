// ========== CONFIGURACIONES DE TABLAS ==========
const tablaConfigs = {
    rescates: {
        titulo: 'Rescate',
        endpoint: '/api/rescates',
        dashboardUrl: '/dashboard_rescatista',
        campos: [
            { name: 'fecha_rescate', type: 'date', label: 'Fecha del Rescate', required: true, placeholder: 'Seleccione la fecha del rescate' },
            { name: 'lugar', type: 'text', label: 'Lugar del Rescate', required: true, placeholder: 'Ej: Parque Central, San José' },
            { name: 'detalles', type: 'textarea', label: 'Detalles del Rescate', required: true, placeholder: 'Describa los detalles del rescate, condiciones encontradas, etc.', rows: 4 },
            { name: 'id_rescatista', type: 'select', label: 'Rescatista Asignado', required: true, endpoint: '/api/empleados', placeholder: 'Seleccione un rescatista' },
            {
                name: 'animales',
                type: 'subform',
                label: 'Animales Rescatados',
                required: true,
                minItems: 1,
                campos: [
                    { name: 'nombre', type: 'text', label: 'Nombre del Animal', required: true, placeholder: 'Ej: Mono herido, Tucán joven' },
                    { name: 'id_especie', type: 'select', label: 'Especie', required: true, endpoint: '/api/especies', placeholder: 'Seleccione la especie del animal' },
                    { name: 'raza', type: 'text', label: 'Raza/Subespecie', required: false, placeholder: 'Ej: Congo, Aullador, etc.' },
                    { name: 'edad', type: 'number', label: 'Edad (años)', required: false, placeholder: 'Edad aproximada', min: 0 },
                    { name: 'sexo', type: 'select', label: 'Sexo', required: true, opciones: [
                        { value: 'Macho', text: 'Macho' },
                        { value: 'Hembra', text: 'Hembra' },
                        { value: 'Desconocido', text: 'Desconocido' }
                    ]}
                ]
            }
        ]
    },
    tratamientos: {
        titulo: 'Tratamiento',
        endpoint: '/api/veterinario/tratamientos',
        dashboardUrl: '/dashboard_veterinario',
        campos: [
            { name: 'descripcion_tratamiento', type: 'textarea', label: 'Diagnóstico y Tratamiento', required: true, placeholder: 'Describa el diagnóstico y el plan de tratamiento para el animal', rows: 4 },
            { name: 'observaciones_cuidado', type: 'textarea', label: 'Observaciones de Cuidado', required: false, placeholder: 'Instrucciones especiales o observaciones adicionales', rows: 3 }
        ]
    }
};

// ========== VARIABLES GLOBALES ==========
let configuracionActual = null;
let modoActual = null;
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
    idActual = params.id || params.id_animal || null;
    
    configurarInterfaz();
    generarCampos();
    
    if (modoActual === 'editar' && idActual) {
        cargarDatosParaEditar();
    }
}

// ========== CONFIGURACIÓN DE INTERFAZ ==========
function configurarInterfaz() {
    const titulo = modoActual === 'crear' ? `Agregar ${configuracionActual.titulo}` : `Editar ${configuracionActual.titulo}`;
    
    document.getElementById('form-title').innerHTML = `<i class="bi bi-${modoActual === 'crear' ? 'plus' : 'pencil'}-circle"></i> ${titulo}`;
    document.getElementById('breadcrumb-dashboard').href = configuracionActual.dashboardUrl;
    document.getElementById('breadcrumb-dashboard').textContent = `Dashboard ${configuracionActual.titulo}s`;
    document.getElementById('breadcrumb-current').textContent = titulo;
    document.getElementById('submit-btn').innerHTML = `<i class="bi bi-${modoActual === 'crear' ? 'plus' : 'check'}-circle"></i> ${modoActual === 'crear' ? 'Crear' : 'Actualizar'}`;
}

// ========== GENERACIÓN DINÁMICA DE CAMPOS ==========
function generarCampos() {
    const container = document.getElementById('form-fields');
    container.innerHTML = '';
    
    configuracionActual.campos.forEach(campo => {
        const div = document.createElement('div');
        div.className = campo.type === 'textarea' ? 'col-12 mb-3' : 'col-md-6 mb-3';
        div.innerHTML = generarHTMLCampo(campo);
        container.appendChild(div);
    });
    
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
            const minAttr = campo.min !== undefined ? `min="${campo.min}"` : '';
            inputHTML = `<input type="${campo.type}" class="form-control" id="${campo.name}" name="${campo.name}" placeholder="${campo.placeholder || ''}" ${minAttr} ${requiredAttr}>`;
            break;
        case 'textarea':
            inputHTML = `<textarea class="form-control" id="${campo.name}" name="${campo.name}" rows="${campo.rows || 3}" placeholder="${campo.placeholder || ''}" ${requiredAttr}></textarea>`;
            break;
        case 'select':
            inputHTML = `<select class="form-select" id="${campo.name}" name="${campo.name}" ${requiredAttr}><option value="">${campo.placeholder || 'Seleccione una opción'}</option></select>`;
            break;
        case 'subform':
            inputHTML = `<div class="border rounded p-3 bg-light"><div id="${campo.name}-container"></div><button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="agregarAnimal('${campo.name}')"><i class="bi bi-plus"></i> Agregar Animal</button></div>`;
            break;
    }
    
    return `<label for="${campo.name}" class="form-label">${campo.label} ${requiredLabel}</label>${inputHTML}<div class="invalid-feedback" id="${campo.name}-error"></div>`;
}

// ========== CARGA DE DATOS PARA SELECTS ==========
async function configurarEventListeners() {
    for (const campo of configuracionActual.campos) {
        if (campo.type === 'select' && campo.endpoint) {
            await cargarOpcionesSelect(campo);
        }
    }
    document.getElementById('dynamic-form').addEventListener('submit', manejarEnvio);
}

async function cargarOpcionesSelect(campo) {
    try {
        const response = await fetch(campo.endpoint);
        const result = await response.json();
        
        if (result.success) {
            const select = document.getElementById(campo.name);
            select.innerHTML = `<option value="">${campo.placeholder || 'Seleccione una opción'}</option>`;
            
            result.data.forEach(item => {
                const option = document.createElement('option');
                if (campo.endpoint.includes('empleados')) {
                    option.value = item.ID_EMPLEADO;
                    option.textContent = `${item.NOMBRE} ${item.APELLIDOS}`;
                } else if (campo.endpoint.includes('especies')) {
                    option.value = item.ID_ESPECIE;
                    option.textContent = item.NOMBRE_CIENTIFICO;
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
        const response = await fetch(`${configuracionActual.endpoint}/${idActual}`);
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
        if (campo.type === 'subform') return;
        
        const elemento = document.getElementById(campo.name);
        const valor = datos[campo.name.toUpperCase()] || datos[campo.name] || '';
        
        if (elemento) {
            elemento.value = valor;
        }
    });
    
    if (datos.animales && Array.isArray(datos.animales) && datos.animales.length > 0) {
        llenarAnimalesExistentes(datos.animales);
    }
}

function llenarAnimalesExistentes(animales) {
    const container = document.getElementById('animales-container');
    container.innerHTML = '';
    
    animales.forEach((animal, index) => {
        const numeroAnimal = index + 1;
        agregarAnimalExistente(numeroAnimal, animal);
    });
}

// ========== MANEJO DEL ENVÍO ==========
async function manejarEnvio(event) {
    event.preventDefault();
    
    if (!validarFormulario()) return;
    
    const datos = obtenerDatosFormulario();
    
    // Para tratamientos, agregar id_animal desde URL
    if (configuracionActual.titulo === 'Tratamiento') {
        const params = obtenerParametrosURL();
        datos.id_animal = params.id_animal;
    }
    
    try {
        mostrarLoading(true);
        
        const url = modoActual === 'crear' ? configuracionActual.endpoint : `${configuracionActual.endpoint}/${idActual}`;
        const method = modoActual === 'crear' ? 'POST' : 'PUT';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        
        const result = await response.json();
        
        if (result.success) {
            const mensaje = modoActual === 'crear' ? `${configuracionActual.titulo} creado exitosamente` : `${configuracionActual.titulo} actualizado exitosamente`;
            mostrarExito(mensaje);
            setTimeout(() => { window.location.href = configuracionActual.dashboardUrl; }, 2000);
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
        id: params.get('id'),
        id_animal: params.get('id_animal')
    };
}

function obtenerDatosFormulario() {
    const datos = {};
    
    configuracionActual.campos.forEach(campo => {
        if (campo.type === 'subform') {
            datos[campo.name] = obtenerDatosAnimales();
        } else {
            const elemento = document.getElementById(campo.name);
            if (elemento) {
                datos[campo.name] = elemento.value.trim();
            }
        }
    });
    
    return datos;
}

function obtenerDatosAnimales() {
    const animales = [];
    const container = document.getElementById('animales-container');
    const cardsAnimales = container.querySelectorAll('.card');
    
    cardsAnimales.forEach((card, index) => {
        const numeroAnimal = index + 1;
        const animal = {};
        const configCampo = encontrarConfiguracionCampo('animales');
        if (!configCampo) return;
        
        configCampo.campos.forEach(campo => {
            const campoId = `animal_${numeroAnimal}_${campo.name}`;
            const elemento = document.getElementById(campoId);
            
            if (elemento) {
                const valor = elemento.value.trim();
                if (valor || !campo.required) {
                    animal[campo.name] = valor || null;
                }
            }
        });
        
        if (animal.nombre && animal.nombre.length > 0) {
            animales.push(animal);
        }
    });
    
    return animales;
}

function validarFormulario() {
    let esValido = true;
    
    configuracionActual.campos.forEach(campo => {
        if (campo.type === 'subform') {
            if (campo.required) {
                const container = document.getElementById(`${campo.name}-container`);
                const animales = container.querySelectorAll('.card');
                const errorDiv = document.getElementById(`${campo.name}-error`);
                
                if (animales.length === 0) {
                    if (errorDiv) {
                        errorDiv.textContent = `Debe agregar al menos un ${campo.label.toLowerCase()}`;
                        errorDiv.style.display = 'block';
                        errorDiv.className = 'text-danger';
                    }
                    esValido = false;
                } else {
                    if (errorDiv) {
                        errorDiv.textContent = '';
                        errorDiv.style.display = 'none';
                    }
                }
            }
            return;
        }
        
        const elemento = document.getElementById(campo.name);
        const errorDiv = document.getElementById(`${campo.name}-error`);
        
        if (!elemento) return;
        
        elemento.classList.remove('is-invalid');
        if (errorDiv) errorDiv.textContent = '';
        
        if (campo.required && (!elemento.value || elemento.value.trim() === '')) {
            elemento.classList.add('is-invalid');
            if (errorDiv) errorDiv.textContent = `${campo.label} es obligatorio`;
            esValido = false;
        }
    });
    
    return esValido;
}

// ========== FUNCIONES DE ANIMALES (SUBFORM) ==========
function agregarAnimal(nombreCampo) {
    const container = document.getElementById(`${nombreCampo}-container`);
    const configCampo = encontrarConfiguracionCampo(nombreCampo);
    if (!configCampo) return;
    
    const numeroAnimal = container.children.length + 1;
    const animalDiv = document.createElement('div');
    animalDiv.className = 'card mb-3';
    animalDiv.id = `animal-${numeroAnimal}`;
    
    let camposHTML = '';
    configCampo.campos.forEach(campo => {
        const campoId = `animal_${numeroAnimal}_${campo.name}`;
        const requiredAttr = campo.required ? 'required' : '';
        let inputHTML = '';
        
        if (campo.type === 'select' && campo.opciones) {
            inputHTML = `<select class="form-select" id="${campoId}" name="${campoId}" ${requiredAttr}><option value="">Seleccione...</option>${campo.opciones.map(op => `<option value="${op.value}">${op.text}</option>`).join('')}</select>`;
        } else if (campo.type === 'select') {
            inputHTML = `<select class="form-select" id="${campoId}" name="${campoId}" ${requiredAttr}><option value="">Cargando...</option></select>`;
        } else {
            const minAttr = campo.min !== undefined ? `min="${campo.min}"` : '';
            inputHTML = `<input type="${campo.type}" class="form-control" id="${campoId}" name="${campoId}" placeholder="${campo.placeholder || ''}" ${minAttr} ${requiredAttr}>`;
        }
        
        camposHTML += `<div class="col-md-6 mb-2"><label class="form-label">${campo.label}</label>${inputHTML}</div>`;
    });
    
    animalDiv.innerHTML = `
        <div class="card-header d-flex justify-content-between align-items-center">
            <h6 class="mb-0">Animal #${numeroAnimal}</h6>
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="eliminarAnimal(${numeroAnimal})">Eliminar</button>
        </div>
        <div class="card-body"><div class="row">${camposHTML}</div></div>
    `;
    
    container.appendChild(animalDiv);
    cargarDatosSelectsAnimal(numeroAnimal, configCampo.campos);
}

function agregarAnimalExistente(numeroAnimal, datosAnimal) {
    const container = document.getElementById('animales-container');
    const configCampo = encontrarConfiguracionCampo('animales');
    if (!configCampo) return;
    
    const animalDiv = document.createElement('div');
    animalDiv.className = 'card mb-3';
    animalDiv.id = `animal-${numeroAnimal}`;
    
    let camposHTML = '';
    configCampo.campos.forEach(campo => {
        const campoId = `animal_${numeroAnimal}_${campo.name}`;
        const requiredAttr = campo.required ? 'required' : '';
        const valorActual = datosAnimal[campo.name] || '';
        let inputHTML = '';
        
        if (campo.type === 'select' && campo.opciones) {
            const opcionesHTML = campo.opciones.map(op => `<option value="${op.value}" ${op.value === valorActual ? 'selected' : ''}>${op.text}</option>`).join('');
            inputHTML = `<select class="form-select" id="${campoId}" name="${campoId}" ${requiredAttr}><option value="">Seleccione...</option>${opcionesHTML}</select>`;
        } else if (campo.type === 'select') {
            inputHTML = `<select class="form-select" id="${campoId}" name="${campoId}" ${requiredAttr}><option value="">Cargando...</option></select>`;
        } else {
            const minAttr = campo.min !== undefined ? `min="${campo.min}"` : '';
            inputHTML = `<input type="${campo.type}" class="form-control" id="${campoId}" name="${campoId}" value="${valorActual}" placeholder="${campo.placeholder || ''}" ${minAttr} ${requiredAttr}>`;
        }
        
        camposHTML += `<div class="col-md-6 mb-2"><label class="form-label">${campo.label}</label>${inputHTML}</div>`;
    });
    
    animalDiv.innerHTML = `
        <div class="card-header d-flex justify-content-between align-items-center">
            <h6 class="mb-0">Animal #${numeroAnimal}</h6>
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="eliminarAnimal(${numeroAnimal})">Eliminar</button>
        </div>
        <div class="card-body"><div class="row">${camposHTML}</div></div>
    `;
    
    container.appendChild(animalDiv);
    cargarDatosSelectsAnimalExistente(numeroAnimal, configCampo.campos, datosAnimal);
}

async function cargarDatosSelectsAnimal(numeroAnimal, campos) {
    for (const campo of campos) {
        if (campo.type === 'select' && campo.endpoint) {
            try {
                const response = await fetch(campo.endpoint);
                const result = await response.json();
                
                if (result.success) {
                    const select = document.getElementById(`animal_${numeroAnimal}_${campo.name}`);
                    select.innerHTML = '<option value="">Seleccione...</option>';
                    
                    result.data.forEach(item => {
                        const option = document.createElement('option');
                        option.value = item.ID_ESPECIE || item.id_especie;
                        option.textContent = item.NOMBRE_CIENTIFICO || item.nombre_cientifico;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error(`Error cargando datos para ${campo.name}:`, error);
            }
        }
    }
}

async function cargarDatosSelectsAnimalExistente(numeroAnimal, campos, datosAnimal) {
    for (const campo of campos) {
        if (campo.type === 'select' && campo.endpoint) {
            try {
                const response = await fetch(campo.endpoint);
                const result = await response.json();
                
                if (result.success) {
                    const select = document.getElementById(`animal_${numeroAnimal}_${campo.name}`);
                    select.innerHTML = '<option value="">Seleccione...</option>';
                    
                    result.data.forEach(item => {
                        const option = document.createElement('option');
                        const valorItem = item.ID_ESPECIE || item.id_especie;
                        const textoItem = item.NOMBRE_CIENTIFICO || item.nombre_cientifico;
                        
                        option.value = valorItem;
                        option.textContent = textoItem;
                        
                        if (valorItem == datosAnimal[campo.name]) {
                            option.selected = true;
                        }
                        
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error(`Error cargando datos para ${campo.name}:`, error);
            }
        }
    }
}

function encontrarConfiguracionCampo(nombreCampo) {
    return configuracionActual.campos.find(campo => campo.name === nombreCampo);
}

function eliminarAnimal(numeroAnimal) {
    const animalDiv = document.getElementById(`animal-${numeroAnimal}`);
    if (animalDiv) animalDiv.remove();
}

// ========== FUNCIONES DE INTERFAZ ==========
function mostrarLoading(mostrar) {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.setProperty('display', mostrar ? 'flex' : 'none', 'important');
}

function mostrarError(mensaje) {
    mostrarAlerta(mensaje, 'danger');
}

function mostrarExito(mensaje) {
    mostrarAlerta(mensaje, 'success');
}

function mostrarAlerta(mensaje, tipo) {
    const alertasExistentes = document.querySelectorAll('.alert');
    alertasExistentes.forEach(alerta => alerta.remove());
    
    const alerta = document.createElement('div');
    alerta.className = `alert alert-${tipo} alert-dismissible fade show`;
    alerta.innerHTML = `${mensaje}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    
    const container = document.querySelector('.container');
    container.insertBefore(alerta, container.firstChild);
    
    setTimeout(() => {
        if (alerta.parentNode) alerta.remove();
    }, 5000);
}

function volver() {
    if (confirm('¿Estás seguro de que deseas salir? Los cambios no guardados se perderán.')) {
        window.location.href = configuracionActual.dashboardUrl;
    }
}