// Importar modelos
const Tratamiento = require('../models/Tratamiento');
const Animal = require('../models/Animal');
const Empleado = require('../models/Empleado');
const EstadoSalud = require('../models/EstadoSalud');
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

// Verificar si el usuario es veterinario
const isVeterinario = async (idEmpleado) => {
    try {
        const result = await executeQuery(
            'SELECT id_rol FROM Empleados_Roles WHERE id_empleado = :1 AND id_rol = 2',
            [idEmpleado]
        );
        return result.length > 0;
    } catch (error) {
        console.error('Error verificando rol de veterinario:', error);
        return false;
    }
};

// ========== CONTROLLER ==========
const VeterinarioController = {
    
    // Obtener animales pendientes de tratamiento
    getAnimalesPendientes: async (req, res) => {
        try {
            const animales = await Tratamiento.getAnimalesPendientes();
            sendSuccess(res, animales, 'Animales pendientes obtenidos exitosamente');
        } catch (error) {
            handleError(res, error, 'Error al obtener animales pendientes');
        }
    },

    // Obtener animales en tratamiento activo
    getAnimalesEnTratamiento: async (req, res) => {
        try {
            const tratamientos = await Tratamiento.getAnimalesEnTratamiento();
            sendSuccess(res, tratamientos, 'Tratamientos activos obtenidos exitosamente');
        } catch (error) {
            handleError(res, error, 'Error al obtener tratamientos activos');
        }
    },

    // Obtener animales listos para cuidadores (ACTUALIZADA)
    getAnimalesListos: async (req, res) => {
        try {
            const query = `
                SELECT 
                    a.id_animal,
                    a.nombre as nombre_animal,
                    esp.nombre_cientifico,
                    t.descripcion_tratamiento as diagnostico_final,
                    TO_CHAR(t.fecha_fin, 'YYYY-MM-DD') as fecha_fin_tratamiento,
                    ev.nombre || ' ' || ev.apellidos as nombre_veterinario,
                    t.observaciones_cuidado as observaciones,
                    t.estado_tratamiento,
                    t.id_cuidador,
                    ec.nombre || ' ' || ec.apellidos as nombre_cuidador
                FROM Tratamientos t
                INNER JOIN Animales a ON t.id_animal = a.id_animal
                INNER JOIN Especies esp ON a.id_especie = esp.id_especie
                LEFT JOIN Empleados ev ON t.id_veterinario = ev.id_empleado
                LEFT JOIN Empleados ec ON t.id_cuidador = ec.id_empleado
                WHERE t.estado_tratamiento = 'COMPLETADO'
                AND t.fecha_fin IS NOT NULL
                ORDER BY t.fecha_fin DESC
            `;
            
            const animales = await executeQuery(query);
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

            // Verificar que el usuario sea veterinario
            if (!await isVeterinario(req.session.user.id)) {
                return sendError(res, 'Solo los veterinarios pueden completar tratamientos', 403);
            }

            const resultado = await Tratamiento.completar(id);

            if (!resultado.success) {
                return sendError(res, resultado.message, 404);
            }

            sendSuccess(res, resultado.data, 'Tratamiento completado exitosamente');

        } catch (error) {
            handleError(res, error, 'Error al completar tratamiento');
        }
    },

    // Crear nuevo tratamiento (ACTUALIZADO COMPLETO)
    createTratamiento: async (req, res) => {
        try {
            const { 
                id_animal, 
                tipo_problema, 
                diagnostico, 
                estado, 
                descripcion_tratamiento, 
                observaciones_cuidado,
                medicamentos 
            } = req.body;
            
            // Obtener veterinario de la sesión
            const id_veterinario = req.session.user.id;
            
            // Verificar que el usuario sea veterinario
            if (!await isVeterinario(id_veterinario)) {
                return sendError(res, 'Solo los veterinarios pueden crear tratamientos', 403);
            }
            
            // Validar datos requeridos
            if (!id_animal || !tipo_problema || !diagnostico || !estado || !descripcion_tratamiento) {
                return sendError(res, 'Todos los campos obligatorios deben ser completados');
            }
            
            // Verificar que el animal existe
            if (!await Animal.exists(id_animal)) {
                return sendError(res, 'El animal especificado no existe', 404);
            }
            
            // Buscar el tratamiento PENDIENTE del animal
            const tratamientoPendiente = await executeQuery(
                'SELECT id_tratamiento FROM Tratamientos WHERE id_animal = :1 AND estado_tratamiento = \'PENDIENTE\'',
                [id_animal]
            );
            
            if (tratamientoPendiente.length === 0) {
                return sendError(res, 'No se encontró un tratamiento pendiente para este animal', 404);
            }
            
            const idTratamiento = tratamientoPendiente[0].ID_TRATAMIENTO;
            
            // 1. Crear estado de salud
            const estadoSalud = await EstadoSalud.create({
                id_animal,
                tipo_problema,
                diagnostico,
                estado,
                id_veterinario
            });
            
            // 2. Actualizar tratamiento a EN_TRATAMIENTO
            const actualizado = await Tratamiento.update(idTratamiento, {
                id_veterinario,
                descripcion_tratamiento,
                observaciones_cuidado,
                fecha_inicio: new Date().toISOString().split('T')[0],
                estado_tratamiento: 'EN_TRATAMIENTO'
            });
            
            if (!actualizado) {
                return sendError(res, 'No se pudo iniciar el tratamiento', 500);
            }
            
            // 3. Crear medicamentos (solo si no está saludable y hay medicamentos)
            let medicamentosCreados = [];
            if (estado !== 'Saludable' && medicamentos && medicamentos.length > 0) {
                for (const medicamento of medicamentos) {
                    const { id_medicamento, dosis, fecha_inicio_medicamento, fecha_fin_medicamento } = medicamento;
                    
                    if (id_medicamento && dosis && fecha_inicio_medicamento) {
                        const insertMedicamentoQuery = `
                            INSERT INTO Tratamiento_Medicamentos (id_tratamiento, id_medicamento, dosis, fecha_inicio_medicamento, fecha_fin_medicamento)
                            VALUES (:1, :2, :3, TO_DATE(:4, 'YYYY-MM-DD'), :5)
                        `;
                        
                        await executeNonQuery(insertMedicamentoQuery, [
                            idTratamiento,
                            id_medicamento,
                            dosis,
                            fecha_inicio_medicamento,
                            fecha_fin_medicamento ? `TO_DATE('${fecha_fin_medicamento}', 'YYYY-MM-DD')` : null
                        ]);
                        
                        medicamentosCreados.push({
                            id_medicamento,
                            dosis,
                            fecha_inicio_medicamento,
                            fecha_fin_medicamento
                        });
                    }
                }
            }
            
            sendSuccess(res, {
                id_tratamiento: idTratamiento,
                estado_salud: estadoSalud,
                tratamiento: {
                    id_animal,
                    id_veterinario,
                    descripcion_tratamiento,
                    observaciones_cuidado,
                    estado_tratamiento: 'EN_TRATAMIENTO'
                },
                medicamentos: medicamentosCreados
            }, 'Evaluación veterinaria completada exitosamente', 201);
            
        } catch (error) {
            handleError(res, error, 'Error al crear evaluación veterinaria');
        }
    },

    // Obtener tratamiento por ID
    getTratamientoById: async (req, res) => {
        try {
            const { id } = req.params;

            if (!validateId(id)) {
                return sendError(res, 'ID de tratamiento inválido');
            }

            const tratamiento = await Tratamiento.getById(id);

            if (!tratamiento) {
                return sendError(res, 'Tratamiento no encontrado', 404);
            }

            sendSuccess(res, tratamiento, 'Tratamiento obtenido exitosamente');

        } catch (error) {
            handleError(res, error, 'Error al obtener tratamiento');
        }
    },

    // Actualizar tratamiento 
    updateTratamiento: async (req, res) => {
        try {
            const { id } = req.params;
            const { 
                descripcion_tratamiento, 
                observaciones_cuidado, 
                estado_tratamiento,
                medicamentos  
            } = req.body;
            
            if (!validateId(id)) {
                return sendError(res, 'ID de tratamiento inválido');
            }
            
            // Verificar que el usuario sea veterinario
            if (!await isVeterinario(req.session.user.id)) {
                return sendError(res, 'Solo los veterinarios pueden actualizar tratamientos', 403);
            }
            
            // Verificar existencia del tratamiento
            const tratamientoExists = await Tratamiento.exists(id);
            if (!tratamientoExists) {
                return sendError(res, 'El tratamiento especificado no existe', 404);
            }
            
            // 1. Actualizar datos básicos del tratamiento
            const actualizado = await Tratamiento.update(id, {
                descripcion_tratamiento,
                observaciones_cuidado,
                estado_tratamiento
            });
            
            if (!actualizado) {
                return sendError(res, 'No se pudo actualizar el tratamiento', 500);
            }
            
            // 2. Manejar medicamentos si se proporcionaron
            let medicamentosActualizados = [];
            if (medicamentos && Array.isArray(medicamentos)) {
                
                // 2.1 Eliminar medicamentos existentes del tratamiento
                await executeNonQuery(
                    'DELETE FROM Tratamiento_Medicamentos WHERE id_tratamiento = :1',
                    [id]
                );
                
                // 2.2 Agregar nuevos medicamentos
                for (const medicamento of medicamentos) {
                    const { id_medicamento, dosis, fecha_inicio_medicamento, fecha_fin_medicamento } = medicamento;
                    
                    // Validar que tenga los campos obligatorios
                    if (id_medicamento && dosis && fecha_inicio_medicamento) {
                        
                        const insertMedicamentoQuery = `
                            INSERT INTO Tratamiento_Medicamentos 
                            (id_tratamiento, id_medicamento, dosis, fecha_inicio_medicamento, fecha_fin_medicamento)
                            VALUES (:1, :2, :3, TO_DATE(:4, 'YYYY-MM-DD'), 
                                    ${fecha_fin_medicamento ? "TO_DATE(:5, 'YYYY-MM-DD')" : 'NULL'})
                        `;
                        
                        const params = [id, id_medicamento, dosis, fecha_inicio_medicamento];
                        if (fecha_fin_medicamento) {
                            params.push(fecha_fin_medicamento);
                        }
                        
                        await executeNonQuery(insertMedicamentoQuery, params);
                        
                        medicamentosActualizados.push({
                            id_medicamento,
                            dosis,
                            fecha_inicio_medicamento,
                            fecha_fin_medicamento
                        });
                    }
                }
            }
            
            // 3. Respuesta exitosa con información completa
            sendSuccess(res, {
                id_tratamiento: parseInt(id),
                descripcion_tratamiento,
                observaciones_cuidado,
                estado_tratamiento,
                medicamentos_actualizados: medicamentosActualizados,
                total_medicamentos: medicamentosActualizados.length
            }, 'Tratamiento y medicamentos actualizados exitosamente');
            
        } catch (error) {
            handleError(res, error, 'Error al actualizar tratamiento');
        }
    }
};

module.exports = VeterinarioController;