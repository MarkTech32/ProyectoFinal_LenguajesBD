const express = require('express');
const { executeQuery } = require('./config/database');
const RescatistaController = require('./controllers/RescatistaController');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// ======= RUTAS API =======
app.get('/api/rescates', RescatistaController.getAllRescates);
app.get('/api/rescates/:id', RescatistaController.getRescateById);  
app.post('/api/rescates', RescatistaController.createRescate);
app.put('/api/rescates/:id', RescatistaController.updateRescate);
app.delete('/api/rescates/:id', RescatistaController.deleteRescate);
app.get('/api/empleados', RescatistaController.getAllEmpleados);   

// ======= RUTAS DE PÁGINAS =======
// Dashboard de rescatistas
app.get('/dashboard_rescatista', (req, res) => {
    res.sendFile(__dirname + '/public/html/dashboard_rescatista.html');
});

app.get('/html/formulario', (req, res) => {
    res.sendFile(__dirname + '/public/html/formulario.html');
});

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

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en: http://localhost:${PORT}`);
    console.log('Presiona Ctrl+C para detener el servidor');
});

// Manejar cierre graceful
process.on('SIGINT', () => {
    console.log('Cerrando servidor...');
    process.exit(0);
});