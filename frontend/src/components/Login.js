import React, { useState } from 'react';
import { authService } from '../services/api';

const Login = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setSuccess('');
  };

  // Manejar submit del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isLogin) {
        // Login
        const response = await authService.login({
          username: formData.username,
          password: formData.password
        });
        
        onLogin({
          id: response.user_id,
          username: formData.username
        });
      } else {
        // Registro
        if (!formData.email) {
          setError('El email es requerido');
          setLoading(false);
          return;
        }

        await authService.register({
          username: formData.username,
          email: formData.email,
          password: formData.password
        });

        setSuccess('Usuario registrado exitosamente. Ahora puedes hacer login.');
        setIsLogin(true);
        setFormData({ username: '', email: '', password: '' });
      }
    } catch (error) {
      console.error('Error de autenticación:', error);
      
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else if (error.response?.status === 401) {
        setError('Usuario o contraseña incorrectos');
      } else if (error.response?.status === 400) {
        setError('El usuario ya existe');
      } else {
        setError('Error de conexión. Verifica que el servidor esté funcionando.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Alternar entre login y registro
  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({ username: '', email: '', password: '' });
    setError('');
    setSuccess('');
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h1 className="login-title">
          {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
        </h1>
        
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          Chatbot Defunciones Chile
        </p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Usuario</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="form-input"
              required
              placeholder="Ingresa tu usuario"
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                required
                placeholder="Ingresa tu email"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="form-input"
              required
              placeholder="Ingresa tu contraseña"
            />
          </div>

          <button
            type="submit"
            className="form-button"
            disabled={loading}
          >
            {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
          </button>

          <div className="form-toggle">
            {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button type="button" onClick={toggleMode}>
              {isLogin ? 'Regístrate aquí' : 'Inicia sesión aquí'}
            </button>
          </div>
        </form>

        {/* Información de demo */}
        <div style={{
          marginTop: '30px',
          padding: '15px',
          background: '#e7f3ff',
          borderRadius: '8px',
          fontSize: '13px'
        }}>
          <strong>💡 Usuario de prueba:</strong><br />
          Usuario: <code>admin</code><br />
          Contraseña: <code>admin123</code>
        </div>
      </div>
    </div>
  );
};

export default Login;