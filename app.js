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

// Ruta para obtener información completa del animal (NUEVA)
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
        const animal = await executeQuery(animalQuery, [id]);
        
        if (animal.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Animal no encontrado'
            });
        }
        
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
        const rescate = await executeQuery(rescateQuery, [id]);
        
        // Obtener último estado de salud - CORREGIDO
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
        const estadoSalud = await executeQuery(estadoSaludQuery, [id, id]);
        
        // Obtener tratamiento actual
        const tratamientoQuery = `
            SELECT 
                TO_CHAR(t.fecha_inicio, 'YYYY-MM-DD') as fecha_inicio,
                t.descripcion_tratamiento,
                t.observaciones_cuidado,
                t.estado_tratamiento
            FROM Tratamientos t
            WHERE t.id_animal = :1
            AND t.estado_tratamiento = 'EN_TRATAMIENTO'
        `;
        const tratamiento = await executeQuery(tratamientoQuery, [id]);
        
        // Obtener medicamentos
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
            AND t.estado_tratamiento = 'EN_TRATAMIENTO'
            ORDER BY tm.fecha_inicio_medicamento DESC
        `;
        const medicamentos = await executeQuery(medicamentosQuery, [id]);
        
        res.json({
            success: true,
            data: {
                animal: animal[0],
                rescate: rescate[0] || {},
                estadoSalud: estadoSalud[0] || {},
                tratamiento: tratamiento[0] || {},
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