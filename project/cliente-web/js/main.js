// ============================================
// js/main.js - Punto de entrada principal
// ============================================

// ⚡ IMPORTAR CSS
import '../style.css';

// Importar módulos del sistema
import { login, logout } from './auth.js';
import { openChat, loadRecentChats } from './chats.js';
import { createGroup, joinGroup, loadGroupsFromICE } from './groups.js';
import { sendMessage } from './messages.js';
import { state } from './state.js';
import { showError } from './ui.js';

// 🎙️ Importar funcionalidad de audio (notas de voz)
import { 
  toggleRecording, 
  cancelRecording,
  toggleAudioMenu
} from './audioUI.js';

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
  state
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
// ⚡ INICIAR LLAMADA (Sistema Profesor)
// ========================================
async function initiateAudioCall() {
  console.log('📞 [MAIN] Botón de llamada presionado');
  
  if (!state.currentChat) {
    showError('Selecciona un chat primero');
    return;
  }
  
  if (state.isGroup) {
    showError('Las llamadas solo están disponibles para chats privados');
    return;
  }
  
  if (state.callsAvailable === false) {
    showError('❌ Las llamadas no están disponibles - CallService no está en el servidor');
    return;
  }
  
  try {
    console.log('📞 [MAIN] Importando Player...');
    
    // Importar Player dinámicamente
    const { audioPlayer } = await import('./Player.js');
    
    console.log('📞 [MAIN] Player importado, verificando inicialización...');
    
    // ✅ VERIFICAR que Player esté inicializado
    if (!audioPlayer.init) {
      console.error('❌ [MAIN] Player no tiene método init');
      throw new Error('Player no inicializado correctamente');
    }
    
    console.log('📞 [MAIN] Iniciando llamada a:', state.currentChat);
    
    // Iniciar llamada
    await audioPlayer.startCall(state.currentChat);
    
    console.log('✅ [MAIN] Llamada iniciada');
    
  } catch (error) {
    console.error('❌ [MAIN] Error iniciando llamada:', error);
    console.error('Stack:', error.stack);
    showError('Error al iniciar llamada: ' + error.message);
  }
}

// ========================================
// EVENT LISTENERS
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 [MAIN] Aplicación inicializada');
  
  // ✅ Esperar a que Ice.js esté disponible
  if (window._iceLoadPromise) {
    try {
      await window._iceLoadPromise;
      console.log('✅ [MAIN] Ice.js disponible');
    } catch (error) {
      console.error('❌ [MAIN] Error cargando Ice.js:', error);
      alert('Error: No se pudo cargar Ice.js. Por favor recarga la página.');
      return;
    }
  }
  
  // ========================================
  // 📞 BOTÓN DE LLAMADAS
  // ========================================
  const callButton = document.getElementById('callButton');

  if (callButton) {
    console.log('✅ [MAIN] Botón de llamadas encontrado');
    callButton.addEventListener('click', () => {
      console.log('🔘 [MAIN] Click en botón de llamada');
      initiateAudioCall();
    });
  } else {
    console.warn('⚠️ [MAIN] Botón de llamadas NO encontrado en el DOM');
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
  // 🎤 NOTAS DE VOZ
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
  
  console.log('✅ [MAIN] Todos los event listeners registrados');
});