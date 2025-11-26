// ============================================
// js/main.js - Punto de entrada COMPLETO
// ============================================

console.log('📦 main.js cargando...');

// ⚡ IMPORTAR CSS
import '../style.css';

// ========================================
// PASO 1: Esperar a que Ice.js esté disponible
// ========================================
function waitForIce(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkIce = () => {
      if (typeof window.Ice !== 'undefined') {
        console.log('✅ Ice.js disponible, continuando inicialización...');
        resolve(window.Ice);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout esperando Ice.js'));
      } else {
        setTimeout(checkIce, 50);
      }
    };
    
    checkIce();
  });
}

// ========================================
// PASO 2: Inicializar módulos Ice
// ========================================
// En main.js, en la función initializeIceModules():

async function initializeIceModules() {
  try {
    const Ice = await waitForIce();
    
    console.log('🔧 Inicializando módulos Ice...');
    
    // Importar e inicializar ChatSystem
    const { default: initChatSystem } = await import('./generated/ChatSystem.js');
    if (typeof initChatSystem === 'function') {
      initChatSystem();
      console.log('✅ ChatSystem inicializado');
    }
    
    // ⬅️ AGREGAR ESTO SI NO LO TIENES:
    // Importar e inicializar AudioSystem
    const { default: initAudioSystem } = await import('./generated/AudioSubject.js');
    if (typeof initAudioSystem === 'function') {
      initAudioSystem();
      console.log('✅ AudioSystem inicializado');
    }
    
    // Verificar que se cargaron correctamente
    if (!Ice.ChatSystem) {
      throw new Error('ChatSystem no se inicializó correctamente');
    }
    
    if (!Ice.AudioSystem) {
      throw new Error('AudioSystem no se inicializó correctamente');
    }
    
    console.log('✅ Todos los módulos Ice inicializados correctamente');
    console.log('   - ChatSystem:', Object.keys(Ice.ChatSystem).length, 'elementos');
    console.log('   - AudioSystem:', Object.keys(Ice.AudioSystem).length, 'elementos');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error inicializando módulos Ice:', error);
    throw error;
  }
}

// ========================================
// PASO 3: Importar módulos de la aplicación
// ========================================
let appModules = null;

async function loadAppModules() {
  if (appModules) return appModules; // Ya cargados
  
  appModules = {
    auth: await import('./auth.js'),
    chats: await import('./chats.js'),
    groups: await import('./groups.js'),
    messages: await import('./messages.js'),
    ui: await import('./ui.js'),
    state: await import('./state.js'),
    audioUI: await import('./audioUI.js'),
    callUI: await import('./callUI.js')
  };
  
  return appModules;
}

// ========================================
// FUNCIONES DE LA APLICACIÓN
// ========================================
async function switchTab(tab) {
  const { loadRecentChats } = await import('./chats.js');
  const { loadGroupsFromICE } = await import('./groups.js');
  
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

async function showCallOptionsMenu() {
  const { state } = await import('./state.js');
  const { showError } = await import('./ui.js');
  const { initiateCall } = await import('./callUI.js');
  
  if (state.callsAvailable === false) {
    showError('❌ Las llamadas no están disponibles en el servidor');
    return;
  }
  
  if (!state.currentChat) {
    showError('⚠️ Selecciona un chat primero');
    return;
  }
  
  if (state.isGroup) {
    showError('⚠️ Las llamadas solo están disponibles para chats privados');
    return;
  }
  
  // Remover menú existente
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
// PASO 4: Configurar event listeners
// ========================================
async function setupEventListeners() {
  console.log('🎨 Configurando event listeners...');
  
  const modules = await loadAppModules();
  const { login, logout } = modules.auth;
  const { openChat } = modules.chats;
  const { createGroup, joinGroup } = modules.groups;
  const { sendMessage } = modules.messages;
  const { toggleRecording, cancelRecording, toggleAudioMenu } = modules.audioUI;
  
  // ========================================
  // LOGIN
  // ========================================
  const usernameInput = document.getElementById('usernameInput');
  const loginButton = document.getElementById('loginButton');
  
  if (usernameInput && loginButton) {
    usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        login();
      }
    });
    
    loginButton.addEventListener('click', () => {
      login();
    });
    
    usernameInput.focus();
    console.log('  ✅ Login listeners');
  }
  
  // ========================================
  // LOGOUT
  // ========================================
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      logout();
    });
    console.log('  ✅ Logout listener');
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
  console.log('  ✅ Tabs listeners');
  
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
  console.log('  ✅ Chats listeners');
  
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
  console.log('  ✅ Grupos listeners');
  
  // ========================================
  // MENSAJES
  // ========================================
  const messageInput = document.getElementById('messageText');
  const sendMessageButton = document.getElementById('sendMessageButton');
  
  if (messageInput) {
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
  console.log('  ✅ Mensajes listeners');
  
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
  console.log('  ✅ Audio listeners');
  
  // ========================================
  // LLAMADAS
  // ========================================
  const callButton = document.getElementById('callButton');
  
  if (callButton) {
    callButton.addEventListener('click', () => {
      console.log('📱 [MAIN] Click en botón de llamada');
      showCallOptionsMenu();
    });
    console.log('  ✅ Llamadas listeners');
  }
  
  console.log('✅ Event listeners registrados');
}

// ========================================
// PASO 5: Inicializar aplicación completa
// ========================================
async function initializeApp() {
  try {
    // 1. Inicializar módulos Ice
    await initializeIceModules();
    
    // 2. Configurar event listeners
    await setupEventListeners();
    
    console.log('✅ Aplicación lista');
    
    // 3. Exponer funciones para debugging
    const modules = await loadAppModules();
    window._debug = {
      login: modules.auth.login,
      logout: modules.auth.logout,
      openChat: modules.chats.openChat,
      createGroup: modules.groups.createGroup,
      joinGroup: modules.groups.joinGroup,
      sendMessage: modules.messages.sendMessage,
      initiateCall: modules.callUI.initiateCall
    };
    
  } catch (error) {
    console.error('❌ Error inicializando aplicación:', error);
    alert('Error al inicializar la aplicación. Revisa la consola para más detalles.');
  }
}

// ========================================
// PASO 6: Ejecutar cuando el DOM esté listo
// ========================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// ========================================
// Utilidades globales
// ========================================
window.updateConnectionStatus = (status) => {
  const statusEl = document.getElementById('connectionStatus');
  if (!statusEl) return;
  
  statusEl.classList.remove('hidden', 'connecting', 'connected', 'disconnected', 'error');
  
  const icon = statusEl.querySelector('.status-icon');
  const text = statusEl.querySelector('.status-text');
  
  switch (status) {
    case 'connecting':
      statusEl.classList.add('connecting');
      if (icon) icon.textContent = '🔄';
      if (text) text.textContent = 'Conectando...';
      break;
      
    case 'connected':
      statusEl.classList.add('connected');
      if (icon) icon.textContent = '✅';
      if (text) text.textContent = 'Conectado';
      setTimeout(() => statusEl.classList.add('hidden'), 2000);
      break;
      
    case 'disconnected':
      statusEl.classList.add('disconnected');
      if (icon) icon.textContent = '⚠️';
      if (text) text.textContent = 'Desconectado';
      break;
      
    case 'error':
      statusEl.classList.add('error');
      if (icon) icon.textContent = '❌';
      if (text) text.textContent = 'Error de conexión';
      break;
  }
};

console.log('✅ main.js cargado, esperando DOM...');