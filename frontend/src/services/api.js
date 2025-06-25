import axios from 'axios';

// Configuración base de la API
const API_BASE_URL = 'http://127.0.0.1:8000';

// Crear instancia de axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token automáticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado - limpiar y redirigir a login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ===== SERVICIOS DE AUTENTICACIÓN =====

export const authService = {
  // Registro de usuario
  register: async (userData) => {
    const response = await api.post('/register', userData);
    return response.data;
  },

  // Login
  login: async (credentials) => {
    const response = await api.post('/login', credentials);
    const { access_token, user_id } = response.data;
    
    // Guardar token y user_id
    localStorage.setItem('token', access_token);
    localStorage.setItem('user_id', user_id);
    
    return response.data;
  },

  // Logout
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
  },

  // Verificar si está autenticado
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  // Obtener user_id
  getUserId: () => {
    return localStorage.getItem('user_id');
  }
};

// ===== SERVICIOS DE CHAT =====

export const chatService = {
  // Enviar mensaje al chatbot
  sendMessage: async (message, conversationId = null) => {
    const response = await api.post('/chat', {
      message,
      conversation_id: conversationId
    });
    return response.data;
  },

  // Obtener conversaciones del usuario
  getConversations: async () => {
    const response = await api.get('/conversations');
    return response.data;
  },

  // Obtener mensajes de una conversación
  getMessages: async (conversationId) => {
    const response = await api.get(`/conversations/${conversationId}/messages`);
    return response.data;
  },

  // Eliminar conversación
  deleteConversation: async (conversationId) => {
    const response = await api.delete(`/conversations/${conversationId}`);
    return response.data;
  },

  // Reiniciar contexto de conversación
  restartConversation: async (conversationId) => {
    const response = await api.post(`/conversations/${conversationId}/restart`);
    return response.data;
  },

  // Obtener detalles de mensaje (para modales)
  getMessageDetails: async (messageId) => {
    const response = await api.get(`/chat/details/${messageId}`);
    return response.data;
  }
};

// ===== SERVICIOS DE ADMINISTRACIÓN =====

export const adminService = {
  // Términos excluidos
  getExcludedTerms: async () => {
    const response = await api.get('/admin/excluded-terms');
    return response.data;
  },

  addExcludedTerm: async (termData) => {
    const response = await api.post('/admin/excluded-terms', termData);
    return response.data;
  },

  deleteExcludedTerm: async (termId) => {
    const response = await api.delete(`/admin/excluded-terms/${termId}`);
    return response.data;
  },

  // Configuración de prompts
  getPromptConfig: async () => {
    const response = await api.get('/admin/prompt-config');
    return response.data;
  },

  updatePromptConfig: async (configData) => {
    const response = await api.post('/admin/prompt-config', configData);
    return response.data;
  }
};

// ===== SERVICIOS GENERALES =====

export const generalService = {
  // Obtener estadísticas
  getStats: async () => {
    const response = await api.get('/stats');
    return response.data;
  },

  // Obtener contexto actual
  getContext: async () => {
    const response = await api.get('/context');
    return response.data;
  },

  // Resetear contexto
  resetContext: async () => {
    const response = await api.post('/context/reset');
    return response.data;
  }
};

export default api;