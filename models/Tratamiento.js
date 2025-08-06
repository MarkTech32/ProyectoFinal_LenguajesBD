const { executeQuery, executeNonQuery } = require('../config/database');

class Tratamiento {
    
    // Obtener animales pendientes de tratamiento
    static async getAnimalesPendientes() {
        const query = `
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
        `;
        
        return await executeQuery(query);
    }

    // Obtener animales en tratamiento activo
    static async getAnimalesEnTratamiento() {
        const query = `
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
        `;
        
        return await executeQuery(query);
    }

    // Obtener animales listos para cuidadores
    static async getAnimalesListos() {
        const query = `
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
        `;
        
        return await executeQuery(query);
    }

    // Obtener tratamiento por ID
    static async getById(id) {
        const query = `
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
        `;
        
        const result = await executeQuery(query, [id]);
        return result.length > 0 ? result[0] : null;
    }

    // Verificar si existe un tratamiento por ID
    static async exists(id) {
        const result = await executeQuery(
            'SELECT id_tratamiento FROM Tratamientos WHERE id_tratamiento = :1',
            [id]
        );
        return result.length > 0;
    }

    // Verificar si un animal tiene tratamiento activo
    static async hasActiveTreatment(animalId) {
        const result = await executeQuery(
            'SELECT id_tratamiento FROM Tratamientos WHERE id_animal = :1 AND estado_tratamiento = \'EN_TRATAMIENTO\'',
            [animalId]
        );
        return result.length > 0;
    }

    // Obtener próximo ID disponible
    static async getNextId() {
        const result = await executeQuery(
            'SELECT NVL(MAX(id_tratamiento), 0) + 1 as next_id FROM Tratamientos'
        );
        return result[0].NEXT_ID;
    }

    // Crear nuevo tratamiento
    static async create(tratamientoData) {
        const { id_animal, id_veterinario, descripcion_tratamiento, observaciones_cuidado } = tratamientoData;
        
        const nextTratamientoId = await this.getNextId();
        
        const insertQuery = `
            INSERT INTO Tratamientos (id_tratamiento, id_animal, id_veterinario, id_cuidador, 
                                    fecha_inicio, fecha_fin, descripcion_tratamiento, 
                                    observaciones_cuidado, estado_tratamiento)
            VALUES (:1, :2, :3, NULL, SYSDATE, NULL, :4, :5, 'EN_TRATAMIENTO')
        `;
        
        await executeNonQuery(insertQuery, [
            nextTratamientoId, 
            id_animal, 
            id_veterinario, 
            descripcion_tratamiento, 
            observaciones_cuidado || null
        ]);
        
        return {
            id_tratamiento: nextTratamientoId,
            id_animal,
            id_veterinario,
            descripcion_tratamiento,
            observaciones_cuidado,
            estado_tratamiento: 'EN_TRATAMIENTO'
        };
    }

    // Actualizar tratamiento 
    static async update(id, tratamientoData) {
        const { 
            id_veterinario, 
            descripcion_tratamiento, 
            observaciones_cuidado, 
            estado_tratamiento,
            fecha_inicio 
        } = tratamientoData;
        
        // Construir query dinámicamente según los campos que se van a actualizar
        let setClauses = [];
        let params = [];
        let paramIndex = 1;
        
        if (descripcion_tratamiento !== undefined) {
            setClauses.push(`descripcion_tratamiento = :${paramIndex}`);
            params.push(descripcion_tratamiento);
            paramIndex++;
        }
        
        if (observaciones_cuidado !== undefined) {
            setClauses.push(`observaciones_cuidado = :${paramIndex}`);
            params.push(observaciones_cuidado || null);
            paramIndex++;
        }
        
        if (estado_tratamiento !== undefined) {
            setClauses.push(`estado_tratamiento = :${paramIndex}`);
            params.push(estado_tratamiento);
            paramIndex++;
        }
        
        if (id_veterinario !== undefined) {
            setClauses.push(`id_veterinario = :${paramIndex}`);
            params.push(id_veterinario);
            paramIndex++;
        }
        
        if (fecha_inicio !== undefined) {
            setClauses.push(`fecha_inicio = TO_DATE(:${paramIndex}, 'YYYY-MM-DD')`);
            params.push(fecha_inicio);
            paramIndex++;
        }
        
        if (setClauses.length === 0) {
            return false; // No hay nada que actualizar
        }
        
        const updateQuery = `
            UPDATE Tratamientos 
            SET ${setClauses.join(', ')}
            WHERE id_tratamiento = :${paramIndex}
        `;
        
        params.push(id);
        
        const filasAfectadas = await executeNonQuery(updateQuery, params);
        
        return filasAfectadas > 0;
    }

    // Completar tratamiento
    static async completar(id) {
        // Verificar que el tratamiento existe y está activo
        const tratamiento = await executeQuery(
            'SELECT estado_tratamiento FROM Tratamientos WHERE id_tratamiento = :1',
            [id]
        );

        if (tratamiento.length === 0) {
            return { success: false, message: 'El tratamiento especificado no existe' };
        }

        if (tratamiento[0].ESTADO_TRATAMIENTO !== 'EN_TRATAMIENTO') {
            return { success: false, message: 'El tratamiento no está en estado activo' };
        }

        // Completar tratamiento
        await executeNonQuery(
            'UPDATE Tratamientos SET estado_tratamiento = \'COMPLETADO\', fecha_fin = SYSDATE WHERE id_tratamiento = :1',
            [id]
        );

        return {
            success: true,
            data: {
                id_tratamiento: parseInt(id),
                nuevo_estado: 'COMPLETADO',
                fecha_completado: new Date().toISOString().split('T')[0]
            }
        };
    }

    // Obtener estado de tratamiento
    static async getEstado(id) {
        const result = await executeQuery(
            'SELECT estado_tratamiento FROM Tratamientos WHERE id_tratamiento = :1',
            [id]
        );
        return result.length > 0 ? result[0].ESTADO_TRATAMIENTO : null;
    }
}

module.exports = Tratamiento;