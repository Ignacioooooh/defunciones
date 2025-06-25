import React, { useState, useEffect } from 'react';
import './App.css';
import { authService } from './services/api';
import Login from './components/Login';
import Chat from './components/Chat';
import Sidebar from './components/Sidebar';
import AdminPanel from './components/AdminPanel';
import Modal from './components/Modal';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('chat');
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [modal, setModal] = useState({ show: false, data: null });
  const [loading, setLoading] = useState(true);

  // Verificar autenticación al cargar
  useEffect(() => {
    const checkAuth = () => {
      const isAuth = authService.isAuthenticated();
      const userId = authService.getUserId();
      
      if (isAuth && userId) {
        setIsAuthenticated(true);
        setUser({ id: userId });
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Manejar login exitoso
  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  // Manejar logout
  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setConversations([]);
    setActiveConversation(null);
    setCurrentView('chat');
  };

  // Cambiar vista
  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  // Mostrar modal
  const showModal = (data) => {
    setModal({ show: true, data });
  };

  // Cerrar modal
  const closeModal = () => {
    setModal({ show: false, data: null });
  };

  // Pantalla de carga
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Cargando Chatbot Defunciones Chile...</p>
      </div>
    );
  }

  // Pantalla de login
  if (!isAuthenticated) {
    return (
      <div className="app">
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  // Aplicación principal
  return (
    <div className="app">
      <div className="app-container">
        {/* Sidebar */}
        <Sidebar
          conversations={conversations}
          activeConversation={activeConversation}
          onConversationSelect={setActiveConversation}
          onViewChange={handleViewChange}
          currentView={currentView}
          onLogout={handleLogout}
          user={user}
        />

        {/* Contenido principal */}
        <div className="main-content">
          {currentView === 'chat' && (
            <Chat
              activeConversation={activeConversation}
              onConversationUpdate={setActiveConversation}
              onConversationsUpdate={setConversations}
              onShowModal={showModal}
              user={user}
            />
          )}

          {currentView === 'admin' && (
            <AdminPanel user={user} />
          )}
        </div>
      </div>

      {/* Modal */}
      {modal.show && (
        <Modal
          data={modal.data}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

export default App;