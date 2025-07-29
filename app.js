const express = require('express');
const bodyParser = require('body-parser');
const { executeQuery } = require('./config/database');
const RescatistaController = require('./controllers/RescatistaController');
const VeterinarioController = require('./controllers/VeterinarioController');

const app = express();
const PORT = 3000;

// ======= MIDDLEWARE (SIEMPRE AL INICIO) =======
app.use(express.static('public'));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// Dashboard de rescatistas
app.get('/dashboard_rescatista', (req, res) => {
    res.sendFile(__dirname + '/views/dashboard_rescatista.html');
});

// Dashboard de veterinarios
app.get('/dashboard_veterinario', (req, res) => {
    res.sendFile(__dirname + '/views/dashboard_veterinario.html');
});

// Formulario
app.get('/html/formulario', (req, res) => {
    res.sendFile(__dirname + '/views/formulario.html');
});

// Login
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/views/login.html');
});

// Index (página principal del centro de refugio)
app.get('/index', (req, res) => {
    res.sendFile(__dirname + '/views/index.html');
});

// ======= RUTAS DE AUTENTICACIÓN =======
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await executeQuery(
            `SELECT * FROM Empleados WHERE username = :1 AND password_hash = :2`,
            [username, password]
        );
        if (result.length > 0) {
            // Login exitoso - redirigir al centro de refugio
            res.redirect('/index');
        } else {
            // Login fallido
            res.send(`
                <h2>❌ Usuario o contraseña incorrectos</h2>
                <a href="/login">Volver a intentar</a>
            `);
        }
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// ======= RUTAS API - RESCATISTAS =======
app.get('/api/rescates', RescatistaController.getAllRescates);
app.get('/api/rescates/:id', RescatistaController.getRescateById);  
app.post('/api/rescates', RescatistaController.createRescate);
app.put('/api/rescates/:id', RescatistaController.updateRescate);
app.delete('/api/rescates/:id', RescatistaController.deleteRescate);
app.get('/api/empleados', RescatistaController.getAllEmpleados);   
app.get('/api/especies', RescatistaController.getAllEspecies);

// ======= RUTAS API - VETERINARIOS =======
// Rutas para el dashboard de veterinarios (3 categorías)
app.get('/api/veterinario/pendientes', VeterinarioController.getAnimalesPendientes);
app.get('/api/veterinario/en-tratamiento', VeterinarioController.getAnimalesEnTratamiento);
app.get('/api/veterinario/listos', VeterinarioController.getAnimalesListos);

// Rutas para manejo de tratamientos
app.post('/api/veterinario/tratamientos', VeterinarioController.createTratamiento);
app.get('/api/veterinario/tratamientos/:id', VeterinarioController.getTratamientoById);
app.put('/api/veterinario/tratamientos/:id', VeterinarioController.updateTratamiento);

// Ruta para completar tratamiento
app.put('/api/veterinario/completar/:id', VeterinarioController.completarTratamiento);

// ======= INICIAR SERVIDOR =======
app.listen(PORT, () => {
    console.log(`Servidor corriendo en: http://localhost:${PORT}`);
    console.log('Rutas disponibles:');
    console.log('  • http://localhost:3000/ (conexión DB)');
    console.log('  • http://localhost:3000/login');
    console.log('  • http://localhost:3000/index (centro de refugio)');
    console.log('  • http://localhost:3000/dashboard_rescatista');
    console.log('  • http://localhost:3000/dashboard_veterinario');
    console.log('Presiona Ctrl+C para detener el servidor');
});

// Manejar cierre graceful
process.on('SIGINT', () => {
    console.log('Cerrando servidor...');
    process.exit(0);
});