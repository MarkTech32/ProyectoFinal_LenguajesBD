const oracledb = require('oracledb');

// Configuración de la base de datos
const dbConfig = {
    user: 'PROY_FINAL_BD',
    password: '123',
    connectString: 'localhost:1521/ORCLPDB1',
    // Configuraciones adicionales para mejor rendimiento
    poolMin: 1,
    poolMax: 10,
    poolIncrement: 1
};

// Función para obtener conexión
async function getConnection() {
    try {
        const connection = await oracledb.getConnection(dbConfig);
        return connection;
    } catch (error) {
        console.error('Error conectando a Oracle:', error);
        throw error;
    }
}

// Función para ejecutar consultas SELECT
async function executeQuery(sql, params = []) {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(sql, params, {
            outFormat: oracledb.OUT_FORMAT_OBJECT // Devuelve objetos en lugar de arrays
        });
        return result.rows;
    } catch (error) {
        console.error('Error ejecutando consulta:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error cerrando conexión:', error);
            }
        }
    }
}

// Función para ejecutar INSERT, UPDATE, DELETE
async function executeNonQuery(sql, params = []) {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(sql, params, {
            autoCommit: true // Confirma automáticamente los cambios
        });
        return result.rowsAffected;
    } catch (error) {
        console.error('Error ejecutando comando:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error cerrando conexión:', error);
            }
        }
    }
}

// Función para cerrar el pool de conexiones (al cerrar la app)
async function closePool() {
    try {
        await oracledb.getPool().close();
        console.log('Pool de conexiones cerrado');
    } catch (error) {
        console.error('Error cerrando pool:', error);
    }
}

module.exports = {
    getConnection,
    executeQuery,
    executeNonQuery,
    closePool,
    dbConfig
};