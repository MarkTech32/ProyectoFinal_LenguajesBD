const { executeQuery, executeNonQuery } = require('../config/database');

class Rescate {
    
    // Obtener todos los rescates con sus animales
    static async getAll() {
        const query = `
            SELECT 
                r.id_rescate,
                TO_CHAR(r.fecha_rescate, 'YYYY-MM-DD') as fecha_rescate,
                r.lugar,
                r.detalles,
                r.id_rescatista,
                e.nombre || ' ' || e.apellidos as nombre_rescatista,
                a.nombre as animal_nombre,
                esp.nombre_cientifico as animal_especie,
                a.id_animal
            FROM Rescates r
            INNER JOIN Empleados e ON r.id_rescatista = e.id_empleado
            LEFT JOIN Animales a ON r.id_rescate = a.id_rescate
            LEFT JOIN Especies esp ON a.id_especie = esp.id_especie
            ORDER BY r.fecha_rescate DESC, a.id_animal
        `;
        
        const resultados = await executeQuery(query);
        
        const rescatesMap = new Map();
        
        resultados.forEach(row => {
            const rescateId = row.ID_RESCATE;
            
            // Si el rescate no existe en el map, crearlo
            if (!rescatesMap.has(rescateId)) {
                rescatesMap.set(rescateId, {
                    ID_RESCATE: row.ID_RESCATE,
                    FECHA_RESCATE: row.FECHA_RESCATE,
                    LUGAR: row.LUGAR,
                    DETALLES: row.DETALLES,
                    ID_RESCATISTA: row.ID_RESCATISTA,
                    NOMBRE_RESCATISTA: row.NOMBRE_RESCATISTA,
                    animales: []
                });
            }
            
            // Si hay un animal asociado, agregarlo
            if (row.ID_ANIMAL) {
                rescatesMap.get(rescateId).animales.push({
                    nombre: row.ANIMAL_NOMBRE,
                    especie: row.ANIMAL_ESPECIE
                });
            }
        });
        
        // Convertir Map a Array
        return Array.from(rescatesMap.values());
    }

    // Obtener un rescate específico por ID con sus animales
    static async getById(id) {
        // Obtener datos del rescate
        const rescateQuery = `
            SELECT 
                r.id_rescate,
                TO_CHAR(r.fecha_rescate, 'YYYY-MM-DD') as fecha_rescate,
                r.lugar,
                r.detalles,
                r.id_rescatista
            FROM Rescates r
            WHERE r.id_rescate = :1
        `;

        const rescate = await executeQuery(rescateQuery, [id]);

        if (rescate.length === 0) {
            return null;
        }

        // Obtener animales asociados al rescate
        const animalesQuery = `
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

        const animales = await executeQuery(animalesQuery, [id]);

        // Combinar datos del rescate con sus animales
        return {
            ...rescate[0],
            animales: animales.map(animal => ({
                id_animal: animal.ID_ANIMAL,
                nombre: animal.NOMBRE,
                id_especie: animal.ID_ESPECIE,
                raza: animal.RAZA,
                edad: animal.EDAD,
                sexo: animal.SEXO,
                especie_nombre: animal.ESPECIE_NOMBRE
            }))
        };
    }

    // Verificar si existe un rescate por ID
    static async exists(id) {
        const result = await executeQuery(
            'SELECT id_rescate FROM Rescates WHERE id_rescate = :1',
            [id]
        );
        return result.length > 0;
    }

    // Obtener próximo ID disponible
    static async getNextId() {
        const result = await executeQuery(
            'SELECT NVL(MAX(id_rescate), 0) + 1 as next_id FROM Rescates'
        );
        return result[0].NEXT_ID;
    }

    // Crear nuevo rescate
    static async create(rescateData) {
        const { fecha_rescate, lugar, detalles, id_rescatista, animales } = rescateData;
        
        // Obtener próximo ID
        const nextRescateId = await this.getNextId();
        
        // Insertar el rescate
        const insertRescateQuery = `
            INSERT INTO Rescates (id_rescate, fecha_rescate, lugar, detalles, id_rescatista)
            VALUES (:1, TO_DATE(:2, 'YYYY-MM-DD'), :3, :4, :5)
        `;
        
        await executeNonQuery(insertRescateQuery, [
            nextRescateId,
            fecha_rescate,
            lugar,
            detalles,
            id_rescatista
        ]);
        
        // Crear animales asociados
        const animalesCreados = [];
        
        for (const animal of animales) {
            // Obtener próximo ID para el animal
            const maxAnimalIdResult = await executeQuery(
                'SELECT NVL(MAX(id_animal), 0) + 1 as next_id FROM Animales'
            );
            const nextAnimalId = maxAnimalIdResult[0].NEXT_ID;
            
            // Insertar animal
            const insertAnimalQuery = `
                INSERT INTO Animales (id_animal, nombre, id_especie, raza, edad, sexo, id_rescate)
                VALUES (:1, :2, :3, :4, :5, :6, :7)
            `;
            
            await executeNonQuery(insertAnimalQuery, [
                nextAnimalId,
                animal.nombre,
                animal.id_especie,
                animal.raza || null,
                animal.edad || null,
                animal.sexo,
                nextRescateId
            ]);
            
            //Crear tratamiento automático en estado PENDIENTE
            const maxTratamientoIdResult = await executeQuery(
                'SELECT NVL(MAX(id_tratamiento), 0) + 1 as next_id FROM Tratamientos'
            );
            const nextTratamientoId = maxTratamientoIdResult[0].NEXT_ID;
            
            const insertTratamientoQuery = `
                INSERT INTO Tratamientos (id_tratamiento, id_animal, id_veterinario, id_cuidador, 
                                        fecha_inicio, fecha_fin, descripcion_tratamiento, 
                                        observaciones_cuidado, estado_tratamiento)
                VALUES (:1, :2, NULL, NULL, NULL, NULL, NULL, NULL, 'PENDIENTE')
            `;
            
            await executeNonQuery(insertTratamientoQuery, [nextTratamientoId, nextAnimalId]);
            
            animalesCreados.push({
                id_animal: nextAnimalId,
                nombre: animal.nombre,
                id_especie: animal.id_especie,
                raza: animal.raza,
                edad: animal.edad,
                sexo: animal.sexo
            });
        }
        
        return {
            rescate: {
                id_rescate: nextRescateId,
                fecha_rescate,
                lugar,
                detalles,
                id_rescatista
            },
            animales: animalesCreados
        };
    }

    // Actualizar rescate existente
    static async update(id, rescateData) {
        const { fecha_rescate, lugar, detalles, id_rescatista, animales } = rescateData;
        
        // Actualizar datos del rescate
        const updateRescateQuery = `
            UPDATE Rescates 
            SET fecha_rescate = TO_DATE(:1, 'YYYY-MM-DD'),
                lugar = :2,
                detalles = :3,
                id_rescatista = :4
            WHERE id_rescate = :5
        `;
        
        await executeNonQuery(updateRescateQuery, [
            fecha_rescate,
            lugar,
            detalles,
            id_rescatista,
            id
        ]);
        
        // Eliminar tratamientos de animales que se van a eliminar
        await executeNonQuery('DELETE FROM Tratamientos WHERE id_animal IN (SELECT id_animal FROM Animales WHERE id_rescate = :1)', [id]);
        
        // Eliminar todos los animales existentes del rescate
        const deleteAnimalesQuery = 'DELETE FROM Animales WHERE id_rescate = :1';
        await executeNonQuery(deleteAnimalesQuery, [id]);
        
        // Crear nuevos animales con los datos actualizados
        const animalesActualizados = [];
        
        for (const animal of animales) {
            // Obtener próximo ID para el animal
            const maxAnimalIdResult = await executeQuery(
                'SELECT NVL(MAX(id_animal), 0) + 1 as next_id FROM Animales'
            );
            const nextAnimalId = maxAnimalIdResult[0].NEXT_ID;
            
            // Insertar animal
            const insertAnimalQuery = `
                INSERT INTO Animales (id_animal, nombre, id_especie, raza, edad, sexo, id_rescate)
                VALUES (:1, :2, :3, :4, :5, :6, :7)
            `;
            
            await executeNonQuery(insertAnimalQuery, [
                nextAnimalId,
                animal.nombre,
                animal.id_especie,
                animal.raza || null,
                animal.edad || null,
                animal.sexo,
                id
            ]);
            
            //Crear tratamiento automático en estado PENDIENTE para animales actualizados**
            const maxTratamientoIdResult = await executeQuery(
                'SELECT NVL(MAX(id_tratamiento), 0) + 1 as next_id FROM Tratamientos'
            );
            const nextTratamientoId = maxTratamientoIdResult[0].NEXT_ID;
            
            const insertTratamientoQuery = `
                INSERT INTO Tratamientos (id_tratamiento, id_animal, id_veterinario, id_cuidador, 
                                        fecha_inicio, fecha_fin, descripcion_tratamiento, 
                                        observaciones_cuidado, estado_tratamiento)
                VALUES (:1, :2, NULL, NULL, NULL, NULL, NULL, NULL, 'PENDIENTE')
            `;
            
            await executeNonQuery(insertTratamientoQuery, [nextTratamientoId, nextAnimalId]);
            
            animalesActualizados.push({
                id_animal: nextAnimalId,
                nombre: animal.nombre,
                id_especie: animal.id_especie,
                raza: animal.raza,
                edad: animal.edad,
                sexo: animal.sexo
            });
        }
        
        return {
            rescate: {
                id_rescate: parseInt(id),
                fecha_rescate,
                lugar,
                detalles,
                id_rescatista
            },
            animales: animalesActualizados
        };
    }

    // Eliminar rescate y sus animales asociados
    static async delete(id) {
        // Conseguir información de los animales que se van a eliminar
        const animalesAsociados = await executeQuery(
            'SELECT id_animal, nombre FROM Animales WHERE id_rescate = :1',
            [id]
        );

        // Eliminar tratamientos de los animales asociados
        await executeNonQuery('DELETE FROM Tratamientos WHERE id_animal IN (SELECT id_animal FROM Animales WHERE id_rescate = :1)', [id]);

        // Eliminar todos los animales asociados al rescate
        const deleteAnimalesQuery = 'DELETE FROM Animales WHERE id_rescate = :1';
        const animalesEliminados = await executeNonQuery(deleteAnimalesQuery, [id]);

        // Eliminar el rescate
        const deleteRescateQuery = 'DELETE FROM Rescates WHERE id_rescate = :1';
        const rescateEliminado = await executeNonQuery(deleteRescateQuery, [id]);

        return {
            rescate_eliminado: {
                id_rescate: parseInt(id),
                filas_afectadas: rescateEliminado
            },
            animales_eliminados: {
                cantidad: animalesAsociados.length,
                filas_afectadas: animalesEliminados,
                animales: animalesAsociados.map(animal => ({
                    id_animal: animal.ID_ANIMAL,
                    nombre: animal.NOMBRE
                }))
            }
        };
    }
}

module.exports = Rescate;