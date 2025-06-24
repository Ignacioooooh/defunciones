from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import psycopg2
import psycopg2.extras
import anthropic
from datetime import datetime, timedelta
import uuid
import hashlib
import jwt
import os
import json
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuración
SECRET_KEY = "tu_clave_secreta_aqui_cambiar_en_produccion"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 horas para desarrollo

app = FastAPI(title="Chatbot Defunciones Chile", version="2.0.0")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración PostgreSQL (tu configuración actual)
db_config = {
    'host': '192.168.1.7',
    'user': 'evaluacion',
    'password': 'inacap123',
    'database': 'salud_chile',
    'port': 5432
}

# API Claude (tu configuración actual)
client = anthropic.Anthropic(api_key="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")

# === TU ESTRUCTURA Y CONTEXTO ORIGINAL ===

ESTRUCTURA_TABLA = """
TABLAS DISPONIBLES (3 TABLAS RELACIONALES):
1. defunciones_principales (id, "ANIO", "FECHA_DEF", "SEXO_NOMBRE", "EDAD_TIPO", "EDAD_CANT", "COD_COMUNA", "DIAG1", "DIAG2", "LUGAR_DEFUNCION")
2. ubicaciones ("COD_COMUNA", "COMUNA", "NOMBRE_REGION")
3. diagnosticos (codigo_diagnostico, capitulo, descripcion_capitulo, subcategoria, descripcion_subcategoria)

CAMPOS IMPORTANTES:
- "ANIO": 2023, 2024, 2025
- "FECHA_DEF": Fecha de defunción (tipo DATE)
- "SEXO_NOMBRE": 'Hombre', 'Mujer'
- "EDAD_CANT": Edad en años
- "DIAG1": Código CIE-10 causa principal (ej: C329, J690, I249)
- "DIAG2": Código CIE-10 causa externa (NULL para muertes naturales)
- "LUGAR_DEFUNCION": 'Hospital o Clínica', 'Casa habitación', 'Otro'
- "NOMBRE_REGION": Regiones de Chile
"""

CONTEXT = """
CONJUNTO DE DATOS: DEFUNCIONES CHILE 2023-2025
Fuente: DEIS - Ministerio de Salud Chile (datos oficiales preliminares)

Puedes preguntar sobre:
DEMOGRÁFICO:
- Muertes por sexo, edad, año
- Análisis por regiones y comunas
- Patrones temporales y estacionales

MÉDICO/EPIDEMIOLÓGICO:
- Principales causas de muerte
- Enfermedades específicas (cáncer, cardiovasculares, respiratorias)
- Códigos CIE-10 y clasificaciones
- Causas externas vs naturales

GEOGRÁFICO:
- Mortalidad por región/comuna
- Comparativas territoriales
- Distribución geográfica de enfermedades

TEMPORAL:
- Tendencias 2023-2025
- Análisis por meses/temporadas
- Comparativas anuales
"""

# === NUEVAS FUNCIONES PARA COMPLETAR EVALUACIÓN 3 ===

def verificar_terminos_excluidos(pregunta: str) -> bool:
    """Verificar si la pregunta contiene términos excluidos (Punto E)"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        cur.execute("SELECT termino FROM terminos_excluidos WHERE activo = true")
        terminos_prohibidos = [row[0].lower() for row in cur.fetchall()]
        cur.close()
        conn.close()
        
        pregunta_lower = pregunta.lower()
        for termino in terminos_prohibidos:
            if termino in pregunta_lower:
                return True
        return False
    except:
        return False

def obtener_configuracion_activa() -> dict:
    """Obtener configuración de prompts activa (Punto F)"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        cur.execute("SELECT configuracion FROM configuracion_prompts WHERE activo = true ORDER BY created_at DESC LIMIT 1")
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if result:
            return json.loads(result[0])
        return {}
    except:
        return {}

# === TU SISTEMA DE HILADO INTELIGENTE COMPLETO ===

class ContextoConversacion:
    def __init__(self):
        self.sesion_actual = {
            'ultima_region': None,
            'ultimo_año': None,
            'ultimo_mes': None,
            'ultimo_mes_num': None,
            'ultimo_sexo': None,
            'ultima_causa': None,
            'ultimo_tema': None
        }
        self.historial_sesion = []
        self.id_sesion = str(uuid.uuid4())[:8]
    
    def detectar_contexto_en_pregunta(self, pregunta):
        """Detectar y extraer contexto de la pregunta actual"""
        pregunta_lower = pregunta.lower()
        
        # Detectar regiones
        regiones_map = {
            'santiago': 'Metropolitana de Santiago',
            'metropolitana': 'Metropolitana de Santiago',
            'valparaíso': 'De Valparaíso',
            'valpo': 'De Valparaíso',
            'biobío': 'Del Biobío',
            'bio bio': 'Del Biobío',
            'araucanía': 'De La Araucanía',
            'temuco': 'De La Araucanía',
            'antofagasta': 'De Antofagasta',
            'coquimbo': 'De Coquimbo',
            'tarapacá': 'De Tarapacá',
            'atacama': 'De Atacama',
            'ohiggins': 'Del Libertador B. O\'Higgins',
            'maule': 'Del Maule',
            'los ríos': 'De Los Ríos',
            'los lagos': 'De Los Lagos',
            'aysén': 'De Aysén',
            'magallanes': 'De Magallanes'
        }
        
        for key, region in regiones_map.items():
            if key in pregunta_lower:
                self.sesion_actual['ultima_region'] = region
                break
        
        # Detectar años
        for año in ['2023', '2024', '2025']:
            if año in pregunta:
                self.sesion_actual['ultimo_año'] = año
                break
        
        # Detectar meses
        meses_map = {
            'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
            'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
            'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
        }
        
        for mes_nombre, mes_num in meses_map.items():
            if mes_nombre in pregunta_lower:
                self.sesion_actual['ultimo_mes'] = mes_nombre
                self.sesion_actual['ultimo_mes_num'] = mes_num
                break
        
        # Detectar sexo
        if 'hombre' in pregunta_lower or 'masculino' in pregunta_lower:
            self.sesion_actual['ultimo_sexo'] = 'Hombre'
        elif 'mujer' in pregunta_lower or 'femenino' in pregunta_lower:
            self.sesion_actual['ultimo_sexo'] = 'Mujer'
        
        # Detectar causas
        if 'cáncer' in pregunta_lower or 'tumor' in pregunta_lower:
            self.sesion_actual['ultima_causa'] = 'cáncer'
        elif 'cardiovascular' in pregunta_lower or 'corazón' in pregunta_lower:
            self.sesion_actual['ultima_causa'] = 'cardiovascular'
        elif 'respiratorio' in pregunta_lower or 'pulmón' in pregunta_lower:
            self.sesion_actual['ultima_causa'] = 'respiratorio'
        elif 'diabetes' in pregunta_lower:
            self.sesion_actual['ultima_causa'] = 'diabetes'
    
    def es_pregunta_continuacion(self, pregunta):
        """Detectar si es una pregunta de continuación"""
        palabras_continuacion = [
            'cuál es la más común', 'cuál es la principal', 'y en hombres', 'y en mujeres',
            'también', 'además', 'y en', 'qué tal en', 'y por', 'y el', 'y la',
            'más común', 'principal', 'primero', 'mayor', 'menor',
            'puedes darme', 'dame la', 'lista', 'listado', 'cuáles son', 'muéstrame',
            'cuántos son', 'cuántas son', 'puedes contarlas', 'contarlos', 'en total',
            'suma', 'sumar', 'total', 'coincide', 'da el conjunto'
        ]
        
        pregunta_lower = pregunta.lower()
        return any(palabra in pregunta_lower for palabra in palabras_continuacion)
    
    def expandir_pregunta_continuacion(self, pregunta):
        """Expandir preguntas de continuación usando el contexto"""
        pregunta_lower = pregunta.lower()
        
        # Detectar referencias temporales como "de este último", "de ese mes", "de este período"
        referencias_temporales = ['de este último', 'de ese', 'de este', 'del último', 'del mes', 'de ese período']
        
        if any(ref in pregunta_lower for ref in referencias_temporales):
            # Extraer contexto temporal de la respuesta anterior
            if self.historial_sesion:
                ultima_respuesta = str(self.historial_sesion[-1]).lower()
                
                # Buscar mes en la respuesta anterior
                meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
                mes_encontrado = None
                año_encontrado = None
                region_encontrada = None
                
                for mes in meses:
                    if mes in ultima_respuesta:
                        mes_encontrado = mes
                        break
                
                # Buscar año
                for año in ['2023', '2024', '2025']:
                    if año in ultima_respuesta:
                        año_encontrado = año
                        break
                
                # Buscar región en respuesta anterior
                if 'antofagasta' in ultima_respuesta:
                    region_encontrada = 'Antofagasta'
                elif 'santiago' in ultima_respuesta:
                    region_encontrada = 'Santiago'
                
                # Construir pregunta expandida
                if mes_encontrado and 'día de la semana' in pregunta_lower:
                    partes = [f"día de la semana con más defunciones en {mes_encontrado}"]
                    if año_encontrado:
                        partes.append(f"de {año_encontrado}")
                    if region_encontrada:
                        partes.append(f"en {region_encontrada}")
                    return " ".join(partes)
        
        # Detectar preguntas sobre totales simples
        if any(palabra in pregunta_lower for palabra in ['dame la cantidad total', 'total de datos', 'cantidad total']):
            return "total de defunciones en el dataset"
        
        # Detectar preguntas que piden listas o detalles
        if any(palabra in pregunta_lower for palabra in ['lista', 'listado', 'cuáles son', 'dame la', 'muéstrame']):
            # Si la pregunta anterior fue sobre regiones, expandir para lista de regiones
            if self.historial_sesion and 'region' in str(self.historial_sesion[-1]).lower():
                return "lista de todas las regiones con número de defunciones"
            elif 'lista' in pregunta_lower:
                return "lista de regiones de Chile con defunciones"
        
        # Detectar preguntas sobre sumas o totales del contexto anterior
        if any(palabra in pregunta_lower for palabra in ['suma', 'total', 'sumar', 'coincide', 'da el conjunto']):
            if self.historial_sesion:
                ultima_pregunta = self.historial_sesion[-1]['pregunta'].lower()
                if 'region' in ultima_pregunta or 'lista' in ultima_pregunta:
                    return "total de defunciones en todo el dataset"
                else:
                    return "total general de defunciones"
        
        # Detectar preguntas sobre contar elementos del contexto anterior
        elif any(palabra in pregunta_lower for palabra in ['cuántos son', 'cuántas son', 'puedes contarlas', 'contarlos']):
            # Verificar el contexto de la pregunta anterior
            if self.historial_sesion:
                ultima_pregunta = self.historial_sesion[-1]['pregunta'].lower()
                if 'region' in ultima_pregunta:
                    if 'cuántos son' in pregunta_lower or 'cuántas son' in pregunta_lower or 'contarlas' in pregunta_lower:
                        return "cuántas regiones diferentes hay en el dataset"
                elif 'comuna' in ultima_pregunta:
                    return "cuántas comunas diferentes hay en el dataset"
                elif 'causa' in ultima_pregunta or 'diagnóstico' in ultima_pregunta:
                    return "cuántas causas de muerte diferentes hay"
        
        # Si hay contexto activo y es una pregunta de continuación
        if self.es_pregunta_continuacion(pregunta):
            
            if 'cuál es la más común' in pregunta_lower or 'cuál es la principal' in pregunta_lower:
                if self.sesion_actual['ultima_region']:
                    return f"cuál es la principal causa de muerte en {self.sesion_actual['ultima_region']}"
            
            elif 'y en hombres' in pregunta_lower:
                partes = []
                if self.sesion_actual['ultima_causa']:
                    partes.append(f"muertes por {self.sesion_actual['ultima_causa']}")
                else:
                    partes.append("muertes")
                partes.append("en hombres")
                if self.sesion_actual['ultima_region']:
                    partes.append(f"en {self.sesion_actual['ultima_region']}")
                return " ".join(partes)
            
            elif 'y en mujeres' in pregunta_lower:
                partes = []
                if self.sesion_actual['ultima_causa']:
                    partes.append(f"muertes por {self.sesion_actual['ultima_causa']}")
                else:
                    partes.append("muertes")
                partes.append("en mujeres")
                if self.sesion_actual['ultima_region']:
                    partes.append(f"en {self.sesion_actual['ultima_region']}")
                return " ".join(partes)
            
            elif 'qué tal en' in pregunta_lower:
                # Mantener tema, cambiar región
                if self.sesion_actual['ultima_causa']:
                    return pregunta  # Dejamos que detecte la nueva región
        
        return pregunta
    
    def construir_contexto_para_prompt(self):
        """Construir información de contexto para el prompt"""
        contexto_partes = []
        
        if self.sesion_actual['ultima_region']:
            contexto_partes.append(f"Región en contexto: {self.sesion_actual['ultima_region']}")
        
        if self.sesion_actual['ultimo_año']:
            contexto_partes.append(f"Año en contexto: {self.sesion_actual['ultimo_año']}")
        
        if self.sesion_actual['ultimo_mes']:
            contexto_partes.append(f"Mes en contexto: {self.sesion_actual['ultimo_mes']}")
        
        if self.sesion_actual['ultimo_sexo']:
            contexto_partes.append(f"Sexo en contexto: {self.sesion_actual['ultimo_sexo']}")
        
        if self.sesion_actual['ultima_causa']:
            contexto_partes.append(f"Causa en contexto: {self.sesion_actual['ultima_causa']}")
        
        # Últimas 3 preguntas para referencia
        if self.historial_sesion:
            contexto_partes.append("\nÚltimas preguntas:")
            for item in self.historial_sesion[-3:]:
                contexto_partes.append(f"- {item['pregunta']}")
        
        return "\n".join(contexto_partes) if contexto_partes else "Sin contexto previo"
    
    def agregar_interaccion(self, pregunta, sql_generado):
        """Registrar nueva interacción"""
        self.historial_sesion.append({
            'pregunta': pregunta,
            'sql': sql_generado,
            'timestamp': datetime.now()
        })
        
        # Mantener solo últimas 10 interacciones
        if len(self.historial_sesion) > 10:
            self.historial_sesion = self.historial_sesion[-10:]
    
    def reiniciar_sesion(self):
        """Limpiar contexto para nueva conversación"""
        self.sesion_actual = {
            'ultima_region': None,
            'ultimo_año': None,
            'ultimo_mes': None,
            'ultimo_mes_num': None,
            'ultimo_sexo': None,
            'ultima_causa': None,
            'ultimo_tema': None
        }
        self.historial_sesion = []
        self.id_sesion = str(uuid.uuid4())[:8]
    
    def get_estado(self):
        """Obtener estado actual del contexto"""
        return {
            'id_sesion': self.id_sesion,
            'contexto_activo': {k: v for k, v in self.sesion_actual.items() if v is not None},
            'interacciones': len(self.historial_sesion)
        }

# Almacenar contextos por usuario
contextos_usuario = {}

def get_contexto_usuario(user_id: int) -> ContextoConversacion:
    """Obtener o crear contexto para un usuario"""
    if user_id not in contextos_usuario:
        contextos_usuario[user_id] = ContextoConversacion()
    return contextos_usuario[user_id]

# === TUS FUNCIONES ORIGINALES ADAPTADAS CON MEJORAS EVALUACIÓN 3 ===

def obtener_consulta_sql_con_hilado(pregunta: str, user_id: int):
    """Tu versión completa con hilado inteligente + MEJORAS EVALUACIÓN 3"""
    
    # 1. VERIFICAR TÉRMINOS EXCLUIDOS (Punto E)
    if verificar_terminos_excluidos(pregunta):
        return "TERMINO_EXCLUIDO", "Pregunta contiene términos no permitidos"
    
    # 2. OBTENER CONFIGURACIÓN ACTIVA (Punto F)
    config_activa = obtener_configuracion_activa()
    
    contexto_conversacion = get_contexto_usuario(user_id)
    
    # 3. Detectar contexto en la pregunta actual
    contexto_conversacion.detectar_contexto_en_pregunta(pregunta)
    
    # 4. Expandir pregunta si es continuación
    pregunta_expandida = contexto_conversacion.expandir_pregunta_continuacion(pregunta)
    
    # 5. Construir contexto para el prompt
    contexto_activo = contexto_conversacion.construir_contexto_para_prompt()
    
    CONTEXTO_GENERAL_ACUMULADO = f"""
CONTEXTO INTELIGENTE:
{contexto_activo}

ESTRUCTURA DE DATOS:
{ESTRUCTURA_TABLA}
"""

    # Mostrar si se expandió la pregunta
    expansion_info = None
    if pregunta_expandida != pregunta:
        expansion_info = f"Pregunta expandida: '{pregunta}' → '{pregunta_expandida}'"

    # 6. CONSTRUIR PROMPT CON CONFIGURACIÓN PERSONALIZADA
    prompt_base = f"""
{CONTEXT}

{CONTEXTO_GENERAL_ACUMULADO}

Nueva pregunta: "{pregunta_expandida}"

Genera una consulta SQL válida para PostgreSQL que responda la pregunta. REGLAS ESTRICTAS:

1. Si la pregunta NO se puede responder con datos de defunciones/mortalidad, responde SOLO: NO_SE_PUEDE_GENERAR
2. USA COMILLAS DOBLES para nombres de columnas: "ANIO", "FECHA_DEF", "SEXO_NOMBRE"
3. Para JOINs usa: defunciones_principales d JOIN ubicaciones u ON d."COD_COMUNA" = u."COD_COMUNA"
4. Para diagnósticos: JOIN diagnosticos diag ON d."DIAG1" = diag.codigo_diagnostico
5. Funciones PostgreSQL: COUNT(), AVG(), SUM(), DATE_PART(), EXTRACT()
6. Para filtros de año: WHERE "ANIO" = 2023 (PREFERIR esto sobre filtros de fecha)
7. Para filtros de fecha específicos: WHERE "FECHA_DEF" BETWEEN '2023-01-01' AND '2025-12-31' (solo si necesario)
8. Para causas de muerte: 
   - Cáncer: WHERE "DIAG1" LIKE 'C%'
   - Cardiovascular: WHERE "DIAG1" LIKE 'I%'  
   - Respiratorio: WHERE "DIAG1" LIKE 'J%'
9. Limita a 100 filas máximo: LIMIT 100
10. Incluye ORDER BY para ordenar resultados
11. NO inventes columnas inexistentes
12. SOLO consultas SELECT, nunca CREATE/DROP/UPDATE
13. Para campos nulos usa: WHERE "DIAG2" IS NULL (muertes naturales)

IMPORTANTE: USAR "ANIO" en lugar de "FECHA_DEF" para filtros de año, ya que algunos registros tienen fechas problemáticas.

EJEMPLOS DE PATRONES:
- Muertes por región: SELECT u."NOMBRE_REGION", COUNT(*) FROM defunciones_principales d JOIN ubicaciones u ON d."COD_COMUNA" = u."COD_COMUNA" GROUP BY u."NOMBRE_REGION" ORDER BY COUNT(*) DESC
- Lista de regiones: SELECT u."NOMBRE_REGION", COUNT(*) FROM defunciones_principales d JOIN ubicaciones u ON d."COD_COMUNA" = u."COD_COMUNA" GROUP BY u."NOMBRE_REGION" ORDER BY u."NOMBRE_REGION"
- Total simple: SELECT COUNT(*) AS total_defunciones FROM defunciones_principales
- Por año: SELECT "ANIO", COUNT(*) FROM defunciones_principales GROUP BY "ANIO" ORDER BY "ANIO"
- Por sexo: SELECT "SEXO_NOMBRE", COUNT(*) FROM defunciones_principales GROUP BY "SEXO_NOMBRE"
- Principales causas: SELECT diag.descripcion_capitulo, COUNT(*) FROM defunciones_principales d JOIN diagnosticos diag ON d."DIAG1" = diag.codigo_diagnostico GROUP BY diag.descripcion_capitulo ORDER BY COUNT(*) DESC LIMIT 10
- Filtro por año específico: SELECT COUNT(*) FROM defunciones_principales WHERE "ANIO" = 2025

CRÍTICO: USAR "ANIO" para filtros de año, NO "FECHA_DEF", para evitar perder registros con fechas problemáticas.
IMPORTANTE: Para preguntas sobre totales después de ver listas, usar consulta simple sin subconsultas.
NOTA: Si la pregunta pide una lista después de una consulta previa, generar la consulta apropiada aunque la pregunta sea simple como "puedes darme la lista".
"""

    # 7. APLICAR CONFIGURACIÓN PERSONALIZADA DEL ADMIN
    if config_activa:
        if config_activa.get('restricciones'):
            prompt_base += f"\n\nRESTRICCIONES ADICIONALES:\n" + "\n".join([f"- {r}" for r in config_activa['restricciones']])
        
        if config_activa.get('instrucciones_adicionales'):
            prompt_base += f"\n\nINSTRUCCIONES ESPECIALES: {config_activa['instrucciones_adicionales']}"

    try:
        # 8. USAR CONFIGURACIÓN PERSONALIZADA PARA LA API
        max_tokens = config_activa.get('max_tokens', 1000)
        temperature = config_activa.get('temperature', 0)
        
        message = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[{"role": "user", "content": prompt_base}]
        )
        sql_resultado = message.content[0].text.strip()
        
        # Registrar la interacción
        contexto_conversacion.agregar_interaccion(pregunta, sql_resultado)
        
        return sql_resultado, expansion_info
    except Exception as e:
        print(f"Error generando SQL: {e}")
        return "NO_SE_PUEDE_GENERAR", None

def ejecutar_sql(sql):
    """Tu función original de ejecución SQL"""
    if sql.strip() == "NO_SE_PUEDE_GENERAR":
        return "La pregunta no se puede responder con esta base de datos de defunciones."
    
    # Limpiar SQL - quitar explicaciones extra (tu lógica original)
    sql_lines = sql.strip().split('\n')
    sql_clean = ""
    for line in sql_lines:
        line = line.strip()
        if line.upper().startswith('SELECT') or line.upper().startswith('FROM') or line.upper().startswith('WHERE') or line.upper().startswith('GROUP BY') or line.upper().startswith('ORDER BY') or line.upper().startswith('LIMIT') or line.upper().startswith('JOIN') or line.upper().startswith('AND') or line.upper().startswith('EXTRACT') or line.upper().startswith('COUNT'):
            sql_clean += line + " "
        elif sql_clean and (line.startswith('    ') or line.startswith('\t')):  # Continuación de línea
            sql_clean += line + " "
    
    if not sql_clean.strip():
        sql_clean = sql_lines[0] if sql_lines else sql
    
    sql = sql_clean.strip()
    
    if not sql.lower().startswith("select"):
        return "La pregunta no se puede responder con esta base de datos de defunciones."
    
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql)
        results = cur.fetchall()
        cur.close()
        conn.close()
        
        # Convertir a lista de diccionarios para compatibilidad
        if results:
            return [dict(row) for row in results]
        else:
            # Si no hay resultados, verificar si la consulta es válida
            return "Sin registros para los criterios especificados."
    except psycopg2.Error as err:
        return f"Error en consulta SQL: {err}"

def generar_respuesta_final(resultado_sql, pregunta):
    """Tu función original de generación de respuestas"""
    if isinstance(resultado_sql, str):
        if "Error" in resultado_sql:
            return resultado_sql
        elif "Sin registros" in resultado_sql:
            return "0 (sin registros para los criterios especificados)"
        else:
            return resultado_sql
    
    # Si hay resultados numéricos
    if isinstance(resultado_sql, list) and resultado_sql:
        # Si es un COUNT que devuelve 0
        for fila in resultado_sql:
            for key, value in fila.items():
                if isinstance(value, (int, float)) and value == 0:
                    return "0"
                elif isinstance(value, float):
                    fila[key] = round(value, 2)
    
    prompt = f"""
Pregunta: "{pregunta}"
Resultados SQL: {resultado_sql}

Responde SOLO lo mínimo necesario. Traduce términos médicos a lenguaje común cuando sea apropiado.

TRADUCCIONES:
- "Tumores [Neoplasias]" → "Cáncer"
- "Enfermedades del sistema circulatorio" → "Problemas cardiovasculares" 
- "Enfermedades del sistema respiratorio" → "Problemas respiratorios"
- Números: usar formato con comas (ej: 15,432)

REGLAS:
1. Da la respuesta más corta posible
2. Solo la información esencial
3. Sin introducciones ni explicaciones
4. Solo números y datos específicos

Ejemplos:
- Pregunta: "¿cuántas muertes?" → Respuesta: "15,432 muertes"
- Pregunta: "¿qué región?" → Respuesta: "Región Metropolitana"
- Pregunta: "¿cuál es la principal causa?" → Respuesta: "Enfermedades cardiovasculares"
"""

    try:
        message = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=500,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text.strip()
    except Exception as e:
        return f"Error generando respuesta: {e}"

# === ESQUEMAS PYDANTIC ===

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class ChatMessage(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    sql_query: Optional[str] = None
    expansion_info: Optional[str] = None
    context_info: Optional[Dict[str, Any]] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int

# === SEGURIDAD ===

security = HTTPBearer()

def get_password_hash(password: str) -> str:
    """Hash de password simple"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verificar password"""
    return get_password_hash(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Crear JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Obtener usuario actual del token"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        return int(user_id)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

# === ENDPOINTS API ===

@app.get("/")
async def root():
    return {"message": "Chatbot Defunciones Chile API", "status": "running", "version": "2.0.0"}

@app.post("/register", response_model=dict)
async def register(user: UserCreate):
    """Registrar nuevo usuario"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        # Verificar si usuario existe
        cur.execute("SELECT id FROM usuarios WHERE username = %s", (user.username,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Usuario ya existe")
        
        # Crear usuario
        hashed_password = get_password_hash(user.password)
        cur.execute(
            "INSERT INTO usuarios (username, email, password_hash, created_at) VALUES (%s, %s, %s, %s) RETURNING id",
            (user.username, user.email, hashed_password, datetime.now())
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        
        return {"message": "Usuario creado exitosamente", "user_id": user_id}
    except psycopg2.Error as err:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {err}")

@app.post("/login", response_model=Token)
async def login(user: UserLogin):
    """Login de usuario"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        cur.execute("SELECT id, password_hash FROM usuarios WHERE username = %s", (user.username,))
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result or not verify_password(user.password, result[1]):
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        
        # Crear token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(result[0])}, expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": result[0]
        }
    except psycopg2.Error as err:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {err}")

@app.post("/chat", response_model=ChatResponse)
async def chat(message: ChatMessage, user_id: int = Depends(get_current_user)):
    """Endpoint principal del chat CON TODAS LAS MEJORAS DE EVALUACIÓN 3"""
    try:
        # 1. Generar conversation_id ANTES de cualquier operación
        # ARREGLO: Verificar si viene "null" como string también
        if not message.conversation_id or message.conversation_id == "null":
            conversation_id = str(uuid.uuid4())
            is_new_conversation = True
        else:
            conversation_id = message.conversation_id
            is_new_conversation = False
        
        print(f"🔍 DEBUG - conversation_id generado: {conversation_id}")
        print(f"🔍 DEBUG - es nueva conversación: {is_new_conversation}")
        
        # 2. Generar SQL con hilado inteligente + filtros (EVALUACIÓN 3)
        sql_query, expansion_info = obtener_consulta_sql_con_hilado(message.message, user_id)
        
        # 3. Verificar si fue bloqueado por términos excluidos
        if sql_query == "TERMINO_EXCLUIDO":
            return ChatResponse(
                response="⚠️ Su consulta contiene términos no permitidos. Por favor, reformule su pregunta.",
                conversation_id=conversation_id,
                sql_query=None,
                expansion_info=expansion_info,
                context_info=None
            )
        
        # 4. Ejecutar SQL (tu función original)
        resultado_sql = ejecutar_sql(sql_query)
        
        # 5. Generar respuesta natural (tu función original)
        respuesta = generar_respuesta_final(resultado_sql, message.message)
        
        # 6. Obtener contexto actual
        contexto_usuario = get_contexto_usuario(user_id)
        context_info = contexto_usuario.get_estado()
        
        # 7. Guardar conversación (ARREGLADO - sin try/catch interno)
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        try:
            # Solo crear conversación si es nueva
            if is_new_conversation:
                print(f"📝 DEBUG - Creando nueva conversación con ID: {conversation_id}")
                cur.execute(
                    "INSERT INTO conversaciones (id, user_id, titulo, created_at) VALUES (%s, %s, %s, %s)",
                    (conversation_id, user_id, message.message[:50], datetime.now())
                )
            
            # Siempre guardar el mensaje
            print(f"💬 DEBUG - Guardando mensaje con conversation_id: {conversation_id}")
            cur.execute(
                "INSERT INTO mensajes (conversation_id, pregunta, respuesta, sql_query, created_at) VALUES (%s, %s, %s, %s, %s)",
                (conversation_id, message.message, respuesta, sql_query if sql_query != "NO_SE_PUEDE_GENERAR" else None, datetime.now())
            )
            
            conn.commit()
            print(f"✅ Guardado exitoso - Conversation ID: {conversation_id}")
            
        except psycopg2.Error as db_error:
            conn.rollback()
            print(f"❌ Error de BD: {db_error}")
            # Si hay error, seguir sin guardar pero mostrar el error completo
            
        finally:
            cur.close()
            conn.close()
        
        return ChatResponse(
            response=respuesta,
            conversation_id=conversation_id,
            sql_query=sql_query if sql_query != "NO_SE_PUEDE_GENERAR" else None,
            expansion_info=expansion_info,
            context_info=context_info
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en chat: {str(e)}")

@app.get("/conversations")
async def get_conversations(user_id: int = Depends(get_current_user)):
    """Obtener conversaciones del usuario"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute(
            "SELECT id, titulo, created_at FROM conversaciones WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
        conversations = cur.fetchall()
        cur.close()
        conn.close()
        
        return [dict(conv) for conv in conversations]
    except psycopg2.Error as err:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {err}")

@app.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: str, user_id: int = Depends(get_current_user)):
    """Obtener mensajes de una conversación"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Verificar que la conversación pertenece al usuario
        cur.execute(
            "SELECT id FROM conversaciones WHERE id = %s AND user_id = %s",
            (conversation_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Conversación no encontrada")
        
        # Obtener mensajes CON ID
        cur.execute(
            "SELECT id, pregunta, respuesta, sql_query, created_at FROM mensajes WHERE conversation_id = %s ORDER BY created_at",
            (conversation_id,)
        )
        messages = cur.fetchall()
        cur.close()
        conn.close()
        
        return [dict(msg) for msg in messages]
    except psycopg2.Error as err:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {err}")

@app.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user_id: int = Depends(get_current_user)):
    """Eliminar conversación"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        # Verificar que la conversación pertenece al usuario
        cur.execute(
            "SELECT id FROM conversaciones WHERE id = %s AND user_id = %s",
            (conversation_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Conversación no encontrada")
        
        # Eliminar mensajes primero (por foreign key)
        cur.execute("DELETE FROM mensajes WHERE conversation_id = %s", (conversation_id,))
        
        # Eliminar conversación
        cur.execute("DELETE FROM conversaciones WHERE id = %s", (conversation_id,))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {"message": "Conversación eliminada exitosamente"}
    except psycopg2.Error as err:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {err}")

@app.post("/conversations/{conversation_id}/restart")
async def restart_conversation(conversation_id: str, user_id: int = Depends(get_current_user)):
    """Reiniciar contexto de una conversación"""
    try:
        # Reiniciar contexto del usuario
        if user_id in contextos_usuario:
            contextos_usuario[user_id].reiniciar_sesion()
        
        return {"message": "Contexto reiniciado exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/context")
async def get_context(user_id: int = Depends(get_current_user)):
    """Obtener contexto actual del usuario"""
    contexto_usuario = get_contexto_usuario(user_id)
    return contexto_usuario.get_estado()

@app.post("/context/reset")
async def reset_context(user_id: int = Depends(get_current_user)):
    """Reiniciar contexto del usuario"""
    if user_id in contextos_usuario:
        contextos_usuario[user_id].reiniciar_sesion()
    return {"message": "Contexto reiniciado"}

@app.get("/stats")
async def get_stats():
    """Estadísticas básicas del dataset (tu función original)"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        # Total defunciones
        cur.execute('SELECT COUNT(*) FROM defunciones_principales')
        total = cur.fetchone()[0]
        
        # Regiones
        cur.execute('SELECT COUNT(DISTINCT "NOMBRE_REGION") FROM ubicaciones')
        regiones = cur.fetchone()[0]
        
        # Período
        cur.execute('SELECT MIN("ANIO"), MAX("ANIO") FROM defunciones_principales')
        años = cur.fetchone()
        
        # Por año
        cur.execute('SELECT "ANIO", COUNT(*) FROM defunciones_principales GROUP BY "ANIO" ORDER BY "ANIO"')
        por_año = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return {
            "total_defunciones": total,
            "total_regiones": regiones,
            "periodo": {"inicio": años[0], "fin": años[1]},
            "por_año": [{"año": año, "cantidad": cantidad} for año, cantidad in por_año]
        }
    except psycopg2.Error as err:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {err}")

# === ENDPOINTS PARA EVALUACIÓN 3 (FUNCIONALIDADES AVANZADAS) ===

@app.get("/admin/excluded-terms")
async def get_excluded_terms(user_id: int = Depends(get_current_user)):
    """Obtener términos excluidos (Evaluación 3 - E)"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute("SELECT * FROM terminos_excluidos ORDER BY termino")
        terms = cur.fetchall()
        cur.close()
        conn.close()
        
        return [dict(term) for term in terms]
    except psycopg2.Error as err:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {err}")

@app.post("/admin/excluded-terms")
async def add_excluded_term(term_data: dict, user_id: int = Depends(get_current_user)):
    """Agregar término excluido (Evaluación 3 - E)"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        cur.execute(
            "INSERT INTO terminos_excluidos (termino, activo, created_at) VALUES (%s, %s, %s)",
            (term_data["termino"], True, datetime.now())
        )
        conn.commit()
        cur.close()
        conn.close()
        
        return {"message": "Término agregado exitosamente"}
    except psycopg2.Error as err:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {err}")

@app.delete("/admin/excluded-terms/{term_id}")
async def delete_excluded_term(term_id: int, user_id: int = Depends(get_current_user)):
    """Eliminar término excluido"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        cur.execute("DELETE FROM terminos_excluidos WHERE id = %s", (term_id,))
        conn.commit()
        cur.close()
        conn.close()
        
        return {"message": "Término eliminado exitosamente"}
    except psycopg2.Error as err:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {err}")

@app.get("/admin/prompt-config")
async def get_prompt_config(user_id: int = Depends(get_current_user)):
    """Obtener configuración de prompts (Evaluación 3 - F)"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute("SELECT * FROM configuracion_prompts WHERE activo = true ORDER BY created_at DESC LIMIT 1")
        config = cur.fetchone()
        cur.close()
        conn.close()
        
        return dict(config) if config else {"message": "Sin configuración activa"}
    except psycopg2.Error as err:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {err}")

@app.post("/admin/prompt-config")
async def update_prompt_config(config_data: dict, user_id: int = Depends(get_current_user)):
    """Actualizar configuración de prompts (Evaluación 3 - F)"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        # Desactivar configuración anterior
        cur.execute("UPDATE configuracion_prompts SET activo = false")
        
        # Crear nueva configuración
        cur.execute(
            "INSERT INTO configuracion_prompts (nombre, configuracion, activo, created_at) VALUES (%s, %s, %s, %s)",
            (config_data["nombre"], json.dumps(config_data["configuracion"]), True, datetime.now())
        )
        conn.commit()
        cur.close()
        conn.close()
        
        return {"message": "Configuración actualizada exitosamente"}
    except psycopg2.Error as err:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {err}")

@app.get("/chat/details/{message_id}")
async def get_message_details(message_id: int, user_id: int = Depends(get_current_user)):
    """Obtener detalles ampliados de un mensaje para MODALES (Evaluación 3 - G)"""
    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Obtener mensaje con datos adicionales
        cur.execute("""
            SELECT m.*, c.titulo, c.user_id 
            FROM mensajes m 
            JOIN conversaciones c ON m.conversation_id = c.id 
            WHERE m.id = %s AND c.user_id = %s
        """, (message_id, user_id))
        
        message = cur.fetchone()
        if not message:
            raise HTTPException(status_code=404, detail="Mensaje no encontrado")
        
        # Construir detalles ampliados para modal
        details = dict(message)
        
        # INFORMACIÓN CONTEXTUAL ADICIONAL
        details['analisis'] = {
            'timestamp': message['created_at'].strftime("%d/%m/%Y %H:%M:%S"),
            'longitud_pregunta': len(message['pregunta']),
            'longitud_respuesta': len(message['respuesta'])
        }
        
        # Si hay SQL, agregar análisis del query
        if message['sql_query'] and message['sql_query'] != "NO_SE_PUEDE_GENERAR":
            sql = message['sql_query']
            
            # Análisis del SQL
            details['sql_analysis'] = {
                'tipo_consulta': 'COUNT' if 'COUNT(' in sql else 'SELECT' if 'SELECT' in sql else 'OTRA',
                'usa_joins': 'JOIN' in sql,
                'usa_filtros': 'WHERE' in sql,
                'usa_agrupacion': 'GROUP BY' in sql,
                'complejidad': 'ALTA' if sql.count('JOIN') > 1 else 'MEDIA' if 'JOIN' in sql else 'BÁSICA'
            }
            
            # Ejecutar SQL de nuevo para datos actualizados
            resultado_actual = ejecutar_sql(sql)
            details['datos_actualizados'] = resultado_actual
            
            # Información estadística adicional si es numérica
            if isinstance(resultado_actual, list) and resultado_actual:
                if len(resultado_actual) == 1 and len(resultado_actual[0]) == 1:
                    # Es un COUNT o suma
                    valor = list(resultado_actual[0].values())[0]
                    if isinstance(valor, (int, float)):
                        details['estadisticas'] = {
                            'tipo': 'Valor único',
                            'valor': valor,
                            'porcentaje_del_total': round((valor / 303779) * 100, 2) if valor < 303779 else 100
                        }
        
        # Contexto de la conversación
        cur.execute("""
            SELECT COUNT(*) as total_mensajes,
                   MIN(created_at) as inicio_conversacion,
                   MAX(created_at) as ultimo_mensaje
            FROM mensajes 
            WHERE conversation_id = %s
        """, (message['conversation_id'],))
        
        conv_stats = cur.fetchone()
        details['contexto_conversacion'] = dict(conv_stats)
        
        cur.close()
        conn.close()
        
        return details
        
    except psycopg2.Error as err:
        raise HTTPException(status_code=500, detail=f"Error de base de datos: {err}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)