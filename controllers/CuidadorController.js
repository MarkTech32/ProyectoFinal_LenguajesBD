// Importar funciones de base de datos
const { executeQuery, executeNonQuery } = require('../config/database');

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

// Verificar si el usuario es cuidador
const isCuidador = async (idEmpleado) => {
    try {
        const result = await executeQuery(
            'SELECT id_rol FROM Empleados_Roles WHERE id_empleado = :1 AND id_rol = 3',
            [idEmpleado]
        );
        return result.length > 0;
    } catch (error) {
        console.error('Error verificando rol de cuidador:', error);
        return false;
    }
};

// ========== CONTROLLER ==========
const CuidadorController = {
    
    // Obtener todos los animales en cuidado (asignados a cuidadores)
    getAnimalesEnCuidado: async (req, res) => {
        try {
            const query = `
                SELECT 
                    a.id_animal,
                    a.nombre as nombre_animal,
                    esp.nombre_cientifico,
                    ec.nombre || ' ' || ec.apellidos as nombre_cuidador,
                    TO_CHAR(t.fecha_fin, 'YYYY-MM-DD') as fecha_asignacion,
                    t.descripcion_tratamiento as diagnostico_final,
                    t.id_tratamiento,
                    t.id_cuidador,
                    -- Obtener última observación de cuidador
                    (SELECT observacion 
                     FROM Observaciones_Cuidador oc 
                     WHERE oc.id_tratamiento = t.id_tratamiento 
                     AND oc.fecha_observacion = (
                         SELECT MAX(fecha_observacion) 
                         FROM Observaciones_Cuidador 
                         WHERE id_tratamiento = t.id_tratamiento
                     )
                     AND ROWNUM = 1
                    ) as ultima_observacion,
                    -- Obtener estado de la última observación
                    (SELECT estado_animal 
                     FROM Observaciones_Cuidador oc 
                     WHERE oc.id_tratamiento = t.id_tratamiento 
                     AND oc.fecha_observacion = (
                         SELECT MAX(fecha_observacion) 
                         FROM Observaciones_Cuidador 
                         WHERE id_tratamiento = t.id_tratamiento
                     )
                     AND ROWNUM = 1
                    ) as estado_animal
                FROM Tratamientos t
                INNER JOIN Animales a ON t.id_animal = a.id_animal
                INNER JOIN Especies esp ON a.id_especie = esp.id_especie
                INNER JOIN Empleados ec ON t.id_cuidador = ec.id_empleado
                WHERE t.estado_tratamiento = 'COMPLETADO'
                AND t.id_cuidador IS NOT NULL
                ORDER BY t.fecha_fin DESC
            `;
            
            const animales = await executeQuery(query);
            sendSuccess(res, animales, 'Animales en cuidado obtenidos exitosamente');
        } catch (error) {
            handleError(res, error, 'Error al obtener animales en cuidado');
        }
    },

    // Obtener historial de observaciones de un animal específico
    getHistorialObservaciones: async (req, res) => {
        try {
            const { id } = req.params; // ID del tratamiento
            
            if (!validateId(id)) {
                return sendError(res, 'ID de tratamiento inválido');
            }
            
            const query = `
                SELECT 
                    oc.id_observacion,
                    TO_CHAR(oc.fecha_observacion, 'YYYY-MM-DD HH24:MI:SS') as fecha_observacion,
                    oc.observacion,
                    oc.estado_animal,
                    e.nombre || ' ' || e.apellidos as nombre_cuidador
                FROM Observaciones_Cuidador oc
                INNER JOIN Empleados e ON oc.id_cuidador = e.id_empleado
                WHERE oc.id_tratamiento = :1
                ORDER BY oc.fecha_observacion DESC
            `;
            
            const observaciones = await executeQuery(query, [id]);
            sendSuccess(res, observaciones, 'Historial de observaciones obtenido exitosamente');
        } catch (error) {
            handleError(res, error, 'Error al obtener historial de observaciones');
        }
    },

    // Agregar nueva observación de cuidador
    agregarObservacion: async (req, res) => {
        try {
            const { id_tratamiento, observacion, estado_animal } = req.body;
            const id_cuidador = req.session.user.id;
            
            // Verificar que el usuario sea cuidador
            if (!await isCuidador(id_cuidador)) {
                return sendError(res, 'Solo los cuidadores pueden agregar observaciones', 403);
            }
            
            // Validar datos requeridos
            if (!id_tratamiento || !observacion || !estado_animal) {
                return sendError(res, 'Todos los campos son obligatorios');
            }
            
            // Verificar que el tratamiento existe y está asignado al cuidador
            const tratamientoQuery = `
                SELECT id_tratamiento, id_cuidador 
                FROM Tratamientos 
                WHERE id_tratamiento = :1 AND id_cuidador = :2
            `;
            const tratamiento = await executeQuery(tratamientoQuery, [id_tratamiento, id_cuidador]);
            
            if (tratamiento.length === 0) {
                return sendError(res, 'Tratamiento no encontrado o no asignado a este cuidador', 404);
            }
            
            // Obtener próximo ID
            const nextIdResult = await executeQuery(
                'SELECT NVL(MAX(id_observacion), 0) + 1 as next_id FROM Observaciones_Cuidador'
            );
            const nextId = nextIdResult[0].NEXT_ID;
            
            // Insertar nueva observación
            const insertQuery = `
                INSERT INTO Observaciones_Cuidador 
                (id_observacion, id_tratamiento, id_cuidador, observacion, estado_animal)
                VALUES (:1, :2, :3, :4, :5)
            `;
            
            await executeNonQuery(insertQuery, [
                nextId, 
                id_tratamiento, 
                id_cuidador, 
                observacion, 
                estado_animal
            ]);
            
            sendSuccess(res, {
                id_observacion: nextId,
                id_tratamiento: parseInt(id_tratamiento),
                id_cuidador: parseInt(id_cuidador),
                observacion,
                estado_animal,
                fecha_observacion: new Date().toISOString()
            }, 'Observación agregada exitosamente', 201);
            
        } catch (error) {
            handleError(res, error, 'Error al agregar observación');
        }
    }
};

module.exports = CuidadorController;