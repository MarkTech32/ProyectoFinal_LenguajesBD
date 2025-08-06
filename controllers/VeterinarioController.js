// Importar modelos
const Tratamiento = require('../models/Tratamiento');
const Animal = require('../models/Animal');
const Empleado = require('../models/Empleado');
const { executeQuery } = require('../config/database');

// ========== HELPERS GENÉRICOS ==========
const handleError = (res, error, message = 'Error interno del servidor') => {
    console.error(message, error);
    res.status(500).json({
        success: false,
        message,
        error: error.message
    });
};

const validateId = (id) => id && !isNaN(id);

const sendSuccess = (res, data, message, status = 200) => {
    res.status(status).json({
        success: true,
        data,
        message
    });
};

const sendError = (res, message, status = 400) => {
    res.status(status).json({
        success: false,
        message
    });
};

// Verificar si el usuario es veterinario
const isVeterinario = async (idEmpleado) => {
    try {
        const result = await executeQuery(
            'SELECT id_rol FROM Empleados_Roles WHERE id_empleado = :1 AND id_rol = 2',
            [idEmpleado]
        );
        return result.length > 0;
    } catch (error) {
        console.error('Error verificando rol de veterinario:', error);
        return false;
    }
};

// ========== CONTROLLER ==========
const VeterinarioController = {
    
    // Obtener animales pendientes de tratamiento
    getAnimalesPendientes: async (req, res) => {
        try {
            const animales = await Tratamiento.getAnimalesPendientes();
            sendSuccess(res, animales, 'Animales pendientes obtenidos exitosamente');
        } catch (error) {
            handleError(res, error, 'Error al obtener animales pendientes');
        }
    },

    // Obtener animales en tratamiento activo
    getAnimalesEnTratamiento: async (req, res) => {
        try {
            const tratamientos = await Tratamiento.getAnimalesEnTratamiento();
            sendSuccess(res, tratamientos, 'Tratamientos activos obtenidos exitosamente');
        } catch (error) {
            handleError(res, error, 'Error al obtener tratamientos activos');
        }
    },

    // Obtener animales listos para cuidadores
    getAnimalesListos: async (req, res) => {
        try {
            const animales = await Tratamiento.getAnimalesListos();
            sendSuccess(res, animales, 'Animales listos para cuidadores obtenidos exitosamente');
        } catch (error) {
            handleError(res, error, 'Error al obtener animales listos');
        }
    },

    // Completar tratamiento
    completarTratamiento: async (req, res) => {
        try {
            const { id } = req.params;

            if (!validateId(id)) {
                return sendError(res, 'ID de tratamiento inválido');
            }

            // Verificar que el usuario sea veterinario
            if (!await isVeterinario(req.session.user.id)) {
                return sendError(res, 'Solo los veterinarios pueden completar tratamientos', 403);
            }

            const resultado = await Tratamiento.completar(id);

            if (!resultado.success) {
                return sendError(res, resultado.message, 404);
            }

            sendSuccess(res, resultado.data, 'Tratamiento completado exitosamente');

        } catch (error) {
            handleError(res, error, 'Error al completar tratamiento');
        }
    },

    // Crear nuevo tratamiento 
    createTratamiento: async (req, res) => {
        try {
            const { id_animal, descripcion_tratamiento, observaciones_cuidado } = req.body;
            
            // Obtener veterinario de la sesión
            const id_veterinario = req.session.user.id;
            
            // Verificar que el usuario sea veterinario
            if (!await isVeterinario(id_veterinario)) {
                return sendError(res, 'Solo los veterinarios pueden crear tratamientos', 403);
            }
            
            // Validar datos requeridos
            if (!id_animal || !descripcion_tratamiento) {
                return sendError(res, 'ID del animal y descripción del tratamiento son obligatorios');
            }
            
            // Verificar que el animal existe
            if (!await Animal.exists(id_animal)) {
                return sendError(res, 'El animal especificado no existe', 404);
            }
            
            // Buscar el tratamiento PENDIENTE del animal
            const tratamientoPendiente = await executeQuery(
                'SELECT id_tratamiento FROM Tratamientos WHERE id_animal = :1 AND estado_tratamiento = \'PENDIENTE\'',
                [id_animal]
            );
            
            if (tratamientoPendiente.length === 0) {
                return sendError(res, 'No se encontró un tratamiento pendiente para este animal', 404);
            }
            
            const idTratamiento = tratamientoPendiente[0].ID_TRATAMIENTO;
            
            // Actualizar el tratamiento pendiente a EN_TRATAMIENTO
            const actualizado = await Tratamiento.update(idTratamiento, {
                id_veterinario,
                descripcion_tratamiento,
                observaciones_cuidado,
                fecha_inicio: new Date().toISOString().split('T')[0],
                estado_tratamiento: 'EN_TRATAMIENTO'
            });
            
            if (!actualizado) {
                return sendError(res, 'No se pudo iniciar el tratamiento', 500);
            }
            
            sendSuccess(res, {
                id_tratamiento: idTratamiento,
                id_animal,
                id_veterinario,
                descripcion_tratamiento,
                observaciones_cuidado,
                estado_tratamiento: 'EN_TRATAMIENTO'
            }, 'Tratamiento iniciado exitosamente', 201);
            
        } catch (error) {
            handleError(res, error, 'Error al crear tratamiento');
        }
    },

    // Obtener tratamiento por ID
    getTratamientoById: async (req, res) => {
        try {
            const { id } = req.params;

            if (!validateId(id)) {
                return sendError(res, 'ID de tratamiento inválido');
            }

            const tratamiento = await Tratamiento.getById(id);

            if (!tratamiento) {
                return sendError(res, 'Tratamiento no encontrado', 404);
            }

            sendSuccess(res, tratamiento, 'Tratamiento obtenido exitosamente');

        } catch (error) {
            handleError(res, error, 'Error al obtener tratamiento');
        }
    },

    // Actualizar tratamiento
    updateTratamiento: async (req, res) => {
        try {
            const { id } = req.params;
            const { descripcion_tratamiento, observaciones_cuidado, estado_tratamiento } = req.body;
            
            if (!validateId(id)) {
                return sendError(res, 'ID de tratamiento inválido');
            }
            
            // Verificar que el usuario sea veterinario
            if (!await isVeterinario(req.session.user.id)) {
                return sendError(res, 'Solo los veterinarios pueden actualizar tratamientos', 403);
            }
            
            // Verificar existencia
            const tratamientoExists = await Tratamiento.exists(id);
            if (!tratamientoExists) {
                return sendError(res, 'El tratamiento especificado no existe', 404);
            }
            
            // Actualizar
            const actualizado = await Tratamiento.update(id, {
                descripcion_tratamiento,
                observaciones_cuidado,
                estado_tratamiento
            });
            
            if (!actualizado) {
                return sendError(res, 'No se pudo actualizar el tratamiento', 500);
            }
            
            sendSuccess(res, {
                id_tratamiento: parseInt(id),
                descripcion_tratamiento,
                observaciones_cuidado,
                estado_tratamiento
            }, 'Tratamiento actualizado exitosamente');
            
        } catch (error) {
            handleError(res, error, 'Error al actualizar tratamiento');
        }
    }
};

module.exports = VeterinarioController;