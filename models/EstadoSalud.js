const { executeQuery, executeNonQuery } = require('../config/database');

class EstadoSalud {
    
    // Obtener próximo ID disponible
    static async getNextId() {
        const result = await executeQuery(
            'SELECT NVL(MAX(id_estado_salud), 0) + 1 as next_id FROM Estados_Salud'
        );
        return result[0].NEXT_ID;
    }

    // Crear nuevo estado de salud
    static async create(estadoData) {
        const { id_animal, tipo_problema, diagnostico, estado, id_veterinario } = estadoData;
        
        const nextEstadoId = await this.getNextId();
        
        const insertQuery = `
            INSERT INTO Estados_Salud (id_estado_salud, id_animal, fecha_evaluacion, 
                                     tipo_problema, diagnostico, estado, id_veterinario)
            VALUES (:1, :2, SYSDATE, :3, :4, :5, :6)
        `;
        
        await executeNonQuery(insertQuery, [
            nextEstadoId,
            id_animal,
            tipo_problema,
            diagnostico,
            estado,
            id_veterinario
        ]);
        
        return {
            id_estado_salud: nextEstadoId,
            id_animal,
            fecha_evaluacion: new Date().toISOString().split('T')[0],
            tipo_problema,
            diagnostico,
            estado,
            id_veterinario
        };
    }

    // Obtener estado de salud por ID
    static async getById(id) {
        const query = `
            SELECT 
                es.id_estado_salud,
                es.id_animal,
                TO_CHAR(es.fecha_evaluacion, 'YYYY-MM-DD') as fecha_evaluacion,
                es.tipo_problema,
                es.diagnostico,
                es.estado,
                es.id_veterinario,
                a.nombre as nombre_animal,
                e.nombre || ' ' || e.apellidos as nombre_veterinario
            FROM Estados_Salud es
            INNER JOIN Animales a ON es.id_animal = a.id_animal
            LEFT JOIN Empleados e ON es.id_veterinario = e.id_empleado
            WHERE es.id_estado_salud = :1
        `;
        
        const result = await executeQuery(query, [id]);
        return result.length > 0 ? result[0] : null;
    }

    // Obtener estados de salud por animal
    static async getByAnimalId(animalId) {
        const query = `
            SELECT 
                es.id_estado_salud,
                TO_CHAR(es.fecha_evaluacion, 'YYYY-MM-DD') as fecha_evaluacion,
                es.tipo_problema,
                es.diagnostico,
                es.estado,
                e.nombre || ' ' || e.apellidos as nombre_veterinario
            FROM Estados_Salud es
            LEFT JOIN Empleados e ON es.id_veterinario = e.id_empleado
            WHERE es.id_animal = :1
            ORDER BY es.fecha_evaluacion DESC
        `;
        
        return await executeQuery(query, [animalId]);
    }

    // Obtener último estado de salud de un animal
    static async getLatestByAnimalId(animalId) {
        const query = `
            SELECT 
                es.id_estado_salud,
                TO_CHAR(es.fecha_evaluacion, 'YYYY-MM-DD') as fecha_evaluacion,
                es.tipo_problema,
                es.diagnostico,
                es.estado,
                es.id_veterinario,
                e.nombre || ' ' || e.apellidos as nombre_veterinario
            FROM Estados_Salud es
            LEFT JOIN Empleados e ON es.id_veterinario = e.id_empleado
            WHERE es.id_animal = :1
            AND es.fecha_evaluacion = (
                SELECT MAX(fecha_evaluacion) 
                FROM Estados_Salud 
                WHERE id_animal = :1
            )
        `;
        
        const result = await executeQuery(query, [animalId]);
        return result.length > 0 ? result[0] : null;
    }

    // Verificar si existe un estado de salud por ID
    static async exists(id) {
        const result = await executeQuery(
            'SELECT id_estado_salud FROM Estados_Salud WHERE id_estado_salud = :1',
            [id]
        );
        return result.length > 0;
    }

    // Actualizar estado de salud
    static async update(id, estadoData) {
        const { tipo_problema, diagnostico, estado } = estadoData;
        
        const updateQuery = `
            UPDATE Estados_Salud 
            SET tipo_problema = :1,
                diagnostico = :2,
                estado = :3
            WHERE id_estado_salud = :4
        `;
        
        const filasAfectadas = await executeNonQuery(updateQuery, [
            tipo_problema,
            diagnostico,
            estado,
            id
        ]);
        
        return filasAfectadas > 0;
    }

    // Eliminar estado de salud
    static async delete(id) {
        const filasAfectadas = await executeNonQuery(
            'DELETE FROM Estados_Salud WHERE id_estado_salud = :1',
            [id]
        );
        
        return filasAfectadas > 0;
    }

    // Obtener todos los estados de salud con información del animal y veterinario
    static async getAll() {
        const query = `
            SELECT 
                es.id_estado_salud,
                es.id_animal,
                a.nombre as nombre_animal,
                esp.nombre_cientifico,
                TO_CHAR(es.fecha_evaluacion, 'YYYY-MM-DD') as fecha_evaluacion,
                es.tipo_problema,
                es.diagnostico,
                es.estado,
                e.nombre || ' ' || e.apellidos as nombre_veterinario
            FROM Estados_Salud es
            INNER JOIN Animales a ON es.id_animal = a.id_animal
            INNER JOIN Especies esp ON a.id_especie = esp.id_especie
            LEFT JOIN Empleados e ON es.id_veterinario = e.id_empleado
            ORDER BY es.fecha_evaluacion DESC
        `;
        
        return await executeQuery(query);
    }

    // Obtener estadísticas de estados de salud
    static async getEstadisticas() {
        const query = `
            SELECT 
                estado,
                COUNT(*) as cantidad
            FROM Estados_Salud
            WHERE fecha_evaluacion >= SYSDATE - 30  -- Últimos 30 días
            GROUP BY estado
            ORDER BY cantidad DESC
        `;
        
        return await executeQuery(query);
    }
}

module.exports = EstadoSalud;