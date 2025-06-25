import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chatService } from '../services/api';

const Chat = ({ activeConversation, onConversationUpdate, onConversationsUpdate, onShowModal, user }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  // Cargar mensajes de la conversación
  const loadMessages = useCallback(async () => {
    if (!activeConversation) return;
    
    try {
      setIsLoading(true);
      const response = await chatService.getMessages(activeConversation.id);
      setMessages(response.messages || []);
    } catch (error) {
      console.error('Error cargando mensajes:', error);
      setError('Error cargando mensajes');
    } finally {
      setIsLoading(false);
    }
  }, [activeConversation]);

  // Scroll automático a los nuevos mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cargar mensajes cuando cambia la conversación activa
  useEffect(() => {
    if (activeConversation) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [activeConversation, loadMessages]);

  // Enviar mensaje
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      pregunta: inputMessage,
      respuesta: null,
      sql_query: null,
      created_at: new Date().toISOString(),
      isLoading: true
    };

    // Agregar mensaje del usuario inmediatamente
    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage('');
    setIsLoading(true);
    setError('');

    try {
      const response = await chatService.sendMessage(
        messageToSend,
        activeConversation?.id
      );

      // Actualizar el mensaje con la respuesta
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? {
              ...msg,
              id: response.message_id || msg.id,
              respuesta: response.response,
              sql_query: response.sql_query,
              context_info: response.context_info,
              isLoading: false
            }
          : msg
      ));

      // Si es una nueva conversación, actualizar la conversación activa
      if (response.conversation_id && (!activeConversation || activeConversation.id !== response.conversation_id)) {
        const newConversation = {
          id: response.conversation_id,
          titulo: messageToSend.substring(0, 50),
          created_at: new Date().toISOString()
        };
        onConversationUpdate(newConversation);
        
        // Recargar lista de conversaciones
        refreshConversations();
      }

    } catch (error) {
      console.error('Error enviando mensaje:', error);
      
      // Actualizar el mensaje con error
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? {
              ...msg,
              respuesta: 'Error: No se pudo procesar tu pregunta. Verifica tu conexión.',
              isLoading: false,
              error: true
            }
          : msg
      ));
      
      setError('Error enviando mensaje. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Recargar conversaciones
  const refreshConversations = async () => {
    try {
      const response = await chatService.getConversations();
      onConversationsUpdate(response.conversations || []);
    } catch (error) {
      console.error('Error recargando conversaciones:', error);
    }
  };

  // Crear nueva conversación
  const createNewConversation = () => {
    onConversationUpdate(null);
    setMessages([]);
    setInputMessage('');
    setError('');
  };

  // Eliminar conversación
  const deleteConversation = async () => {
    if (!activeConversation) return;
    
    if (window.confirm('¿Estás seguro de que quieres eliminar esta conversación?')) {
      try {
        await chatService.deleteConversation(activeConversation.id);
        onConversationUpdate(null);
        setMessages([]);
        refreshConversations();
      } catch (error) {
        console.error('Error eliminando conversación:', error);
        setError('Error eliminando conversación');
      }
    }
  };

  // Reiniciar contexto
  const restartContext = async () => {
    if (!activeConversation) return;
    
    try {
      await chatService.restartConversation(activeConversation.id);
      setMessages(prev => [...prev, {
        id: Date.now(),
        pregunta: '🔄 Contexto reiniciado',
        respuesta: 'El contexto de la conversación ha sido reiniciado. Puedes hacer preguntas desde cero.',
        created_at: new Date().toISOString(),
        isSystem: true
      }]);
    } catch (error) {
      console.error('Error reiniciando contexto:', error);
      setError('Error reiniciando contexto');
    }
  };

  // Manejar Enter para enviar
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Mostrar detalles del mensaje
  const showMessageDetails = async (message) => {
    try {
      const details = await chatService.getMessageDetails(message.id);
      onShowModal({
        type: 'message-details',
        message: message,
        details: details
      });
    } catch (error) {
      console.error('Error obteniendo detalles:', error);
      // Mostrar detalles básicos si falla la API
      onShowModal({
        type: 'message-details',
        message: message,
        details: {
          sql_query: message.sql_query,
          context_info: message.context_info,
          response: message.respuesta
        }
      });
    }
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-CL', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div>
          <h2 className="chat-title">
            {activeConversation ? activeConversation.titulo : 'Nueva Conversación'}
          </h2>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>
            Chatbot Defunciones Chile - {user?.username || 'Usuario'}
          </div>
        </div>
        
        <div className="chat-actions">
          <button 
            className="action-button"
            onClick={createNewConversation}
            title="Nueva conversación"
          >
            ➕ Nueva
          </button>
          
          {activeConversation && (
            <>
              <button 
                className="action-button"
                onClick={restartContext}
                title="Reiniciar contexto"
              >
                🔄 Reiniciar
              </button>
              
              <button 
                className="action-button"
                onClick={deleteConversation}
                title="Eliminar conversación"
                style={{ background: 'rgba(220, 53, 69, 0.2)' }}
              >
                🗑️ Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mensajes */}
      <div className="chat-messages">
        {error && (
          <div className="error-message" style={{ margin: '0 0 20px 0' }}>
            {error}
          </div>
        )}

        {messages.length === 0 && !isLoading && (
          <div style={{ 
            textAlign: 'center', 
            color: '#999', 
            padding: '50px 20px',
            fontSize: '16px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🤖</div>
            <div>¡Hola! Soy tu asistente para consultas sobre defunciones en Chile.</div>
            <div style={{ fontSize: '14px', marginTop: '10px' }}>
              Pregúntame sobre estadísticas, regiones, causas de muerte, etc.
            </div>
            <div style={{ fontSize: '12px', marginTop: '20px', color: '#ccc' }}>
              Ejemplos: "¿Cuántas defunciones hubo en 2025?", "Principales causas en Santiago"
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="conversation-block">
            {/* Pregunta del usuario */}
            <div className="user-message">
              <div>
                <div className="user-message-content">
                  {message.pregunta}
                </div>
                <div className="user-message-meta">
                  {formatDate(message.created_at)}
                </div>
              </div>
            </div>

            {/* Respuesta del bot */}
            {!message.isSystem && (
              <div className="bot-message">
                <div className="bot-message-wrapper">
                  <div className="bot-avatar">
                    🤖
                  </div>
                  <div>
                    <div className={`bot-message-content ${message.isLoading ? 'bot-loading' : ''} ${message.error ? 'bot-error' : ''}`}>
                      {message.isLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div>
                          Procesando tu pregunta...
                        </div>
                      ) : (
                        <>
                          {message.respuesta}
                          {message.error && (
                            <div style={{ 
                              color: '#c53030', 
                              fontSize: '12px', 
                              marginTop: '8px',
                              fontStyle: 'italic'
                            }}>
                              ⚠️ Hubo un error procesando esta pregunta
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    
                    {!message.isLoading && !message.error && message.respuesta && (
                      <div className="bot-message-meta">
                        {formatDate(message.created_at)}
                        {(message.sql_query || message.context_info) && (
                          <>
                            <span>•</span>
                            <button 
                              className="details-button"
                              onClick={() => showMessageDetails(message)}
                            >
                              Ver detalles técnicos
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mensaje del sistema */}
            {message.isSystem && (
              <div className="system-message">
                <div className="system-message-content">
                  {message.respuesta}
                </div>
              </div>
            )}
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input">
        <div className="input-container">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="message-input"
            placeholder="Escribe tu pregunta sobre defunciones en Chile..."
            disabled={isLoading}
            rows="1"
          />
          <button
            onClick={sendMessage}
            className="send-button"
            disabled={!inputMessage.trim() || isLoading}
          >
            {isLoading ? '...' : 'Enviar'}
          </button>
        </div>
        
        <div style={{ 
          fontSize: '12px', 
          color: '#999', 
          marginTop: '8px',
          textAlign: 'center'
        }}>
          Presiona Enter para enviar, Shift+Enter para nueva línea
        </div>
      </div>
    </div>
  );
};

export default Chat;