// Cargar todos los rescates al iniciar la página
async function cargarRescates() {
    try {
        const response = await fetch('/api/rescates');
        const result = await response.json();
                
        if (result.success) {
            mostrarRescatesEnTabla(result.data);
        } else {
            console.error('Error al cargar rescates:', result.message);
            mostrarMensaje('Error al cargar los rescates', 'error');
        }
    } catch (error) {
        console.error('Error de conexión:', error);
        mostrarMensaje('Error de conexión con el servidor', 'error');
    }
}

function mostrarRescatesEnTabla(rescates) {
    const tbody = document.querySelector('table tbody');
    
    // Limpiar tabla existente
    tbody.innerHTML = '';
    
    // Si no hay rescates
    if (rescates.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">No hay rescates registrados</td>
            </tr>
        `;
        return;
    }
    
    // Llenar tabla con rescates
    rescates.forEach(rescate => {
        //Procesar información de animales
        let animalesNombres = 'Sin animales';
        let animalesEspecies = 'N/A';
        
        if (rescate.animales && rescate.animales.length > 0) {
            animalesNombres = rescate.animales
                .map(animal => animal.nombre)
                .join(', ');
            
            animalesEspecies = rescate.animales
                .map(animal => animal.especie || 'Especie no registrada')
                .join(', ');
        }
        
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${rescate.ID_RESCATE}</td>
            <td>${rescate.FECHA_RESCATE}</td>
            <td>${rescate.LUGAR}</td>
            <td>${rescate.DETALLES}</td>
            <td>
                <small>${animalesNombres}</small>
            </td>
            <td>
                <small class="text-muted">${animalesEspecies}</small>
            </td>
            <td><span class="badge bg-info">Registrado</span></td>
            <td>
                <button type="button" class="btn btn-sm btn-primary me-1" onclick="editarRescate(${rescate.ID_RESCATE})">
                    Editar
                </button>
                <button type="button" class="btn btn-sm btn-danger" onclick="confirmarEliminar(${rescate.ID_RESCATE})">
                    Eliminar
                </button>
            </td>
        `;
        tbody.appendChild(fila);
    });
}

// Eliminar rescate
async function eliminarRescate(id) {
    try {
        const response = await fetch(`/api/rescates/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            mostrarMensaje('Rescate eliminado exitosamente', 'success');
            cargarRescates(); // Recargar tabla
        } else {
            mostrarMensaje(result.message, 'error');
        }
    } catch (error) {
        console.error('Error al eliminar rescate:', error);
        mostrarMensaje('Error al eliminar el rescate', 'error');
    }
}

// Confirmar eliminación
function confirmarEliminar(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este rescate?')) {
        eliminarRescate(id);
    }
}

// ======= FUNCIONES PRINCIPALES =======

// Función para agregar rescate - Redirige al formulario dinámico
function agregarRescate() {
    window.location.href = '/html/formulario?tipo=rescates&modo=crear';
}

// Función para editar rescate - Redirige al formulario dinámico con ID
function editarRescate(id) {
    window.location.href = `/html/formulario?tipo=rescates&modo=editar&id=${id}`;
}

// Mostrar mensajes al usuario
function mostrarMensaje(mensaje, tipo) {
    const alerta = document.createElement('div');
    alerta.className = `alert alert-${tipo === 'success' ? 'success' : 'danger'} alert-dismissible fade show`;
    alerta.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container');
    container.insertBefore(alerta, container.firstChild);
    
    setTimeout(() => {
        if (alerta.parentNode) {
            alerta.remove();
        }
    }, 5000);
}

// ======= Eventos =======
document.addEventListener('DOMContentLoaded', function() {
    // Cargar rescates al iniciar
    cargarRescates();
    
    // Conectar botón "Agregar"
    const btnAgregar = document.querySelector('.btn-success');
    if (btnAgregar) {
        btnAgregar.addEventListener('click', agregarRescate);
    }
});