// ============================================
// js/main.js - Punto de entrada principal CORREGIDO
// ============================================

// ⚡ IMPORTAR CSS
import '../style.css';

// Importar módulos del sistema
import { login, logout } from './auth.js';
import { openChat, loadRecentChats } from './chats.js';
import { createGroup, joinGroup, loadGroupsFromICE } from './groups.js';
import { sendMessage } from './messages.js';
import { stopPolling } from './polling.js';
import { state, resetState } from './state.js';
import { showLoginInterface, resetMainContent, showError } from './ui.js';

// 🎙️ Importar funcionalidad de audio
import { 
  toggleRecording, 
  cancelRecording,
  toggleAudioMenu,
  showAudioControls,
  hideAudioControls
} from './audioUI.js';

// ✅ CORREGIDO: Importar initiateCall desde callUI
import { initiateCall, hideCallUI } from './callUI.js';

// ========================================
// FUNCIONES GLOBALES (para debugging)
// ========================================
window._debug = {
  login,
  logout,
  openChat,
  createGroup,
  joinGroup,
  sendMessage,
  toggleRecording,
  cancelRecording,
  initiateCall  // ✅ Agregar a globales para debugging
};

// ========================================
// CAMBIO DE TABS
// ========================================
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  
  if (tab === 'chats') {
    document.querySelectorAll('.tab')[0].classList.add('active');
    document.getElementById('chatsTab').classList.add('active');
    loadRecentChats();
  } else {
    document.querySelectorAll('.tab')[1].classList.add('active');
    document.getElementById('gruposTab').classList.add('active');
    loadGroupsFromICE();
  }
}

// ========================================
// MENÚ DE LLAMADAS (SOLO AUDIO)
// ========================================
function showCallOptionsMenu() {
  // ⚠️ Validar que CallService esté disponible
  if (state.callsAvailable === false) {
    showError('❌ Las llamadas no están disponibles - CallService no está en el servidor');
    return;
  }
  
  // Remover menú existente si hay
  const existingMenu = document.querySelector('.call-options-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  const options = document.createElement('div');
  options.className = 'call-options-menu';
  options.innerHTML = `
    <button class="call-option" id="audioCallBtn">
      📞 Llamada de audio
    </button>
  `;
  
  document.body.appendChild(options);
  
  // ✅ CORREGIDO: Usar initiateCall que ya está importado
  document.getElementById('audioCallBtn').onclick = async () => {
    options.remove();
    try {
      console.log('🎯 [MAIN] Iniciando llamada a:', state.currentChat);
      await initiateCall(state.currentChat);
    } catch (error) {
      console.error('❌ Error iniciando llamada:', error);
      showError('Error al iniciar llamada: ' + error.message);
    }
  };
  
  // Cerrar al hacer clic fuera
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!options.contains(e.target) && e.target.id !== 'callButton') {
        options.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 100);
}

// ========================================
// EVENT LISTENERS
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Aplicación de chat inicializada');
  
  // ✅ Esperar a que Ice.js esté disponible
  if (window._iceLoadPromise) {
    try {
      await window._iceLoadPromise;
      console.log('✅ Ice.js disponible, continuando inicialización...');
    } catch (error) {
      console.error('❌ Error cargando Ice.js:', error);
      alert('Error: No se pudo cargar Ice.js. Por favor recarga la página.');
      return;
    }
  }
  
  // ========================================
  // LLAMADAS
  // ========================================
  const callButton = document.getElementById('callButton');

  if (callButton) {
    callButton.addEventListener('click', () => {
      console.log('📱 [MAIN] Click en botón de llamada');
      
      if (!state.currentChat) {
        showError('Selecciona un chat primero');
        return;
      }
      
      if (state.isGroup) {
        showError('Las llamadas solo están disponibles para chats privados');
        return;
      }
      
      // ✅ Mostrar opciones de llamada
      showCallOptionsMenu();
    });
  }

  // ========================================
  // PANTALLA DE LOGIN
  // ========================================
  const usernameInput = document.getElementById('usernameInput');
  const loginButton = document.getElementById('loginButton');
  
  if (usernameInput && loginButton) {
    // Login con Enter
    usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        login();
      }
    });
    
    // Login con botón
    loginButton.addEventListener('click', () => {
      login();
    });
    
    usernameInput.focus();
  }
  
  // ========================================
  // LOGOUT
  // ========================================
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      logout();
    });
  }
  
  // ========================================
  // TABS
  // ========================================
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = e.target.getAttribute('data-tab');
      if (tabName) {
        switchTab(tabName);
      }
    });
  });
  
  // ========================================
  // CHATS
  // ========================================
  const openChatButton = document.getElementById('openChatButton');
  const newChatUser = document.getElementById('newChatUser');
  
  if (openChatButton) {
    openChatButton.addEventListener('click', () => {
      openChat();
    });
  }
  
  if (newChatUser) {
    newChatUser.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        openChat();
      }
    });
  }
  
  // ========================================
  // GRUPOS
  // ========================================
  const createGroupButton = document.getElementById('createGroupButton');
  const newGroupName = document.getElementById('newGroupName');
  
  if (createGroupButton) {
    createGroupButton.addEventListener('click', () => {
      createGroup();
    });
  }
  
  if (newGroupName) {
    newGroupName.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        createGroup();
      }
    });
  }
  
  const joinGroupButton = document.getElementById('joinGroupButton');
  const joinGroupName = document.getElementById('joinGroupName');
  
  if (joinGroupButton) {
    joinGroupButton.addEventListener('click', () => {
      joinGroup();
    });
  }
  
  if (joinGroupName) {
    joinGroupName.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        joinGroup();
      }
    });
  }
  
  // ========================================
  // MENSAJES
  // ========================================
  const messageInput = document.getElementById('messageText');
  const sendMessageButton = document.getElementById('sendMessageButton');
  
  if (messageInput) {
    // Enviar mensaje con Enter (sin Shift)
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  if (sendMessageButton) {
    sendMessageButton.addEventListener('click', () => {
      sendMessage();
    });
  }
  
  // ========================================
  // AUDIO (NOTAS DE VOZ)
  // ========================================
  const recordButton = document.getElementById('recordButton');
  const cancelButton = document.getElementById('cancelButton');
  const toggleAudioButton = document.getElementById('toggleAudioButton');
  
  if (recordButton) {
    recordButton.addEventListener('click', () => {
      toggleRecording();
    });
  }
  
  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      cancelRecording();
    });
  }
  
  if (toggleAudioButton) {
    toggleAudioButton.addEventListener('click', () => {
      toggleAudioMenu();
    });
  }
  
  console.log('✅ Event listeners registrados');
});

// ✅ Exportar para uso global si es necesario
window.initiateCall = initiateCall;
window.hideCallUI = hideCallUI;