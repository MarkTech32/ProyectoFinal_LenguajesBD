const { executeQuery } = require('../config/database');

class Especie {
    
    // Obtener todas las especies (para selects del formulario)
    static async getAll() {
        const query = `
            SELECT 
                id_especie,
                nombre_cientifico,
                familia,
                habitat_natural,
                estado_conservacion,
                dieta
            FROM Especies
            ORDER BY nombre_cientifico
        `;
        
        return await executeQuery(query);
    }

    // Obtener especie por ID
    static async getById(id) {
        const query = `
            SELECT 
                id_especie,
                nombre_cientifico,
                familia,
                habitat_natural,
                estado_conservacion,
                dieta
            FROM Especies
            WHERE id_especie = :1
        `;
        
        const result = await executeQuery(query, [id]);
        return result.length > 0 ? result[0] : null;
    }

    // Verificar si existe una especie por ID
    static async exists(id) {
        const result = await executeQuery(
            'SELECT id_especie FROM Especies WHERE id_especie = :1',
            [id]
        );
        return result.length > 0;
    }

    // Obtener especies por estado de conservación
    static async getByEstadoConservacion(estado) {
        const query = `
            SELECT 
                id_especie,
                nombre_cientifico,
                familia,
                habitat_natural,
                estado_conservacion,
                dieta
            FROM Especies
            WHERE estado_conservacion = :1
            ORDER BY nombre_cientifico
        `;
        
        return await executeQuery(query, [estado]);
    }

    // Obtener especies por tipo de dieta
    static async getByDieta(dieta) {
        const query = `
            SELECT 
                id_especie,
                nombre_cientifico,
                familia,
                habitat_natural,
                estado_conservacion,
                dieta
            FROM Especies
            WHERE dieta = :1
            ORDER BY nombre_cientifico
        `;
        
        return await executeQuery(query, [dieta]);
    }
}

module.exports = Especie;