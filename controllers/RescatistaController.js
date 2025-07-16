const { executeQuery, executeNonQuery } = require('../config/database');

const RescatistaController = {
    
    // Obtener todos los rescates con información del rescatista
    getAllRescates: async (req, res) => {
        try {
            const query = `
                SELECT 
                    r.id_rescate,
                    TO_CHAR(r.fecha_rescate, 'YYYY-MM-DD') as fecha_rescate,
                    r.lugar,
                    r.detalles,
                    r.id_rescatista,
                    e.nombre || ' ' || e.apellidos as nombre_rescatista
                FROM Rescates r
                INNER JOIN Empleados e ON r.id_rescatista = e.id_empleado
                ORDER BY r.fecha_rescate DESC
            `;
            
            const rescates = await executeQuery(query);
            
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

    // NUEVO: Obtener un rescate específico por ID (para editar)
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
            
            const query = `
                SELECT 
                    r.id_rescate,
                    TO_CHAR(r.fecha_rescate, 'YYYY-MM-DD') as fecha_rescate,
                    r.lugar,
                    r.detalles,
                    r.id_rescatista
                FROM Rescates r
                WHERE r.id_rescate = :1
            `;
            
            const rescate = await executeQuery(query, [id]);
            
            if (rescate.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Rescate no encontrado'
                });
            }
            
            res.status(200).json({
                success: true,
                data: rescate[0],
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

    // NUEVO: Obtener todos los empleados (para el select de rescatistas)
    getAllEmpleados: async (req, res) => {
        try {
            const query = `
                SELECT 
                    id_empleado,
                    nombre,
                    apellidos,
                    nombre || ' ' || apellidos as nombre_completo
                FROM Empleados
                ORDER BY nombre, apellidos
            `;
            
            const empleados = await executeQuery(query);
            
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

    // Crear nuevo rescate
    createRescate: async (req, res) => {
        try {
            const { fecha_rescate, lugar, detalles, id_rescatista } = req.body;
            
            // Validar datos requeridos
            if (!fecha_rescate || !lugar || !detalles || !id_rescatista) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos los campos son obligatorios'
                });
            }
            
            // Verificar que el rescatista existe
            const rescatistaExists = await executeQuery(
                'SELECT id_empleado FROM Empleados WHERE id_empleado = :1',
                [id_rescatista]
            );
            
            if (rescatistaExists.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'El rescatista especificado no existe'
                });
            }
            
            // Obtener el próximo ID
            const maxIdResult = await executeQuery(
                'SELECT NVL(MAX(id_rescate), 0) + 1 as next_id FROM Rescates'
            );
            const nextId = maxIdResult[0].NEXT_ID;
            
            // Insertar nuevo rescate
            const insertQuery = `
                INSERT INTO Rescates (id_rescate, fecha_rescate, lugar, detalles, id_rescatista)
                VALUES (:1, TO_DATE(:2, 'YYYY-MM-DD'), :3, :4, :5)
            `;
            
            await executeNonQuery(insertQuery, [
                nextId,
                fecha_rescate,
                lugar,
                detalles,
                id_rescatista
            ]);
            
            res.status(201).json({
                success: true,
                message: 'Rescate creado exitosamente',
                data: {
                    id_rescate: nextId,
                    fecha_rescate,
                    lugar,
                    detalles,
                    id_rescatista
                }
            });
            
        } catch (error) {
            console.error('Error al crear rescate:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Actualizar rescate existente
    updateRescate: async (req, res) => {
        try {
            const { id } = req.params;
            const { fecha_rescate, lugar, detalles, id_rescatista } = req.body;
            
            // Validar que el ID del rescate sea válido
            if (!id || isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de rescate inválido'
                });
            }
            
            // Verificar que el rescate existe
            const rescateExists = await executeQuery(
                'SELECT id_rescate FROM Rescates WHERE id_rescate = :1',
                [id]
            );
            
            if (rescateExists.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'El rescate especificado no existe'
                });
            }
            
            // Validar datos requeridos
            if (!fecha_rescate || !lugar || !detalles || !id_rescatista) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos los campos son obligatorios'
                });
            }
            
            // Verificar que el rescatista existe
            const rescatistaExists = await executeQuery(
                'SELECT id_empleado FROM Empleados WHERE id_empleado = :1',
                [id_rescatista]
            );
            
            if (rescatistaExists.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'El rescatista especificado no existe'
                });
            }
            
            // Actualizar rescate
            const updateQuery = `
                UPDATE Rescates 
                SET fecha_rescate = TO_DATE(:1, 'YYYY-MM-DD'),
                    lugar = :2,
                    detalles = :3,
                    id_rescatista = :4
                WHERE id_rescate = :5
            `;
            
            await executeNonQuery(updateQuery, [
                fecha_rescate,
                lugar,
                detalles,
                id_rescatista,
                id
            ]);
            
            res.status(200).json({
                success: true,
                message: 'Rescate actualizado exitosamente',
                data: {
                    id_rescate: parseInt(id),
                    fecha_rescate,
                    lugar,
                    detalles,
                    id_rescatista
                }
            });
            
        } catch (error) {
            console.error('Error al actualizar rescate:', error);
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
            const rescateExists = await executeQuery(
                'SELECT id_rescate FROM Rescates WHERE id_rescate = :1',
                [id]
            );
            
            if (rescateExists.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'El rescate especificado no existe'
                });
            }
            
            // Verificar si el rescate tiene animales asociados
            const animalesAsociados = await executeQuery(
                'SELECT COUNT(*) as total FROM Animales WHERE id_rescate = :1',
                [id]
            );
            
            if (animalesAsociados[0].TOTAL > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede eliminar el rescate porque tiene animales asociados'
                });
            }
            
            // Eliminar rescate
            const deleteQuery = 'DELETE FROM Rescates WHERE id_rescate = :1';
            const filasAfectadas = await executeNonQuery(deleteQuery, [id]);
            
            res.status(200).json({
                success: true,
                message: 'Rescate eliminado exitosamente',
                data: {
                    id_rescate: parseInt(id),
                    filasAfectadas
                }
            });
            
        } catch (error) {
            console.error('Error al eliminar rescate:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

};

module.exports = RescatistaController;