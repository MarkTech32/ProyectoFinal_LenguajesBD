// Importar modelos
const Tratamiento = require('../models/Tratamiento');
const Animal = require('../models/Animal');
const Empleado = require('../models/Empleado');

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
            const { id_animal, id_veterinario, descripcion_tratamiento, observaciones_cuidado } = req.body;
            
            // Validar datos requeridos
            if (!id_animal || !id_veterinario || !descripcion_tratamiento) {
                return sendError(res, 'ID del animal, veterinario y descripción del tratamiento son obligatorios');
            }
            
            // Verificar existencias en paralelo
            const [animalExists, veterinarioExists, tieneTraTamientoActivo] = await Promise.all([
                Animal.exists(id_animal),
                Empleado.exists(id_veterinario),
                Tratamiento.hasActiveTreatment(id_animal)
            ]);
            
            if (!animalExists) {
                return sendError(res, 'El animal especificado no existe', 404);
            }
            
            if (!veterinarioExists) {
                return sendError(res, 'El veterinario especificado no existe', 404);
            }
            
            if (tieneTraTamientoActivo) {
                return sendError(res, 'El animal ya tiene un tratamiento activo');
            }
            
            // Crear tratamiento
            const resultado = await Tratamiento.create({
                id_animal,
                id_veterinario,
                descripcion_tratamiento,
                observaciones_cuidado
            });
            
            sendSuccess(res, resultado, 'Tratamiento creado exitosamente', 201);
            
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