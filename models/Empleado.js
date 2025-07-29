const { executeQuery } = require('../config/database');

class Empleado {
    
    // Obtener todos los empleados (para selects del formulario)
    static async getAll() {
        const query = `
            SELECT 
                id_empleado,
                nombre,
                apellidos,
                nombre || ' ' || apellidos as nombre_completo
            FROM Empleados
            ORDER BY nombre, apellidos
        `;
        
        return await executeQuery(query);
    }

    // Obtener empleado por ID
    static async getById(id) {
        const query = `
            SELECT 
                id_empleado,
                nombre,
                apellidos,
                telefono,
                correo,
                username,
                nombre || ' ' || apellidos as nombre_completo
            FROM Empleados
            WHERE id_empleado = :1
        `;
        
        const result = await executeQuery(query, [id]);
        return result.length > 0 ? result[0] : null;
    }

    // Verificar si existe un empleado por ID
    static async exists(id) {
        const result = await executeQuery(
            'SELECT id_empleado FROM Empleados WHERE id_empleado = :1',
            [id]
        );
        return result.length > 0;
    }

    // Autenticación - verificar credenciales de login
    static async authenticate(username, password) {
        const query = `
            SELECT * FROM Empleados 
            WHERE username = :1 AND password_hash = :2
        `;
        
        const result = await executeQuery(query, [username, password]);
        return result.length > 0 ? result[0] : null;
    }

    // Obtener empleados por rol (para futuras funcionalidades)
    static async getByRole(roleId) {
        const query = `
            SELECT 
                e.id_empleado,
                e.nombre,
                e.apellidos,
                e.nombre || ' ' || e.apellidos as nombre_completo,
                er.nivel_acceso,
                er.zona_asignada,
                er.especialidad_medica,
                er.area_asignada,
                er.cargo
            FROM Empleados e
            INNER JOIN Empleados_Roles er ON e.id_empleado = er.id_empleado
            WHERE er.id_rol = :1
            ORDER BY e.nombre, e.apellidos
        `;
        
        return await executeQuery(query, [roleId]);
    }
}

module.exports = Empleado;