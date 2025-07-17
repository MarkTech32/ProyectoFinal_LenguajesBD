const { executeQuery, executeNonQuery } = require('../config/database');

const RescatistaController = {
    
getAllRescates: async (req, res) => {
    try {
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
        const rescates = Array.from(rescatesMap.values());
        
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
                return res.status(404).json({
                    success: false,
                    message: 'Rescate no encontrado'
                });
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

            //Combinar datos del rescate con sus animales
            const rescateCompleto = {
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

            res.status(200).json({
                success: true,
                data: rescateCompleto,
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

    //Obtener todos los empleados (para el select de rescatistas)
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

    // Crear nuevo rescate CON ANIMALES
createRescate: async (req, res) => {
    try {
        // Ahora también recibimos el array de animales
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
        
        // Conseguir el próximo ID para el rescate
        const maxIdResult = await executeQuery(
            'SELECT NVL(MAX(id_rescate), 0) + 1 as next_id FROM Rescates'
        );
        const nextRescateId = maxIdResult[0].NEXT_ID;
        
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
        
        // Insertar los animales 
        const animalesCreados = [];
        
        for (const animal of animales) {
            // Validar los datos del animal
            if (!animal.nombre || !animal.id_especie || !animal.sexo) {
                return res.status(400).json({
                    success: false,
                    message: 'Cada animal debe tener nombre, especie y sexo'
                });
            }
            
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
            
            animalesCreados.push({
                id_animal: nextAnimalId,
                nombre: animal.nombre,
                id_especie: animal.id_especie,
                raza: animal.raza,
                edad: animal.edad,
                sexo: animal.sexo
            });
        }
        
        // Respuesta: Incluir información de rescate y los animales creados
        res.status(201).json({
            success: true,
            message: 'Rescate y animales creados exitosamente',
            data: {
                rescate: {
                    id_rescate: nextRescateId,
                    fecha_rescate,
                    lugar,
                    detalles,
                    id_rescatista
                },
                animales: animalesCreados
            }
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
        // Ahora también recibimos el array de animales
        const { fecha_rescate, lugar, detalles, id_rescatista, animales } = req.body;
        
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
        
        // Eliminar todos los animales existentes del rescate
        const deleteAnimalesQuery = 'DELETE FROM Animales WHERE id_rescate = :1';
        await executeNonQuery(deleteAnimalesQuery, [id]);
        
        // Crear nuevos animales con los datos actualizados
        const animalesActualizados = [];
        
        for (const animal of animales) {
            // Validar datos del animal
            if (!animal.nombre || !animal.id_especie || !animal.sexo) {
                return res.status(400).json({
                    success: false,
                    message: 'Cada animal debe tener nombre, especie y sexo'
                });
            }
            
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
            
            animalesActualizados.push({
                id_animal: nextAnimalId,
                nombre: animal.nombre,
                id_especie: animal.id_especie,
                raza: animal.raza,
                edad: animal.edad,
                sexo: animal.sexo
            });
        }
        
        // Incluir información actualizada
        res.status(200).json({
            success: true,
            message: 'Rescate y animales actualizados exitosamente',
            data: {
                rescate: {
                    id_rescate: parseInt(id),
                    fecha_rescate,
                    lugar,
                    detalles,
                    id_rescatista
                },
                animales: animalesActualizados
            }
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

            // Conseguir información de los animales que se van a eliminar 
            const animalesAsociados = await executeQuery(
                'SELECT id_animal, nombre FROM Animales WHERE id_rescate = :1',
                [id]
            );

            //Eliminar todos los animales asociados al rescate
            const deleteAnimalesQuery = 'DELETE FROM Animales WHERE id_rescate = :1';
            const animalesEliminados = await executeNonQuery(deleteAnimalesQuery, [id]);

            //Eliminar el rescate
            const deleteRescateQuery = 'DELETE FROM Rescates WHERE id_rescate = :1';
            const rescateEliminado = await executeNonQuery(deleteRescateQuery, [id]);

            //Incluir información detallada de lo eliminado
            res.status(200).json({
                success: true,
                message: 'Rescate y animales asociados eliminados exitosamente',
                data: {
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
                }
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

    //Obtener todas las especies (para el select del formulario)
getAllEspecies: async (req, res) => {
    try {
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
        
        const especies = await executeQuery(query);
        
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
},

};

module.exports = RescatistaController;