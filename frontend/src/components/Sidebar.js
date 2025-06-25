import React, { useState, useEffect } from 'react';
import { chatService, generalService } from '../services/api';

const Sidebar = ({ 
  conversations, 
  activeConversation, 
  onConversationSelect, 
  onViewChange, 
  currentView, 
  onLogout, 
  user 
}) => {
  const [conversationsList, setConversationsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  // Cargar conversaciones al montar el componente
  useEffect(() => {
    loadConversations();
    loadStats();
  }, []);

  // Actualizar lista cuando cambie conversations prop
  useEffect(() => {
    setConversationsList(conversations);
  }, [conversations]);

  // Cargar conversaciones
  const loadConversations = async () => {
    try {
      setLoading(true);
      console.log('Cargando conversaciones...'); // Debug
      const response = await chatService.getConversations();
      console.log('Respuesta conversaciones:', response); // Debug
      setConversationsList(response.conversations || response || []);
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
      console.error('Detalles del error:', error.response?.data);
      setError('Error cargando conversaciones');
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas básicas
  const loadStats = async () => {
    try {
      const response = await generalService.getStats();
      setStats(response);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  // Formatear fecha para mostrar
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Hoy';
    } else if (diffDays === 2) {
      return 'Ayer';
    } else if (diffDays <= 7) {
      return `Hace ${diffDays - 1} días`;
    } else {
      return date.toLocaleDateString('es-CL');
    }
  };

  // Truncar título si es muy largo
  const truncateTitle = (title, maxLength = 35) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <h2 className="sidebar-title">Defunciones Chile</h2>
        <div className="user-info">
          👤 {user?.username || 'Usuario'}
          {stats && (
            <div style={{ fontSize: '12px', marginTop: '5px', color: '#888' }}>
              📊 {stats.total_defunciones?.toLocaleString()} registros
            </div>
          )}
        </div>
      </div>

      {/* Navegación */}
      <div className="sidebar-nav">
        <button
          className={`nav-button ${currentView === 'chat' ? 'active' : ''}`}
          onClick={() => onViewChange('chat')}
        >
          💬 Chat
        </button>
        
        <button
          className={`nav-button ${currentView === 'admin' ? 'active' : ''}`}
          onClick={() => onViewChange('admin')}
        >
          ⚙️ Administración
        </button>
      </div>

      {/* Lista de conversaciones (solo en vista chat) */}
      {currentView === 'chat' && (
        <div className="conversations-list">
          <div style={{ 
            padding: '15px 20px 10px', 
            fontSize: '14px', 
            fontWeight: '600', 
            color: '#666',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>Conversaciones</span>
            <button
              onClick={loadConversations}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#667eea'
              }}
              title="Recargar conversaciones"
            >
              🔄
            </button>
          </div>

          {loading && (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#999',
              fontSize: '14px'
            }}>
              Cargando conversaciones...
            </div>
          )}

          {error && (
            <div style={{ 
              padding: '15px 20px', 
              color: '#dc3545',
              fontSize: '13px',
              background: '#f8d7da',
              margin: '10px',
              borderRadius: '6px'
            }}>
              {error}
            </div>
          )}

          {!loading && conversationsList.length === 0 && (
            <div style={{ 
              padding: '30px 20px', 
              textAlign: 'center', 
              color: '#999',
              fontSize: '14px'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>💭</div>
              <div>No tienes conversaciones aún</div>
              <div style={{ fontSize: '12px', marginTop: '5px' }}>
                Empieza haciendo una pregunta
              </div>
            </div>
          )}

          {!loading && conversationsList.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${
                activeConversation?.id === conversation.id ? 'active' : ''
              }`}
              onClick={() => onConversationSelect(conversation)}
            >
              <div className="conversation-title">
                {truncateTitle(conversation.titulo)}
              </div>
              <div className="conversation-date">
                {formatDate(conversation.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vista de administración - Panel de información */}
      {currentView === 'admin' && (
        <div className="conversations-list">
          <div style={{ 
            padding: '15px 20px 10px', 
            fontSize: '14px', 
            fontWeight: '600', 
            color: '#666'
          }}>
            Panel de Control
          </div>

          <div style={{ padding: '10px 20px' }}>
            <div style={{
              background: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              fontSize: '13px',
              lineHeight: '1.4'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '10px' }}>
                📊 Estadísticas del Sistema
              </div>
              
              {stats ? (
                <>
                  <div>• Defunciones: {stats.total_defunciones?.toLocaleString()}</div>
                  <div>• Regiones: {stats.total_regiones}</div>
                  <div>• Comunas: {stats.total_comunas}</div>
                  <div>• Años: {stats.anios_disponibles}</div>
                </>
              ) : (
                <div>Cargando estadísticas...</div>
              )}
            </div>

            <div style={{
              background: '#e7f3ff',
              padding: '15px',
              borderRadius: '8px',
              fontSize: '13px',
              lineHeight: '1.4',
              marginTop: '15px'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '10px' }}>
                ⚙️ Funciones Disponibles
              </div>
              <div>• Configurar términos excluidos</div>
              <div>• Personalizar prompts de IA</div>
              <div>• Gestionar configuraciones</div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="sidebar-footer">
        <button 
          className="logout-button"
          onClick={onLogout}
        >
          🚪 Cerrar Sesión
        </button>
        
        <div style={{ 
          textAlign: 'center', 
          fontSize: '11px', 
          color: '#999', 
          marginTop: '10px'
        }}>
          Evaluación 3 - IA
          <br />
          FastAPI + React
        </div>
      </div>
    </div>
  );
};

export default Sidebar;