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

// ========== QUERIES OPTIMIZADAS ==========
const queries = {
    animalesPendientes: `
        SELECT 
            a.id_animal,
            a.nombre as nombre_animal,
            esp.nombre_cientifico,
            a.edad,
            a.sexo,
            TO_CHAR(r.fecha_rescate, 'YYYY-MM-DD') as fecha_rescate,
            r.lugar as lugar_rescate,
            e.nombre || ' ' || e.apellidos as nombre_rescatista,
            r.detalles as detalles_rescate,
            t.observaciones_cuidado as observaciones
        FROM Animales a
        INNER JOIN Rescates r ON a.id_rescate = r.id_rescate
        INNER JOIN Especies esp ON a.id_especie = esp.id_especie
        INNER JOIN Empleados e ON r.id_rescatista = e.id_empleado
        INNER JOIN Tratamientos t ON a.id_animal = t.id_animal
        WHERE t.estado_tratamiento = 'PENDIENTE'
        ORDER BY r.fecha_rescate ASC
    `,
    
    animalesEnTratamiento: `
        SELECT 
            t.id_tratamiento,
            a.id_animal,
            a.nombre as nombre_animal,
            esp.nombre_cientifico,
            t.descripcion_tratamiento as diagnostico,
            TO_CHAR(t.fecha_inicio, 'YYYY-MM-DD') as fecha_inicio,
            es.estado as estado_salud,
            es.diagnostico,
            ev.nombre || ' ' || ev.apellidos as nombre_veterinario
        FROM Tratamientos t
        INNER JOIN Animales a ON t.id_animal = a.id_animal
        INNER JOIN Especies esp ON a.id_especie = esp.id_especie
        LEFT JOIN Estados_Salud es ON a.id_animal = es.id_animal
        LEFT JOIN Empleados ev ON t.id_veterinario = ev.id_empleado
        WHERE t.estado_tratamiento = 'EN_TRATAMIENTO'
        ORDER BY t.fecha_inicio ASC
    `,
    
    animalesListos: `
        SELECT 
            a.id_animal,
            a.nombre as nombre_animal,
            esp.nombre_cientifico,
            t.descripcion_tratamiento as diagnostico_final,
            TO_CHAR(t.fecha_fin, 'YYYY-MM-DD') as fecha_fin_tratamiento,
            ev.nombre || ' ' || ev.apellidos as nombre_veterinario,
            t.observaciones_cuidado as observaciones,
            t.estado_tratamiento
        FROM Tratamientos t
        INNER JOIN Animales a ON t.id_animal = a.id_animal
        INNER JOIN Especies esp ON a.id_especie = esp.id_especie
        LEFT JOIN Empleados ev ON t.id_veterinario = ev.id_empleado
        WHERE t.estado_tratamiento = 'COMPLETADO'
        AND t.fecha_fin IS NOT NULL
        ORDER BY t.fecha_fin DESC
    `,

    tratamientoPorId: `
        SELECT 
            t.id_tratamiento,
            t.id_animal,
            t.id_veterinario,
            t.id_cuidador,
            TO_CHAR(t.fecha_inicio, 'YYYY-MM-DD') as fecha_inicio,
            TO_CHAR(t.fecha_fin, 'YYYY-MM-DD') as fecha_fin,
            t.descripcion_tratamiento,
            t.observaciones_cuidado,
            t.estado_tratamiento,
            a.nombre as nombre_animal,
            esp.nombre_cientifico,
            ev.nombre || ' ' || ev.apellidos as nombre_veterinario
        FROM Tratamientos t
        INNER JOIN Animales a ON t.id_animal = a.id_animal
        INNER JOIN Especies esp ON a.id_especie = esp.id_especie
        LEFT JOIN Empleados ev ON t.id_veterinario = ev.id_empleado
        WHERE t.id_tratamiento = :1
    `
};

// ========== CONTROLLER ==========
const VeterinarioController = {
    
    // Obtener animales pendientes de tratamiento
    getAnimalesPendientes: async (req, res) => {
        try {
            const animales = await executeQuery(queries.animalesPendientes);
            sendSuccess(res, animales, 'Animales pendientes obtenidos exitosamente');
        } catch (error) {
            handleError(res, error, 'Error al obtener animales pendientes');
        }
    },

    // Obtener animales en tratamiento activo
    getAnimalesEnTratamiento: async (req, res) => {
        try {
            const tratamientos = await executeQuery(queries.animalesEnTratamiento);
            sendSuccess(res, tratamientos, 'Tratamientos activos obtenidos exitosamente');
        } catch (error) {
            handleError(res, error, 'Error al obtener tratamientos activos');
        }
    },

    // Obtener animales listos para cuidadores
    getAnimalesListos: async (req, res) => {
        try {
            const animales = await executeQuery(queries.animalesListos);
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

            // Verificar que el tratamiento existe y está activo
            const tratamiento = await executeQuery(
                'SELECT estado_tratamiento FROM Tratamientos WHERE id_tratamiento = :1',
                [id]
            );

            if (tratamiento.length === 0) {
                return sendError(res, 'El tratamiento especificado no existe', 404);
            }

            if (tratamiento[0].ESTADO_TRATAMIENTO !== 'EN_TRATAMIENTO') {
                return sendError(res, 'El tratamiento no está en estado activo');
            }

            // Completar tratamiento
            await executeNonQuery(
                'UPDATE Tratamientos SET estado_tratamiento = \'COMPLETADO\', fecha_fin = SYSDATE WHERE id_tratamiento = :1',
                [id]
            );

            sendSuccess(res, {
                id_tratamiento: parseInt(id),
                nuevo_estado: 'COMPLETADO',
                fecha_completado: new Date().toISOString().split('T')[0]
            }, 'Tratamiento completado exitosamente');

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
            const [animalExists, veterinarioExists, tratamientoActivo] = await Promise.all([
                executeQuery('SELECT id_animal FROM Animales WHERE id_animal = :1', [id_animal]),
                executeQuery('SELECT id_empleado FROM Empleados WHERE id_empleado = :1', [id_veterinario]),
                executeQuery('SELECT id_tratamiento FROM Tratamientos WHERE id_animal = :1 AND estado_tratamiento = \'EN_TRATAMIENTO\'', [id_animal])
            ]);
            
            if (animalExists.length === 0) {
                return sendError(res, 'El animal especificado no existe', 404);
            }
            
            if (veterinarioExists.length === 0) {
                return sendError(res, 'El veterinario especificado no existe', 404);
            }
            
            if (tratamientoActivo.length > 0) {
                return sendError(res, 'El animal ya tiene un tratamiento activo');
            }
            
            // Obtener próximo ID y crear tratamiento
            const maxIdResult = await executeQuery('SELECT NVL(MAX(id_tratamiento), 0) + 1 as next_id FROM Tratamientos');
            const nextTratamientoId = maxIdResult[0].NEXT_ID;
            
            await executeNonQuery(`
                INSERT INTO Tratamientos (id_tratamiento, id_animal, id_veterinario, id_cuidador, 
                                        fecha_inicio, fecha_fin, descripcion_tratamiento, 
                                        observaciones_cuidado, estado_tratamiento)
                VALUES (:1, :2, :3, NULL, SYSDATE, NULL, :4, :5, 'EN_TRATAMIENTO')
            `, [nextTratamientoId, id_animal, id_veterinario, descripcion_tratamiento, observaciones_cuidado || null]);
            
            sendSuccess(res, {
                id_tratamiento: nextTratamientoId,
                id_animal,
                id_veterinario,
                descripcion_tratamiento,
                observaciones_cuidado,
                estado_tratamiento: 'EN_TRATAMIENTO'
            }, 'Tratamiento creado exitosamente', 201);
            
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

            const tratamiento = await executeQuery(queries.tratamientoPorId, [id]);

            if (tratamiento.length === 0) {
                return sendError(res, 'Tratamiento no encontrado', 404);
            }

            sendSuccess(res, tratamiento[0], 'Tratamiento obtenido exitosamente');

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
            const tratamientoExists = await executeQuery('SELECT id_tratamiento FROM Tratamientos WHERE id_tratamiento = :1', [id]);
            
            if (tratamientoExists.length === 0) {
                return sendError(res, 'El tratamiento especificado no existe', 404);
            }
            
            // Actualizar
            await executeNonQuery(`
                UPDATE Tratamientos 
                SET descripcion_tratamiento = :1,
                    observaciones_cuidado = :2,
                    estado_tratamiento = :3
                WHERE id_tratamiento = :4
            `, [descripcion_tratamiento, observaciones_cuidado || null, estado_tratamiento || 'EN_TRATAMIENTO', id]);
            
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