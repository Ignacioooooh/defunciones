import React, { useEffect } from 'react';

const Modal = ({ data, onClose }) => {
  // PRIMERO: Todos los hooks deben ir ANTES de cualquier return
  // Manejar escape para cerrar
  useEffect(() => {
    if (!data) return; // Si no hay data, no hacer nada

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, data]);

  // DESPUÉS: Returns condicionales
  if (!data) return null;

  // Manejar clic en overlay para cerrar
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Formatear SQL para mejor visualización
  const formatSQL = (sql) => {
    if (!sql) return 'No disponible';
    
    return sql
      .replace(/SELECT/gi, 'SELECT')
      .replace(/FROM/gi, '\nFROM')
      .replace(/WHERE/gi, '\nWHERE')
      .replace(/GROUP BY/gi, '\nGROUP BY')
      .replace(/ORDER BY/gi, '\nORDER BY')
      .replace(/AND/gi, '\n  AND')
      .replace(/OR/gi, '\n  OR');
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Renderizar contenido según el tipo
  const renderContent = () => {
    switch (data.type) {
      case 'message-details':
        return renderMessageDetails();
      default:
        return <div>Tipo de modal no reconocido</div>;
    }
  };

  // Renderizar detalles del mensaje
  const renderMessageDetails = () => {
    const { message, details } = data;
    
    return (
      <>
        <div className="modal-header">
          <h2 className="modal-title">Detalles del Mensaje</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Pregunta original */}
        <div className="modal-section">
          <h3>❓ Pregunta Original</h3>
          <div style={{
            background: '#f8f9fa',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid #e9ecef',
            fontStyle: 'italic'
          }}>
            {message.pregunta}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Enviado el: {formatDate(message.created_at)}
          </div>
        </div>

        {/* Respuesta */}
        <div className="modal-section">
          <h3>🤖 Respuesta del Sistema</h3>
          <div style={{
            background: '#e7f3ff',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid #b8daff',
            lineHeight: '1.5'
          }}>
            {message.respuesta}
          </div>
        </div>

        {/* SQL Query */}
        {(message.sql_query || details?.sql_query) && (
          <div className="modal-section">
            <h3>🗄️ Consulta SQL Generada</h3>
            <div className="code-block">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {formatSQL(message.sql_query || details.sql_query)}
              </pre>
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              Esta consulta se ejecutó automáticamente contra la base de datos PostgreSQL
            </div>
          </div>
        )}

        {/* Información del contexto */}
        {(message.context_info || details?.context_info) && (
          <div className="modal-section">
            <h3>🧠 Información del Contexto</h3>
            <div style={{
              background: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              {renderContextInfo(message.context_info || details.context_info)}
            </div>
          </div>
        )}

        {/* Detalles técnicos adicionales */}
        {details && (
          <div className="modal-section">
            <h3>⚙️ Detalles Técnicos</h3>
            <div style={{
              background: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #e9ecef',
              fontSize: '13px'
            }}>
              {details.processing_time && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Tiempo de procesamiento:</strong> {details.processing_time}ms
                </div>
              )}
              
              {details.model_used && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Modelo utilizado:</strong> {details.model_used}
                </div>
              )}
              
              {details.tokens_used && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Tokens utilizados:</strong> {details.tokens_used}
                </div>
              )}
              
              {details.confidence_score && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Puntuación de confianza:</strong> {details.confidence_score}%
                </div>
              )}
              
              <div>
                <strong>ID del mensaje:</strong> {message.id}
              </div>
            </div>
          </div>
        )}

        {/* Posibles mejoras */}
        <div className="modal-section">
          <h3>💡 Información Adicional</h3>
          <div style={{
            background: '#fff3cd',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid #ffeaa7',
            fontSize: '13px'
          }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>💡 Sugerencias:</strong>
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Puedes hacer preguntas de seguimiento manteniendo el contexto</li>
              <li>Para mejores resultados, sé específico con fechas y ubicaciones</li>
              <li>El sistema recuerda el contexto de tu conversación actual</li>
            </ul>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          justifyContent: 'flex-end', 
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid #e9ecef'
        }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(message.sql_query || 'No disponible');
              alert('SQL copiado al portapapeles');
            }}
            style={{
              padding: '8px 16px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            📋 Copiar SQL
          </button>
          
          <button
            onClick={() => {
              const text = `Pregunta: ${message.pregunta}\n\nRespuesta: ${message.respuesta}\n\nSQL: ${message.sql_query || 'No disponible'}`;
              navigator.clipboard.writeText(text);
              alert('Información completa copiada al portapapeles');
            }}
            style={{
              padding: '8px 16px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            📋 Copiar Todo
          </button>
          
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Cerrar
          </button>
        </div>
      </>
    );
  };

  // Renderizar información del contexto
  const renderContextInfo = (contextInfo) => {
    if (!contextInfo) return <div>No hay información de contexto disponible</div>;

    const info = typeof contextInfo === 'string' ? JSON.parse(contextInfo) : contextInfo;

    return (
      <div style={{ fontSize: '13px' }}>
        {info.id_sesion && (
          <div style={{ marginBottom: '8px' }}>
            <strong>ID de Sesión:</strong> {info.id_sesion}
          </div>
        )}
        
        {info.interacciones && (
          <div style={{ marginBottom: '8px' }}>
            <strong>Interacciones en la sesión:</strong> {info.interacciones}
          </div>
        )}
        
        {info.contexto_activo && Object.keys(info.contexto_activo).length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <strong>Contexto activo:</strong>
            <div style={{ marginTop: '5px', paddingLeft: '15px' }}>
              {Object.entries(info.contexto_activo).map(([key, value]) => (
                <div key={key} style={{ marginBottom: '3px' }}>
                  <span style={{ fontWeight: '500' }}>{key}:</span> {value}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {info.expansion_aplicada && (
          <div style={{ marginBottom: '8px' }}>
            <strong>Expansión aplicada:</strong> {info.expansion_aplicada ? 'Sí' : 'No'}
          </div>
        )}
        
        {info.pregunta_expandida && (
          <div>
            <strong>Pregunta expandida:</strong>
            <div style={{ 
              marginTop: '5px', 
              fontStyle: 'italic',
              background: 'rgba(103, 126, 234, 0.1)',
              padding: '8px',
              borderRadius: '4px'
            }}>
              {info.pregunta_expandida}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default Modal;