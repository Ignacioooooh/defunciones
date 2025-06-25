import React, { useState, useEffect, useCallback } from 'react';
import { adminService, generalService } from '../services/api';

const AdminPanel = ({ user }) => {
  const [excludedTerms, setExcludedTerms] = useState([]);
  const [promptConfig, setPromptConfig] = useState(null);
  const [newTerm, setNewTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState(null);

  // Configuración de prompt por defecto
  const [promptSettings, setPromptSettings] = useState({
    temperatura: 0.1,
    max_tokens: 1000,
    instrucciones_adicionales: '',
    restricciones: 'No proporcionar información médica específica. Enfocarse solo en estadísticas de defunciones.',
    contexto_personalizado: ''
  });

  // Cargar términos excluidos
  const loadExcludedTerms = useCallback(async () => {
    try {
      const response = await adminService.getExcludedTerms();
      setExcludedTerms(response.terms || []);
    } catch (error) {
      console.error('Error cargando términos excluidos:', error);
    }
  }, []);

  // Cargar configuración de prompts
  const loadPromptConfig = useCallback(async () => {
    try {
      const response = await adminService.getPromptConfig();
      if (response.config) {
        setPromptConfig(response.config);
        // Parsear configuración si viene como string
        const config = typeof response.config.configuracion === 'string' 
          ? JSON.parse(response.config.configuracion)
          : response.config.configuracion;
        
        // Actualizar configuración sin depender del estado actual
        setPromptSettings(prev => ({ ...prev, ...config }));
      }
    } catch (error) {
      console.error('Error cargando configuración de prompts:', error);
    }
  }, []);

  // Cargar estadísticas
  const loadStats = useCallback(async () => {
    try {
      const response = await generalService.getStats();
      setStats(response);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  }, []);

  // Cargar todos los datos
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadExcludedTerms(),
        loadPromptConfig(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Error cargando datos admin:', error);
    } finally {
      setLoading(false);
    }
  }, [loadExcludedTerms, loadPromptConfig, loadStats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Agregar término excluido
  const addExcludedTerm = async () => {
    if (!newTerm.trim()) return;

    try {
      setLoading(true);
      await adminService.addExcludedTerm({
        termino: newTerm.trim(),
        descripcion: `Término agregado por ${user?.username || 'admin'}`
      });
      
      setNewTerm('');
      setSuccess('Término agregado exitosamente');
      await loadExcludedTerms();
    } catch (error) {
      console.error('Error agregando término:', error);
      setError('Error agregando término excluido');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar término excluido
  const deleteExcludedTerm = async (termId) => {
    if (!window.confirm('¿Estás seguro de eliminar este término?')) return;

    try {
      setLoading(true);
      await adminService.deleteExcludedTerm(termId);
      setSuccess('Término eliminado exitosamente');
      await loadExcludedTerms();
    } catch (error) {
      console.error('Error eliminando término:', error);
      setError('Error eliminando término');
    } finally {
      setLoading(false);
    }
  };

  // Guardar configuración de prompts
  const savePromptConfig = async () => {
    try {
      setLoading(true);
      await adminService.updatePromptConfig({
        nombre: 'Configuración Principal',
        configuracion: promptSettings
      });
      
      setSuccess('Configuración guardada exitosamente');
      await loadPromptConfig();
    } catch (error) {
      console.error('Error guardando configuración:', error);
      setError('Error guardando configuración');
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambios en configuración
  const handleConfigChange = (field, value) => {
    setPromptSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Limpiar mensajes
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className="admin-container">
      {/* Header */}
      <div className="admin-header">
        <h1 className="admin-title">Panel de Administración</h1>
        <p className="admin-subtitle">
          Configuración del sistema y términos excluidos - Usuario: {user?.username || 'Admin'}
        </p>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="error-message" style={{ marginBottom: '20px' }}>
          {error}
          <button onClick={clearMessages} style={{ float: 'right', background: 'none', border: 'none' }}>✕</button>
        </div>
      )}

      {success && (
        <div className="success-message" style={{ marginBottom: '20px' }}>
          {success}
          <button onClick={clearMessages} style={{ float: 'right', background: 'none', border: 'none' }}>✕</button>
        </div>
      )}

      {/* Estadísticas del sistema */}
      <div className="admin-section" style={{ marginBottom: '30px' }}>
        <h2 className="section-title">📊 Estadísticas del Sistema</h2>
        {stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                {stats.total_defunciones?.toLocaleString()}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>Defunciones</div>
            </div>
            <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                {stats.total_regiones}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>Regiones</div>
            </div>
            <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
                {stats.total_comunas}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>Comunas</div>
            </div>
            <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                {stats.anios_disponibles}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>Años disponibles</div>
            </div>
          </div>
        ) : (
          <div>Cargando estadísticas...</div>
        )}
      </div>

      {/* Secciones principales */}
      <div className="admin-sections">
        {/* Términos excluidos */}
        <div className="admin-section">
          <h2 className="section-title">🚫 Términos Excluidos</h2>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
            Palabras o frases que serán filtradas automáticamente de las consultas de los usuarios.
          </p>

          {/* Lista de términos */}
          <div className="terms-list">
            {excludedTerms.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                color: '#999', 
                padding: '20px',
                fontSize: '14px'
              }}>
                No hay términos excluidos configurados
              </div>
            ) : (
              excludedTerms.map((term) => (
                <div key={term.id} className="term-item">
                  <div>
                    <strong>{term.termino}</strong>
                    {term.descripcion && (
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {term.descripcion}
                      </div>
                    )}
                  </div>
                  <button
                    className="delete-term"
                    onClick={() => deleteExcludedTerm(term.id)}
                    disabled={loading}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Agregar nuevo término */}
          <div className="add-term-form">
            <input
              type="text"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              placeholder="Nuevo término a excluir..."
              disabled={loading}
              onKeyPress={(e) => e.key === 'Enter' && addExcludedTerm()}
            />
            <button
              onClick={addExcludedTerm}
              disabled={loading || !newTerm.trim()}
            >
              {loading ? '...' : 'Agregar'}
            </button>
          </div>
        </div>

        {/* Configuración de prompts */}
        <div className="admin-section">
          <h2 className="section-title">🤖 Configuración de IA</h2>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
            Personaliza cómo responde el chatbot y su comportamiento.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* Temperatura */}
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '5px', display: 'block' }}>
                Temperatura ({promptSettings.temperatura})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={promptSettings.temperatura}
                onChange={(e) => handleConfigChange('temperatura', parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: '12px', color: '#666' }}>
                0 = Muy conservador, 1 = Muy creativo
              </div>
            </div>

            {/* Max tokens */}
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '5px', display: 'block' }}>
                Máximo de tokens
              </label>
              <input
                type="number"
                min="100"
                max="2000"
                value={promptSettings.max_tokens}
                onChange={(e) => handleConfigChange('max_tokens', parseInt(e.target.value))}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <div style={{ fontSize: '12px', color: '#666' }}>
                Longitud máxima de la respuesta
              </div>
            </div>

            {/* Instrucciones adicionales */}
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '5px', display: 'block' }}>
                Instrucciones adicionales
              </label>
              <textarea
                value={promptSettings.instrucciones_adicionales}
                onChange={(e) => handleConfigChange('instrucciones_adicionales', e.target.value)}
                placeholder="Instrucciones específicas para el comportamiento del chatbot..."
                style={{ 
                  width: '100%', 
                  minHeight: '80px', 
                  padding: '8px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Restricciones */}
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '5px', display: 'block' }}>
                Restricciones
              </label>
              <textarea
                value={promptSettings.restricciones}
                onChange={(e) => handleConfigChange('restricciones', e.target.value)}
                placeholder="Qué NO debe hacer el chatbot..."
                style={{ 
                  width: '100%', 
                  minHeight: '60px', 
                  padding: '8px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Contexto personalizado */}
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '5px', display: 'block' }}>
                Contexto personalizado
              </label>
              <textarea
                value={promptSettings.contexto_personalizado}
                onChange={(e) => handleConfigChange('contexto_personalizado', e.target.value)}
                placeholder="Información adicional sobre el contexto de los datos..."
                style={{ 
                  width: '100%', 
                  minHeight: '60px', 
                  padding: '8px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Botón guardar */}
            <button
              onClick={savePromptConfig}
              disabled={loading}
              style={{
                padding: '12px 24px',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              {loading ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>

          {/* Configuración actual */}
          {promptConfig && (
            <div style={{ 
              marginTop: '20px', 
              padding: '15px', 
              background: 'white', 
              borderRadius: '6px',
              border: '1px solid #ddd'
            }}>
              <h4 style={{ fontSize: '14px', marginBottom: '10px', color: '#333' }}>
                📋 Configuración Activa
              </h4>
              <div style={{ fontSize: '12px', color: '#666' }}>
                <div>Última actualización: {new Date(promptConfig.updated_at || promptConfig.created_at).toLocaleString('es-CL')}</div>
                <div>Por: {promptConfig.created_by || 'Sistema'}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="admin-section" style={{ marginTop: '30px' }}>
        <h2 className="section-title">⚡ Acciones Rápidas</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              padding: '15px',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '5px' }}>🔄</div>
            <div style={{ fontSize: '14px', fontWeight: '500' }}>Recargar Datos</div>
          </button>

          <button
            onClick={() => window.open('/docs', '_blank')}
            style={{
              padding: '15px',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '5px' }}>📖</div>
            <div style={{ fontSize: '14px', fontWeight: '500' }}>Documentación API</div>
          </button>

          <button
            onClick={() => {
              const data = {
                terms: excludedTerms,
                config: promptSettings,
                stats: stats
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `config-backup-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
            }}
            style={{
              padding: '15px',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '5px' }}>💾</div>
            <div style={{ fontSize: '14px', fontWeight: '500' }}>Exportar Config</div>
          </button>
        </div>
      </div>

      {/* Información del sistema */}
      <div style={{ 
        marginTop: '30px', 
        padding: '20px', 
        background: '#f1f3f4', 
        borderRadius: '8px',
        fontSize: '13px',
        color: '#666'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '10px' }}>ℹ️ Información del Sistema</div>
        <div>• Los términos excluidos se aplican automáticamente a todas las consultas</div>
        <div>• La configuración de IA afecta a todas las respuestas del chatbot</div>
        <div>• Los cambios se aplican inmediatamente después de guardar</div>
        <div>• Se recomienda hacer backup de la configuración regularmente</div>
      </div>
    </div>
  );
};

export default AdminPanel;