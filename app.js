const express = require('express');
const bodyParser = require('body-parser');
const { executeQuery } = require('./config/database');
const RescatistaController = require('./controllers/RescatistaController');

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
    res.sendFile(__dirname + '/public/html/dashboard_rescatista.html');
});

// Formulario
app.get('/html/formulario', (req, res) => {
    res.sendFile(__dirname + '/public/html/formulario.html');
});

// Login
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/public/html/login.html');
});

// Index (página principal del centro de refugio)
app.get('/index', (req, res) => {
    res.sendFile(__dirname + '/public/html/index.html');
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

// ======= RUTAS API =======
app.get('/api/rescates', RescatistaController.getAllRescates);
app.get('/api/rescates/:id', RescatistaController.getRescateById);  
app.post('/api/rescates', RescatistaController.createRescate);
app.put('/api/rescates/:id', RescatistaController.updateRescate);
app.delete('/api/rescates/:id', RescatistaController.deleteRescate);
app.get('/api/empleados', RescatistaController.getAllEmpleados);   

// ======= INICIAR SERVIDOR =======
app.listen(PORT, () => {
    console.log(`Servidor corriendo en: http://localhost:${PORT}`);
    console.log('Rutas disponibles:');
    console.log('  • http://localhost:3000/ (conexión DB)');
    console.log('  • http://localhost:3000/login');
    console.log('  • http://localhost:3000/index (centro de refugio)');
    console.log('  • http://localhost:3000/dashboard_rescatista');
    console.log('Presiona Ctrl+C para detener el servidor');
});

// Manejar cierre graceful
process.on('SIGINT', () => {
    console.log('Cerrando servidor...');
    process.exit(0);
});