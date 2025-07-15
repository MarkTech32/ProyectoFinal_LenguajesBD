const express = require('express');
const { executeQuery } = require('./config/database');

const app = express();
const PORT = 3000;

// Ruta principal - Probar conexión
app.get('/', async (req, res) => {
    try {
        // Probar conexión con consulta simple
        const usuario = await executeQuery('SELECT USER FROM DUAL');
        const fecha = await executeQuery("SELECT TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI:SS') as FECHA FROM DUAL");
        
        // Respuesta HTML simple
        res.send(`
            <h1>🎉 Conexión a Oracle Exitosa!</h1>
            <p><strong>Usuario conectado:</strong> ${usuario[0].USER}</p>
            <p><strong>Fecha del servidor:</strong> ${fecha[0].FECHA}</p>
            <p><strong>Base de datos:</strong> ORCLPDB1</p>
            <hr>
            <p><em>¡Todo funciona correctamente!</em></p>
        `);
        
    } catch (error) {
        // Si hay error, mostrar detalles
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