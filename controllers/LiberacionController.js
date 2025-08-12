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

// Verificar si el usuario es rescatista
const isRescatista = async (idEmpleado) => {
    try {
        const result = await executeQuery(
            'SELECT id_rol FROM Empleados_Roles WHERE id_empleado = :1 AND id_rol = 1',
            [idEmpleado]
        );
        return result.length > 0;
    } catch (error) {
        console.error('Error verificando rol de rescatista:', error);
        return false;
    }
};

// ========== CONTROLLER ==========
const LiberacionController = {
    
    // Obtener animales listos para liberar (con estado "Listo para liberación")
    getAnimalesListosParaLiberar: async (req, res) => {
        try {
            const query = `
                SELECT 
                    a.id_animal,
                    a.nombre as nombre_animal,
                    esp.nombre_cientifico,
                    ec.nombre || ' ' || ec.apellidos as nombre_cuidador,
                    t.id_tratamiento,
                    -- Última observación con estado "Listo para liberación"
                    (SELECT observacion 
                     FROM Observaciones_Cuidador oc 
                     WHERE oc.id_tratamiento = t.id_tratamiento 
                     AND oc.estado_animal = 'Listo para liberación'
                     AND oc.fecha_observacion = (
                         SELECT MAX(fecha_observacion) 
                         FROM Observaciones_Cuidador 
                         WHERE id_tratamiento = t.id_tratamiento 
                         AND estado_animal = 'Listo para liberación'
                     )
                     AND ROWNUM = 1
                    ) as ultima_observacion,
                    -- Fecha de la última observación
                    (SELECT TO_CHAR(fecha_observacion, 'YYYY-MM-DD')
                     FROM Observaciones_Cuidador oc 
                     WHERE oc.id_tratamiento = t.id_tratamiento 
                     AND oc.estado_animal = 'Listo para liberación'
                     AND oc.fecha_observacion = (
                         SELECT MAX(fecha_observacion) 
                         FROM Observaciones_Cuidador 
                         WHERE id_tratamiento = t.id_tratamiento 
                         AND estado_animal = 'Listo para liberación'
                     )
                     AND ROWNUM = 1
                    ) as fecha_preparacion
                FROM Tratamientos t
                INNER JOIN Animales a ON t.id_animal = a.id_animal
                INNER JOIN Especies esp ON a.id_especie = esp.id_especie
                INNER JOIN Empleados ec ON t.id_cuidador = ec.id_empleado
                WHERE t.estado_tratamiento = 'COMPLETADO'
                AND t.id_cuidador IS NOT NULL
                -- Solo animales que no han sido liberados aún
                AND NOT EXISTS (
                    SELECT 1 FROM Liberaciones l WHERE l.id_animal = a.id_animal
                )
                -- Solo animales con estado "Listo para liberación"
                AND EXISTS (
                    SELECT 1 FROM Observaciones_Cuidador oc 
                    WHERE oc.id_tratamiento = t.id_tratamiento 
                    AND oc.estado_animal = 'Listo para liberación'
                )
                ORDER BY fecha_preparacion DESC
            `;
            
            const animales = await executeQuery(query);
            sendSuccess(res, animales, 'Animales listos para liberar obtenidos exitosamente');
        } catch (error) {
            handleError(res, error, 'Error al obtener animales listos para liberar');
        }
    },

    // Obtener animales que ya fueron liberados
    getAnimalesLiberados: async (req, res) => {
        try {
            const query = `
                SELECT 
                    l.id_liberacion,
                    a.id_animal,
                    a.nombre as nombre_animal,
                    esp.nombre_cientifico,
                    TO_CHAR(l.fecha_liberacion, 'YYYY-MM-DD') as fecha_liberacion,
                    l.lugar_liberacion,
                    er.nombre || ' ' || er.apellidos as nombre_rescatista,
                    l.observaciones,
                    -- Contar seguimientos post-liberación
                    (SELECT COUNT(*) 
                     FROM Seguimiento_Post_Liberacion spl 
                     WHERE spl.id_liberacion = l.id_liberacion
                    ) as total_seguimientos,
                    -- Último seguimiento
                    (SELECT TO_CHAR(MAX(fecha_seguimiento), 'YYYY-MM-DD')
                     FROM Seguimiento_Post_Liberacion spl 
                     WHERE spl.id_liberacion = l.id_liberacion
                    ) as ultimo_seguimiento
                FROM Liberaciones l
                INNER JOIN Animales a ON l.id_animal = a.id_animal
                INNER JOIN Especies esp ON a.id_especie = esp.id_especie
                INNER JOIN Empleados er ON l.id_rescatista = er.id_empleado
                ORDER BY l.fecha_liberacion DESC
            `;
            
            const animales = await executeQuery(query);
            sendSuccess(res, animales, 'Animales liberados obtenidos exitosamente');
        } catch (error) {
            handleError(res, error, 'Error al obtener animales liberados');
        }
    },

    // Crear liberación (rescatista toma animal y crea registro inicial)
    crearLiberacion: async (req, res) => {
        try {
            const { id_animal, lugar_liberacion, observaciones } = req.body;
            const id_rescatista = req.session.user.id;
            
            // Verificar que el usuario sea rescatista
            if (!await isRescatista(id_rescatista)) {
                return sendError(res, 'Solo los rescatistas pueden crear liberaciones', 403);
            }
            
            // Validar datos requeridos
            if (!id_animal || !lugar_liberacion || !observaciones) {
                return sendError(res, 'Todos los campos son obligatorios');
            }
            
            // Verificar que el animal existe y está listo para liberar
            const animalQuery = `
                SELECT a.id_animal, a.nombre
                FROM Animales a
                INNER JOIN Tratamientos t ON a.id_animal = t.id_animal
                WHERE a.id_animal = :1 
                AND t.estado_tratamiento = 'COMPLETADO'
                AND EXISTS (
                    SELECT 1 FROM Observaciones_Cuidador oc 
                    WHERE oc.id_tratamiento = t.id_tratamiento 
                    AND oc.estado_animal = 'Listo para liberación'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM Liberaciones l WHERE l.id_animal = a.id_animal
                )
            `;
            const animal = await executeQuery(animalQuery, [id_animal]);
            
            if (animal.length === 0) {
                return sendError(res, 'Animal no encontrado o no está listo para liberar', 404);
            }
            
            // Obtener próximo ID
            const nextIdResult = await executeQuery(
                'SELECT NVL(MAX(id_liberacion), 0) + 1 as next_id FROM Liberaciones'
            );
            const nextId = nextIdResult[0].NEXT_ID;
            
            // Crear liberación
            const insertQuery = `
                INSERT INTO Liberaciones 
                (id_liberacion, id_animal, fecha_liberacion, lugar_liberacion, observaciones, id_rescatista)
                VALUES (:1, :2, SYSDATE, :3, :4, :5)
            `;
            
            await executeNonQuery(insertQuery, [
                nextId, 
                id_animal, 
                lugar_liberacion, 
                observaciones, 
                id_rescatista
            ]);
            
            sendSuccess(res, {
                id_liberacion: nextId,
                id_animal: parseInt(id_animal),
                lugar_liberacion,
                observaciones,
                id_rescatista: parseInt(id_rescatista),
                fecha_liberacion: new Date().toISOString().split('T')[0],
                nombre_animal: animal[0].NOMBRE
            }, 'Liberación creada exitosamente', 201);
            
        } catch (error) {
            handleError(res, error, 'Error al crear liberación');
        }
    },

    // Obtener seguimientos de una liberación específica
    getSeguimientosLiberacion: async (req, res) => {
        try {
            const { id } = req.params; // ID de liberación
            
            if (!validateId(id)) {
                return sendError(res, 'ID de liberación inválido');
            }
            
            const query = `
                SELECT 
                    spl.id_seguimiento,
                    TO_CHAR(spl.fecha_seguimiento, 'YYYY-MM-DD HH24:MI:SS') as fecha_seguimiento,
                    spl.metodo_seguimiento,
                    spl.estado_animal,
                    spl.ubicacion_avistamiento,
                    spl.observaciones,
                    er.nombre || ' ' || er.apellidos as nombre_rescatista
                FROM Seguimiento_Post_Liberacion spl
                INNER JOIN Empleados er ON spl.id_rescatista = er.id_empleado
                WHERE spl.id_liberacion = :1
                ORDER BY spl.fecha_seguimiento DESC
            `;
            
            const seguimientos = await executeQuery(query, [id]);
            sendSuccess(res, seguimientos, 'Seguimientos obtenidos exitosamente');
        } catch (error) {
            handleError(res, error, 'Error al obtener seguimientos');
        }
    },

    // Agregar seguimiento post-liberación
    agregarSeguimiento: async (req, res) => {
        try {
            const { 
                id_liberacion, 
                metodo_seguimiento, 
                estado_animal, 
                ubicacion_avistamiento, 
                observaciones 
            } = req.body;
            const id_rescatista = req.session.user.id;
            
            // Verificar que el usuario sea rescatista
            if (!await isRescatista(id_rescatista)) {
                return sendError(res, 'Solo los rescatistas pueden agregar seguimientos', 403);
            }
            
            // Validar datos requeridos
            if (!id_liberacion || !metodo_seguimiento || !estado_animal || !observaciones) {
                return sendError(res, 'Todos los campos obligatorios deben ser completados');
            }
            
            // Verificar que la liberación existe
            const liberacionQuery = 'SELECT id_liberacion FROM Liberaciones WHERE id_liberacion = :1';
            const liberacion = await executeQuery(liberacionQuery, [id_liberacion]);
            
            if (liberacion.length === 0) {
                return sendError(res, 'Liberación no encontrada', 404);
            }
            
            // Obtener próximo ID
            const nextIdResult = await executeQuery(
                'SELECT NVL(MAX(id_seguimiento), 0) + 1 as next_id FROM Seguimiento_Post_Liberacion'
            );
            const nextId = nextIdResult[0].NEXT_ID;
            
            // Crear seguimiento
            const insertQuery = `
                INSERT INTO Seguimiento_Post_Liberacion 
                (id_seguimiento, id_liberacion, fecha_seguimiento, metodo_seguimiento, 
                 estado_animal, ubicacion_avistamiento, observaciones, id_rescatista)
                VALUES (:1, :2, SYSDATE, :3, :4, :5, :6, :7)
            `;
            
            await executeNonQuery(insertQuery, [
                nextId, 
                id_liberacion, 
                metodo_seguimiento, 
                estado_animal, 
                ubicacion_avistamiento || null, 
                observaciones, 
                id_rescatista
            ]);
            
            sendSuccess(res, {
                id_seguimiento: nextId,
                id_liberacion: parseInt(id_liberacion),
                metodo_seguimiento,
                estado_animal,
                ubicacion_avistamiento,
                observaciones,
                id_rescatista: parseInt(id_rescatista),
                fecha_seguimiento: new Date().toISOString()
            }, 'Seguimiento agregado exitosamente', 201);
            
        } catch (error) {
            handleError(res, error, 'Error al agregar seguimiento');
        }
    }
};

module.exports = LiberacionController;