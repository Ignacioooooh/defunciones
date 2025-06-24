import psycopg2
import psycopg2.extras
from datetime import datetime

# Configuración de base de datos (misma que main.py)
db_config = {
    'host': '192.168.1.7',
    'user': 'evaluacion',
    'password': 'inacap123',
    'database': 'salud_chile',
    'port': 5432
}

def crear_tablas_evaluacion3():
    """
    Crear las tablas nuevas necesarias para la Evaluación 3
    """
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        print("🚀 Creando tablas para Evaluación 3...")
        
        # 1. Tabla usuarios
        cur.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(64) NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✅ Tabla 'usuarios' creada")
        
        # 2. Tabla conversaciones
        cur.execute("""
            CREATE TABLE IF NOT EXISTS conversaciones (
                id VARCHAR(50) PRIMARY KEY,
                user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                titulo VARCHAR(200) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✅ Tabla 'conversaciones' creada")
        
        # 3. Tabla mensajes
        cur.execute("""
            CREATE TABLE IF NOT EXISTS mensajes (
                id SERIAL PRIMARY KEY,
                conversation_id VARCHAR(50) REFERENCES conversaciones(id) ON DELETE CASCADE,
                pregunta TEXT NOT NULL,
                respuesta TEXT NOT NULL,
                sql_query TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("✅ Tabla 'mensajes' creada")
        
        # 4. Tabla términos excluidos (Evaluación 3 - E)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS terminos_excluidos (
                id SERIAL PRIMARY KEY,
                termino VARCHAR(100) NOT NULL,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER REFERENCES usuarios(id)
            )
        """)
        print("✅ Tabla 'terminos_excluidos' creada")
        
        # 5. Tabla configuración de prompts (Evaluación 3 - F)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS configuracion_prompts (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                configuracion TEXT NOT NULL,
                activo BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER REFERENCES usuarios(id)
            )
        """)
        print("✅ Tabla 'configuracion_prompts' creada")
        
        # 6. Índices para optimización
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_conversaciones_user_id 
            ON conversaciones(user_id)
        """)
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_mensajes_conversation_id 
            ON mensajes(conversation_id)
        """)
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_mensajes_created_at 
            ON mensajes(created_at)
        """)
        
        print("✅ Índices creados")
        
        # Commit todas las transacciones
        conn.commit()
        cur.close()
        conn.close()
        
        print("🎉 ¡Todas las tablas creadas exitosamente!")
        return True
        
    except psycopg2.Error as err:
        print(f"❌ Error creando tablas: {err}")
        return False

def verificar_tablas():
    """
    Verificar que todas las tablas existan
    """
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        # Lista de tablas que deben existir
        tablas_requeridas = [
            'usuarios',
            'conversaciones', 
            'mensajes',
            'terminos_excluidos',
            'configuracion_prompts',
            'defunciones_principales',  # Tu tabla original
            'ubicaciones',              # Tu tabla original
            'diagnosticos'              # Tu tabla original
        ]
        
        print("🔍 Verificando tablas existentes...")
        
        for tabla in tablas_requeridas:
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = %s
                )
            """, (tabla,))
            
            existe = cur.fetchone()[0]
            status = "✅" if existe else "❌"
            print(f"   {status} {tabla}")
        
        cur.close()
        conn.close()
        
        return True
        
    except psycopg2.Error as err:
        print(f"❌ Error verificando tablas: {err}")
        return False

def crear_usuario_admin():
    """
    Crear usuario administrador por defecto
    """
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        # Verificar si ya existe admin
        cur.execute("SELECT id FROM usuarios WHERE username = 'admin'")
        if cur.fetchone():
            print("ℹ️ Usuario admin ya existe")
            cur.close()
            conn.close()
            return True
        
        # Crear admin (password: admin123)
        import hashlib
        password_hash = hashlib.sha256("admin123".encode()).hexdigest()
        
        cur.execute("""
            INSERT INTO usuarios (username, email, password_hash, is_admin, created_at)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, ("admin", "admin@evaluacion3.com", password_hash, True, datetime.now()))
        
        admin_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"✅ Usuario admin creado (ID: {admin_id})")
        print("   Username: admin")
        print("   Password: admin123")
        
        return True
        
    except psycopg2.Error as err:
        print(f"❌ Error creando usuario admin: {err}")
        return False

def insertar_datos_ejemplo():
    """
    Insertar algunos datos de ejemplo para testing
    """
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        print("📝 Insertando datos de ejemplo...")
        
        # Términos excluidos de ejemplo
        terminos_ejemplo = [
            "palabra_ofensiva_1",
            "termino_prohibido_2", 
            "consulta_restringida_3"
        ]
        
        for termino in terminos_ejemplo:
            cur.execute("""
                INSERT INTO terminos_excluidos (termino, activo, created_at)
                VALUES (%s, %s, %s)
                ON CONFLICT DO NOTHING
            """, (termino, True, datetime.now()))
        
        # Configuración de prompt por defecto
        import json
        config_default = {
            "temperatura": 0,
            "max_tokens": 1000,
            "instrucciones_adicionales": "Responder de forma concisa y precisa",
            "restricciones": ["No usar lenguaje técnico excesivo", "Incluir números formateados"]
        }
        
        cur.execute("""
            INSERT INTO configuracion_prompts (nombre, configuracion, activo, created_at)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, ("Configuración por defecto", json.dumps(config_default), True, datetime.now()))
        
        conn.commit()
        cur.close()
        conn.close()
        
        print("✅ Datos de ejemplo insertados")
        return True
        
    except psycopg2.Error as err:
        print(f"❌ Error insertando datos ejemplo: {err}")
        return False

def obtener_estadisticas_bd():
    """
    Obtener estadísticas de la base de datos
    """
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        estadisticas = {}
        
        # Contar registros en cada tabla
        tablas = [
            'usuarios', 'conversaciones', 'mensajes', 
            'terminos_excluidos', 'configuracion_prompts',
            'defunciones_principales', 'ubicaciones', 'diagnosticos'
        ]
        
        for tabla in tablas:
            cur.execute(f"SELECT COUNT(*) FROM {tabla}")
            count = cur.fetchone()[0]
            estadisticas[tabla] = count
        
        cur.close()
        conn.close()
        
        return estadisticas
        
    except psycopg2.Error as err:
        print(f"❌ Error obteniendo estadísticas: {err}")
        return {}

def main():
    """
    Ejecutar configuración completa de la base de datos
    """
    print("=" * 60)
    print("🗄️ CONFIGURACIÓN BASE DE DATOS - EVALUACIÓN 3")
    print("=" * 60)
    
    # 1. Crear tablas
    if not crear_tablas_evaluacion3():
        print("❌ Error en creación de tablas")
        return
    
    # 2. Verificar tablas
    if not verificar_tablas():
        print("❌ Error en verificación de tablas")
        return
    
    # 3. Crear usuario admin
    if not crear_usuario_admin():
        print("❌ Error creando usuario admin")
        return
    
    # 4. Insertar datos ejemplo
    if not insertar_datos_ejemplo():
        print("❌ Error insertando datos ejemplo")
        return
    
    # 5. Mostrar estadísticas
    print("\n📊 Estadísticas de la base de datos:")
    stats = obtener_estadisticas_bd()
    for tabla, count in stats.items():
        print(f"   {tabla}: {count:,} registros")
    
    print("\n🎉 ¡Configuración de base de datos completada!")
    print("\n🔐 Credenciales de admin:")
    print("   Username: admin")  
    print("   Password: admin123")
    print("\n🚀 Puedes iniciar el servidor FastAPI con: uvicorn main:app --reload")

if __name__ == "__main__":
    main()