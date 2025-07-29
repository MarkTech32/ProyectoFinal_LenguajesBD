// Importar modelos
const Rescate = require('../models/Rescate');
const Empleado = require('../models/Empleado');
const Especie = require('../models/Especie');

const RescatistaController = {
    
    // Obtener todos los rescates con sus animales
    getAllRescates: async (req, res) => {
        try {
            const rescates = await Rescate.getAll();
            
            res.status(200).json({
                success: true,
                data: rescates,
                message: 'Rescates obtenidos exitosamente'
            });
            
        } catch (error) {
            console.error('Error al obtener rescates:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener un rescate específico por ID con sus animales
    getRescateById: async (req, res) => {
        try {
            const { id } = req.params;

            // Validar que el ID sea válido
            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de rescate inválido'
                });
            }

            const rescate = await Rescate.getById(id);

            if (!rescate) {
                return res.status(404).json({
                    success: false,
                    message: 'Rescate no encontrado'
                });
            }

            res.status(200).json({
                success: true,
                data: rescate,
                message: 'Rescate obtenido exitosamente'
            });

        } catch (error) {
            console.error('Error al obtener rescate:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener todos los empleados (para el select de rescatistas)
    getAllEmpleados: async (req, res) => {
        try {
            const empleados = await Empleado.getAll();
            
            res.status(200).json({
                success: true,
                data: empleados,
                message: 'Empleados obtenidos exitosamente'
            });
            
        } catch (error) {
            console.error('Error al obtener empleados:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Crear nuevo rescate CON ANIMALES
    createRescate: async (req, res) => {
        try {
            const { fecha_rescate, lugar, detalles, id_rescatista, animales } = req.body;
            
            // Validar datos requeridos del rescate
            if (!fecha_rescate || !lugar || !detalles || !id_rescatista) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos los campos del rescate son obligatorios'
                });
            }
            
            // Validar si hay al menos un animal
            if (!animales || !Array.isArray(animales) || animales.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe incluir al menos un animal en el rescate'
                });
            }
            
            // Verificar que el rescatista existe
            const rescatistaExists = await Empleado.exists(id_rescatista);
            if (!rescatistaExists) {
                return res.status(404).json({
                    success: false,
                    message: 'El rescatista especificado no existe'
                });
            }
            
            // Crear el rescate con sus animales
            const resultado = await Rescate.create({
                fecha_rescate,
                lugar,
                detalles,
                id_rescatista,
                animales
            });
            
            res.status(201).json({
                success: true,
                message: 'Rescate y animales creados exitosamente',
                data: resultado
            });
            
        } catch (error) {
            console.error('Error al crear rescate con animales:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Actualizar rescate existente CON SUS ANIMALES
    updateRescate: async (req, res) => {
        try {
            const { id } = req.params;
            const { fecha_rescate, lugar, detalles, id_rescatista, animales } = req.body;
            
            // Validar que el ID del rescate sea válido
            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de rescate inválido'
                });
            }
            
            // Verificar que el rescate existe
            const rescateExists = await Rescate.exists(id);
            if (!rescateExists) {
                return res.status(404).json({
                    success: false,
                    message: 'El rescate especificado no existe'
                });
            }
            
            // Validar datos requeridos del rescate
            if (!fecha_rescate || !lugar || !detalles || !id_rescatista) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos los campos del rescate son obligatorios'
                });
            }
            
            // Validar que hay al menos un animal
            if (!animales || !Array.isArray(animales) || animales.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe incluir al menos un animal en el rescate'
                });
            }
            
            // Verificar que el rescatista existe
            const rescatistaExists = await Empleado.exists(id_rescatista);
            if (!rescatistaExists) {
                return res.status(404).json({
                    success: false,
                    message: 'El rescatista especificado no existe'
                });
            }
            
            // Actualizar el rescate con sus animales
            const resultado = await Rescate.update(id, {
                fecha_rescate,
                lugar,
                detalles,
                id_rescatista,
                animales
            });
            
            res.status(200).json({
                success: true,
                message: 'Rescate y animales actualizados exitosamente',
                data: resultado
            });
            
        } catch (error) {
            console.error('Error al actualizar rescate con animales:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Eliminar rescate 
    deleteRescate: async (req, res) => {
        try {
            const { id } = req.params;

            // Validar que el ID del rescate sea válido
            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de rescate inválido'
                });
            }

            // Verificar que el rescate existe
            const rescateExists = await Rescate.exists(id);
            if (!rescateExists) {
                return res.status(404).json({
                    success: false,
                    message: 'El rescate especificado no existe'
                });
            }

            // Eliminar el rescate y sus animales asociados
            const resultado = await Rescate.delete(id);

            res.status(200).json({
                success: true,
                message: 'Rescate y animales asociados eliminados exitosamente',
                data: resultado
            });

        } catch (error) {
            console.error('Error al eliminar rescate con animales:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener todas las especies (para el select del formulario)
    getAllEspecies: async (req, res) => {
        try {
            const especies = await Especie.getAll();
            
            res.status(200).json({
                success: true,
                data: especies,
                message: 'Especies obtenidas exitosamente'
            });
            
        } catch (error) {
            console.error('Error al obtener especies:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
};

module.exports = RescatistaController;