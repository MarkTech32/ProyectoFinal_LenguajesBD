const { executeQuery, executeNonQuery } = require('../config/database');

class Animal {
    
    // Obtener próximo ID disponible para animal
    static async getNextId() {
        const result = await executeQuery(
            'SELECT NVL(MAX(id_animal), 0) + 1 as next_id FROM Animales'
        );
        return result[0].NEXT_ID;
    }

    // Crear un animal nuevo
    static async create(animalData) {
        const { nombre, id_especie, raza, edad, sexo, id_rescate } = animalData;
        
        const nextAnimalId = await this.getNextId();
        
        const insertAnimalQuery = `
            INSERT INTO Animales (id_animal, nombre, id_especie, raza, edad, sexo, id_rescate)
            VALUES (:1, :2, :3, :4, :5, :6, :7)
        `;
        
        await executeNonQuery(insertAnimalQuery, [
            nextAnimalId,
            nombre,
            id_especie,
            raza || null,
            edad || null,
            sexo,
            id_rescate
        ]);
        
        return {
            id_animal: nextAnimalId,
            nombre,
            id_especie,
            raza,
            edad,
            sexo,
            id_rescate
        };
    }

    // Obtener animal por ID
    static async getById(id) {
        const query = `
            SELECT 
                a.id_animal,
                a.nombre,
                a.id_especie,
                a.raza,
                a.edad,
                a.sexo,
                a.id_rescate,
                e.nombre_cientifico as especie_nombre
            FROM Animales a
            LEFT JOIN Especies e ON a.id_especie = e.id_especie
            WHERE a.id_animal = :1
        `;

        const result = await executeQuery(query, [id]);
        
        if (result.length === 0) {
            return null;
        }

        return {
            id_animal: result[0].ID_ANIMAL,
            nombre: result[0].NOMBRE,
            id_especie: result[0].ID_ESPECIE,
            raza: result[0].RAZA,
            edad: result[0].EDAD,
            sexo: result[0].SEXO,
            id_rescate: result[0].ID_RESCATE,
            especie_nombre: result[0].ESPECIE_NOMBRE
        };
    }

    // Obtener animales por ID de rescate
    static async getByRescateId(rescateId) {
        const query = `
            SELECT 
                a.id_animal,
                a.nombre,
                a.id_especie,
                a.raza,
                a.edad,
                a.sexo,
                e.nombre_cientifico as especie_nombre
            FROM Animales a
            LEFT JOIN Especies e ON a.id_especie = e.id_especie
            WHERE a.id_rescate = :1
            ORDER BY a.id_animal
        `;

        const result = await executeQuery(query, [rescateId]);
        
        return result.map(animal => ({
            id_animal: animal.ID_ANIMAL,
            nombre: animal.NOMBRE,
            id_especie: animal.ID_ESPECIE,
            raza: animal.RAZA,
            edad: animal.EDAD,
            sexo: animal.SEXO,
            especie_nombre: animal.ESPECIE_NOMBRE
        }));
    }

    // Verificar si existe un animal por ID
    static async exists(id) {
        const result = await executeQuery(
            'SELECT id_animal FROM Animales WHERE id_animal = :1',
            [id]
        );
        return result.length > 0;
    }

    // Eliminar todos los animales de un rescate
    static async deleteByRescateId(rescateId) {
        // Primero obtener información de los animales a eliminar
        const animalesAsociados = await executeQuery(
            'SELECT id_animal, nombre FROM Animales WHERE id_rescate = :1',
            [rescateId]
        );

        // Eliminar los animales
        const filasAfectadas = await executeNonQuery(
            'DELETE FROM Animales WHERE id_rescate = :1',
            [rescateId]
        );

        return {
            cantidad: animalesAsociados.length,
            filas_afectadas: filasAfectadas,
            animales: animalesAsociados.map(animal => ({
                id_animal: animal.ID_ANIMAL,
                nombre: animal.NOMBRE
            }))
        };
    }

    // Actualizar un animal
    static async update(id, animalData) {
        const { nombre, id_especie, raza, edad, sexo } = animalData;
        
        const updateQuery = `
            UPDATE Animales 
            SET nombre = :1,
                id_especie = :2,
                raza = :3,
                edad = :4,
                sexo = :5
            WHERE id_animal = :6
        `;
        
        const filasAfectadas = await executeNonQuery(updateQuery, [
            nombre,
            id_especie,
            raza || null,
            edad || null,
            sexo,
            id
        ]);
        
        return filasAfectadas > 0;
    }

    // Eliminar un animal específico
    static async delete(id) {
        const filasAfectadas = await executeNonQuery(
            'DELETE FROM Animales WHERE id_animal = :1',
            [id]
        );
        
        return filasAfectadas > 0;
    }
}

module.exports = Animal;