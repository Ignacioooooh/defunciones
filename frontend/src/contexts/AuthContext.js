import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

// Crear el contexto
const AuthContext = createContext();

// Hook personalizado para usar el contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

// Proveedor del contexto de autenticación
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verificar autenticación al cargar
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Verificar estado de autenticación
  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('user_id');
      
      if (token && userId) {
        // Verificar si el token sigue siendo válido
        // Esto se hace automáticamente por el interceptor de axios
        setUser({ 
          id: userId,
          username: localStorage.getItem('username') || 'Usuario'
        });
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      setUser(null);
      setIsAuthenticated(false);
      // Limpiar tokens inválidos
      localStorage.removeItem('token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('username');
    } finally {
      setLoading(false);
    }
  };

  // Login
  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authService.login(credentials);
      const { access_token, user_id } = response;
      
      // Guardar en localStorage
      localStorage.setItem('token', access_token);
      localStorage.setItem('user_id', user_id);
      localStorage.setItem('username', credentials.username);
      
      // Actualizar estado
      setUser({
        id: user_id,
        username: credentials.username
      });
      setIsAuthenticated(true);
      
      return response;
    } catch (error) {
      setError(error.response?.data?.detail || 'Error de autenticación');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Registro
  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authService.register(userData);
      return response;
    } catch (error) {
      setError(error.response?.data?.detail || 'Error en el registro');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = () => {
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    
    // Actualizar estado
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
    
    // Llamar al servicio de logout
    authService.logout();
  };

  // Limpiar errores
  const clearError = () => {
    setError(null);
  };

  // Actualizar información del usuario
  const updateUser = (userData) => {
    setUser(prevUser => ({
      ...prevUser,
      ...userData
    }));
    
    // Actualizar username en localStorage si cambió
    if (userData.username) {
      localStorage.setItem('username', userData.username);
    }
  };

  // Verificar si es administrador
  const isAdmin = () => {
    return user?.username === 'admin' || user?.role === 'admin';
  };

  // Valor del contexto
  const value = {
    // Estado
    user,
    isAuthenticated,
    loading,
    error,
    
    // Funciones
    login,
    register,
    logout,
    clearError,
    updateUser,
    checkAuthStatus,
    isAdmin,
    
    // Utilidades
    getUserId: () => user?.id,
    getUsername: () => user?.username,
    getToken: () => localStorage.getItem('token')
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Componente de protección de rutas
export const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '5px solid rgba(255, 255, 255, 0.3)',
            borderTop: '5px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          Verificando autenticación...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        textAlign: 'center'
      }}>
        <div>
          <h2>Acceso Restringido</h2>
          <p>Debes iniciar sesión para acceder a esta página</p>
        </div>
      </div>
    );
  }

  if (adminOnly && !user?.username === 'admin') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        textAlign: 'center'
      }}>
        <div>
          <h2>Acceso de Administrador Requerido</h2>
          <p>Solo los administradores pueden acceder a esta sección</p>
        </div>
      </div>
    );
  }

  return children;
};

// Hook para persistir estado entre recargas
export const usePersistentAuth = () => {
  const { isAuthenticated, user, checkAuthStatus } = useAuth();
  
  useEffect(() => {
    // Verificar autenticación al cargar la página
    checkAuthStatus();
    
    // Escuchar cambios en localStorage (para multiple tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'user_id') {
        checkAuthStatus();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [checkAuthStatus]);

  return { isAuthenticated, user };
};

export default AuthContext;