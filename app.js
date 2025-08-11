const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session'); // Necesitarás instalar: npm install express-session
const { executeQuery } = require('./config/database');
const RescatistaController = require('./controllers/RescatistaController');
const VeterinarioController = require('./controllers/VeterinarioController');

const app = express();
const PORT = 3000;

// ======= MIDDLEWARE (SIEMPRE AL INICIO) =======
app.use(express.static('public'));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de sesiones simple
app.use(session({
    secret: 'centro-refugio-secret', // En producción usar variable de entorno
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // En producción con HTTPS usar true
}));

// ======= MIDDLEWARE DE AUTENTICACIÓN =======
function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
}

// ======= RUTAS DE PÁGINAS =======
// Ruta principal - Verificar conexión
app.get('/', async (req, res) => {
    try {
        const usuario = await executeQuery('SELECT USER FROM DUAL');
        const fecha = await executeQuery("SELECT TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI:SS') as FECHA FROM DUAL");
        
        res.send(`
            <h1>🎉 Conexión a Oracle Exitosa!</h1>
            <p><strong>Usuario conectado:</strong> ${usuario[0].USER}</p>
            <p><strong>Fecha del servidor:</strong> ${fecha[0].FECHA}</p>
            <p><strong>Base de datos:</strong> ORCLPDB1</p>
            <hr>
            <p><em>¡Todo funciona correctamente!</em></p>
            <a href="/login">Ir a login</a> | 
            <a href="/index">Ir a inicio</a>
        `);
        
    } catch (error) {
        res.send(`
            <h1>❌ Error de Conexión</h1>
            <p><strong>Error:</strong> ${error.message}</p>
            <hr>
            <p><em>Revisa la configuración de la base de datos</em></p>
        `);
    }
});

// Dashboard de rescatistas - CON PROTECCIÓN
app.get('/dashboard_rescatista', requireAuth, (req, res) => {
    res.sendFile(__dirname + '/views/dashboard_rescatista.html');
});

// Dashboard de veterinarios - CON PROTECCIÓN
app.get('/dashboard_veterinario', requireAuth, (req, res) => {
    res.sendFile(__dirname + '/views/dashboard_veterinario.html');
});

// Formulario - CON PROTECCIÓN
app.get('/html/formulario', requireAuth, (req, res) => {
    res.sendFile(__dirname + '/views/formulario.html');
});

// Login - Mostrar página de login
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/views/login.html');
});

// Index - Página principal del centro de refugio (requiere autenticación)
app.get('/index', requireAuth, (req, res) => {
    res.sendFile(__dirname + '/views/index.html');
});

// ======= RUTAS DE AUTENTICACIÓN =======
// Procesar login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const result = await executeQuery(
            `SELECT * FROM Empleados WHERE username = :1 AND password_hash = :2`,
            [username, password]
        );
        
        if (result.length > 0) {
            // Login exitoso - crear sesión
            req.session.user = {
                id: result[0].ID_EMPLEADO,
                username: result[0].USERNAME,
                nombre: result[0].NOMBRE,
                apellidos: result[0].APELLIDOS
            };
            
            // Redirigir al index
            res.redirect('/index');
        } else {
            // Login fallido - redirigir con mensaje de error
            res.redirect('/login?error=invalid');
        }
    } catch (error) {
        console.error('Error en login:', error);
        res.redirect('/login?error=invalid');
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
        }
        res.redirect('/login');
    });
});

// ======= RUTAS API - RESCATISTAS (CON PROTECCIÓN) =======
app.get('/api/rescates', requireAuth, RescatistaController.getAllRescates);
app.get('/api/rescates/:id', requireAuth, RescatistaController.getRescateById);  
app.post('/api/rescates', requireAuth, RescatistaController.createRescate);
app.put('/api/rescates/:id', requireAuth, RescatistaController.updateRescate);
app.delete('/api/rescates/:id', requireAuth, RescatistaController.deleteRescate);
app.get('/api/empleados', requireAuth, RescatistaController.getAllEmpleados);   
app.get('/api/especies', requireAuth, RescatistaController.getAllEspecies);

// ======= RUTA API - MEDICAMENTOS =======
app.get('/api/medicamentos', requireAuth, async (req, res) => {
    try {
        const medicamentos = await executeQuery('SELECT * FROM Medicamentos ORDER BY nombre_medicamento');
        res.json({
            success: true,
            data: medicamentos,
            message: 'Medicamentos obtenidos exitosamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// Agregar en app.js después de la ruta de medicamentos

// ======= RUTA API - CUIDADORES =======
app.get('/api/cuidadores', requireAuth, async (req, res) => {
    try {
        const cuidadoresQuery = `
            SELECT 
                e.id_empleado,
                e.nombre,
                e.apellidos,
                e.nombre || ' ' || e.apellidos as nombre_completo
            FROM Empleados e
            INNER JOIN Empleados_Roles er ON e.id_empleado = er.id_empleado
            WHERE er.id_rol = 3
            ORDER BY e.nombre, e.apellidos
        `;
        
        const cuidadores = await executeQuery(cuidadoresQuery);
        
        res.json({
            success: true,
            data: cuidadores,
            message: 'Cuidadores obtenidos exitosamente'
        });
    } catch (error) {
        console.error('Error al obtener cuidadores:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});


// ======= RUTA API - ASIGNAR CUIDADOR =======
app.put('/api/veterinario/asignar-cuidador/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params; // ID del tratamiento
        const { id_cuidador } = req.body;
        
        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de tratamiento inválido'
            });
        }
        
        if (!id_cuidador || isNaN(id_cuidador)) {
            return res.status(400).json({
                success: false,
                message: 'ID de cuidador inválido'
            });
        }
        
        // Verificar que el tratamiento existe y está completado
        const tratamientoQuery = `
            SELECT id_tratamiento, estado_tratamiento, id_cuidador 
            FROM Tratamientos 
            WHERE id_tratamiento = :1
        `;
        const tratamiento = await executeQuery(tratamientoQuery, [id]);
        
        if (tratamiento.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tratamiento no encontrado'
            });
        }
        
        if (tratamiento[0].ESTADO_TRATAMIENTO !== 'COMPLETADO') {
            return res.status(400).json({
                success: false,
                message: 'Solo se pueden asignar tratamientos completados'
            });
        }
        
        // Verificar que el cuidador existe y tiene el rol correcto
        const cuidadorQuery = `
            SELECT e.id_empleado, e.nombre || ' ' || e.apellidos as nombre_completo
            FROM Empleados e
            INNER JOIN Empleados_Roles er ON e.id_empleado = er.id_empleado
            WHERE e.id_empleado = :1 AND er.id_rol = 3
        `;
        const cuidador = await executeQuery(cuidadorQuery, [id_cuidador]);
        
        if (cuidador.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cuidador no válido'
            });
        }
        
        // Asignar cuidador al tratamiento
        const updateQuery = `
            UPDATE Tratamientos 
            SET id_cuidador = :1 
            WHERE id_tratamiento = :2
        `;
        
        const { executeNonQuery } = require('./config/database');
        await executeNonQuery(updateQuery, [id_cuidador, id]);
        
        res.json({
            success: true,
            data: {
                id_tratamiento: parseInt(id),
                id_cuidador: parseInt(id_cuidador),
                nombre_cuidador: cuidador[0].NOMBRE_COMPLETO
            },
            message: 'Cuidador asignado exitosamente'
        });
        
    } catch (error) {
        console.error('Error al asignar cuidador:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// Agregar en app.js después del endpoint de asignar cuidador

// ======= RUTA API - OBTENER TRATAMIENTO POR ANIMAL =======
app.get('/api/veterinario/tratamiento-por-animal/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params; // ID del animal
        
        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de animal inválido'
            });
        }
        
        // Buscar el tratamiento más reciente del animal que esté completado
        const tratamientoQuery = `
            SELECT 
                id_tratamiento,
                id_animal,
                estado_tratamiento,
                id_cuidador
            FROM Tratamientos 
            WHERE id_animal = :1 
            AND estado_tratamiento = 'COMPLETADO'
            ORDER BY fecha_inicio DESC
            FETCH FIRST 1 ROWS ONLY
        `;
        
        const tratamiento = await executeQuery(tratamientoQuery, [id]);
        
        if (tratamiento.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontró tratamiento completado para este animal'
            });
        }
        
        res.json({
            success: true,
            data: {
                id_tratamiento: tratamiento[0].ID_TRATAMIENTO,
                id_animal: tratamiento[0].ID_ANIMAL,
                estado_tratamiento: tratamiento[0].ESTADO_TRATAMIENTO,
                id_cuidador: tratamiento[0].ID_CUIDADOR
            },
            message: 'Tratamiento obtenido exitosamente'
        });
        
    } catch (error) {
        console.error('Error al obtener tratamiento por animal:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// ======= RUTAS API - VETERINARIOS (CON PROTECCIÓN) =======
// Rutas para el dashboard de veterinarios (3 categorías)
app.get('/api/veterinario/pendientes', requireAuth, VeterinarioController.getAnimalesPendientes);
app.get('/api/veterinario/en-tratamiento', requireAuth, VeterinarioController.getAnimalesEnTratamiento);
app.get('/api/veterinario/listos', requireAuth, VeterinarioController.getAnimalesListos);

// Rutas para manejo de tratamientos
app.post('/api/veterinario/tratamientos', requireAuth, VeterinarioController.createTratamiento);
app.get('/api/veterinario/tratamientos/:id', requireAuth, VeterinarioController.getTratamientoById);
app.put('/api/veterinario/tratamientos/:id', requireAuth, VeterinarioController.updateTratamiento);

// Ruta para completar tratamiento
app.put('/api/veterinario/completar/:id', requireAuth, VeterinarioController.completarTratamiento);

// Ruta para obtener información completa del animal 
app.get('/api/veterinario/animal-completo/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de animal inválido'
            });
        }
        
        // Obtener información del animal
        const animalQuery = `
            SELECT 
                a.id_animal,
                a.nombre,
                a.raza,
                a.edad,
                a.sexo,
                esp.nombre_cientifico as especie_nombre
            FROM Animales a
            INNER JOIN Especies esp ON a.id_especie = esp.id_especie
            WHERE a.id_animal = :1
        `;
        const animalResult = await executeQuery(animalQuery, [id]);
        
        if (animalResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Animal no encontrado'
            });
        }
        
        // Normalizar datos del animal
        const animal = {
            id_animal: animalResult[0].ID_ANIMAL,
            nombre: animalResult[0].NOMBRE,
            raza: animalResult[0].RAZA,
            edad: animalResult[0].EDAD,
            sexo: animalResult[0].SEXO,
            especie_nombre: animalResult[0].ESPECIE_NOMBRE
        };
        
        // Obtener información del rescate
        const rescateQuery = `
            SELECT 
                TO_CHAR(r.fecha_rescate, 'YYYY-MM-DD') as fecha_rescate,
                r.lugar,
                r.detalles,
                e.nombre || ' ' || e.apellidos as nombre_rescatista
            FROM Rescates r
            INNER JOIN Animales a ON r.id_rescate = a.id_rescate
            INNER JOIN Empleados e ON r.id_rescatista = e.id_empleado
            WHERE a.id_animal = :1
        `;
        const rescateResult = await executeQuery(rescateQuery, [id]);
        
        // Normalizar datos del rescate
        const rescate = rescateResult.length > 0 ? {
            fecha_rescate: rescateResult[0].FECHA_RESCATE,
            lugar: rescateResult[0].LUGAR,
            detalles: rescateResult[0].DETALLES,
            nombre_rescatista: rescateResult[0].NOMBRE_RESCATISTA
        } : {};
        
        // Obtener último estado de salud
        const estadoSaludQuery = `
            SELECT 
                TO_CHAR(es.fecha_evaluacion, 'YYYY-MM-DD') as fecha_evaluacion,
                es.tipo_problema,
                es.diagnostico,
                es.estado,
                ev.nombre || ' ' || ev.apellidos as nombre_veterinario
            FROM Estados_Salud es
            LEFT JOIN Empleados ev ON es.id_veterinario = ev.id_empleado
            WHERE es.id_animal = :1
            AND es.fecha_evaluacion = (SELECT MAX(fecha_evaluacion) FROM Estados_Salud WHERE id_animal = :2)
        `;
        const estadoSaludResult = await executeQuery(estadoSaludQuery, [id, id]);
        
        // Normalizar datos del estado de salud
        const estadoSalud = estadoSaludResult.length > 0 ? {
            fecha_evaluacion: estadoSaludResult[0].FECHA_EVALUACION,
            tipo_problema: estadoSaludResult[0].TIPO_PROBLEMA,
            diagnostico: estadoSaludResult[0].DIAGNOSTICO,
            estado: estadoSaludResult[0].ESTADO,
            nombre_veterinario: estadoSaludResult[0].NOMBRE_VETERINARIO
        } : {};
        
        // Obtener tratamiento más reciente (EN_TRATAMIENTO o COMPLETADO)
        const tratamientoQuery = `
            SELECT 
                TO_CHAR(t.fecha_inicio, 'YYYY-MM-DD') as fecha_inicio,
                TO_CHAR(t.fecha_fin, 'YYYY-MM-DD') as fecha_fin,
                t.descripcion_tratamiento,
                t.observaciones_cuidado,
                t.estado_tratamiento
            FROM Tratamientos t
            WHERE t.id_animal = :1
            AND t.estado_tratamiento IN ('EN_TRATAMIENTO', 'COMPLETADO')
            ORDER BY t.fecha_inicio DESC
            FETCH FIRST 1 ROWS ONLY
        `;
        const tratamientoResult = await executeQuery(tratamientoQuery, [id]);
        
        // Normalizar datos del tratamiento
        const tratamiento = tratamientoResult.length > 0 ? {
            fecha_inicio: tratamientoResult[0].FECHA_INICIO,
            fecha_fin: tratamientoResult[0].FECHA_FIN,
            descripcion_tratamiento: tratamientoResult[0].DESCRIPCION_TRATAMIENTO,
            observaciones_cuidado: tratamientoResult[0].OBSERVACIONES_CUIDADO,
            estado_tratamiento: tratamientoResult[0].ESTADO_TRATAMIENTO
        } : {};
        
        // Obtener medicamentos del tratamiento más reciente
        const medicamentosQuery = `
            SELECT 
                m.nombre_medicamento,
                m.tipo_medicamento,
                tm.dosis,
                TO_CHAR(tm.fecha_inicio_medicamento, 'YYYY-MM-DD') as fecha_inicio_medicamento,
                TO_CHAR(tm.fecha_fin_medicamento, 'YYYY-MM-DD') as fecha_fin_medicamento
            FROM Tratamiento_Medicamentos tm
            INNER JOIN Medicamentos m ON tm.id_medicamento = m.id_medicamento
            INNER JOIN Tratamientos t ON tm.id_tratamiento = t.id_tratamiento
            WHERE t.id_animal = :1
            AND t.estado_tratamiento IN ('EN_TRATAMIENTO', 'COMPLETADO')
            ORDER BY t.fecha_inicio DESC, tm.fecha_inicio_medicamento DESC
        `;
        const medicamentosResult = await executeQuery(medicamentosQuery, [id]);
        
        // Normalizar datos de medicamentos
        const medicamentos = medicamentosResult.map(med => ({
            nombre_medicamento: med.NOMBRE_MEDICAMENTO,
            tipo_medicamento: med.TIPO_MEDICAMENTO,
            dosis: med.DOSIS,
            fecha_inicio_medicamento: med.FECHA_INICIO_MEDICAMENTO,
            fecha_fin_medicamento: med.FECHA_FIN_MEDICAMENTO
        }));
        
        res.json({
            success: true,
            data: {
                animal: animal,
                rescate: rescate,
                estadoSalud: estadoSalud,
                tratamiento: tratamiento,
                medicamentos: medicamentos
            },
            message: 'Información completa obtenida exitosamente'
        });
        
    } catch (error) {
        console.error('Error obteniendo información completa:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// ======= INICIAR SERVIDOR =======
app.listen(PORT, () => {
    console.log(`Servidor corriendo en: http://localhost:${PORT}`);
    console.log('Rutas disponibles:');
    console.log('  • http://localhost:3000/ (conexión DB)');
    console.log('  • http://localhost:3000/login');
    console.log('  • http://localhost:3000/index (centro de refugio)');
    console.log('  • http://localhost:3000/dashboard_rescatista');
    console.log('  • http://localhost:3000/dashboard_veterinario');
    console.log('  • http://localhost:3000/logout (cerrar sesión)');
    console.log('Presiona Ctrl+C para detener el servidor');
});

// Manejar cierre graceful
process.on('SIGINT', () => {
    console.log('Cerrando servidor...');
    process.exit(0);
});