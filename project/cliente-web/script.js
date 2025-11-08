// script.js OPTIMIZADO - Polling inteligente

const API_URL = "http://localhost:5000";

// Estado de la aplicación
let currentUsername = null;
let currentChat = null;
let isGroup = false;
let recentChats = [];
let myGroups = [];
let historyInterval = null;
let lastHistoryContent = ''; // Para detectar cambios

// ==================== LOGIN ====================

async function login() {
  const username = document.getElementById('usernameInput').value.trim();
  
  if (!username) {
    showError('Por favor ingresa un nombre de usuario');
    return;
  }

  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = 'Conectando...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });

    const data = await res.json();

    if (data.success) {
      currentUsername = username;
      showChatInterface();
      console.log('✓ Login exitoso:', username);
    } else {
      showError(data.error || 'Error al conectar');
    }
  } catch (err) {
    console.error('Error en login:', err);
    showError('No se pudo conectar al servidor. Verifica que el proxy esté iniciado.');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function showChatInterface() {
  document.getElementById('currentUsername').textContent = currentUsername;
  document.getElementById('loginContainer').classList.add('hidden');
  document.getElementById('chatContainer').classList.remove('hidden');
  
  loadRecentChats();
  loadGroups();
}

function logout() {
  stopHistoryPolling(); // IMPORTANTE: Detener polling
  
  currentUsername = null;
  currentChat = null;
  isGroup = false;
  recentChats = [];
  myGroups = [];
  lastHistoryContent = '';
  
  document.getElementById('loginContainer').classList.remove('hidden');
  document.getElementById('chatContainer').classList.add('hidden');
  document.getElementById('usernameInput').value = '';
  
  resetMainContent();
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = '⚠️ ' + message;
  
  const container = document.querySelector('.login-container .section') || 
                   document.querySelector('.chat-container');
  
  const oldError = container.querySelector('.error-message');
  if (oldError) oldError.remove();
  
  container.appendChild(errorDiv);
  
  setTimeout(() => errorDiv.remove(), 5000);
}

// ==================== TABS ====================

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
    loadGroups();
  }
}

// ==================== CHATS ====================

function loadRecentChats() {
  const list = document.getElementById('chatsList');
  
  if (recentChats.length === 0) {
    list.innerHTML = '<p class="empty-state">No hay conversaciones aún</p>';
    return;
  }
  
  list.innerHTML = '';
  recentChats.forEach(chatUser => {
    const div = document.createElement('div');
    div.className = 'conversation-item';
    if (currentChat === chatUser && !isGroup) {
      div.classList.add('active');
    }
    div.innerHTML = `<span>💬</span><strong>${chatUser}</strong>`;
    div.onclick = () => openChatFromList(chatUser);
    list.appendChild(div);
  });
}

function openChat() {
  const user = document.getElementById('newChatUser').value.trim();
  
  if (!user) {
    showError('Ingresa un nombre de usuario');
    return;
  }
  
  if (user === currentUsername) {
    showError('No puedes chatear contigo mismo');
    return;
  }
  
  document.getElementById('newChatUser').value = '';
  openChatFromList(user);
}

function openChatFromList(user) {
  if (!recentChats.includes(user)) {
    recentChats.unshift(user);
    loadRecentChats();
  }
  
  currentChat = user;
  isGroup = false;
  
  updateChatHeader(`💬 Chat con ${user}`, 'Conversación privada');
  showMessageInput();
  loadHistory(user, false, true); // true = carga inicial
  
  // INICIAR polling SOLO si hay un chat abierto
  startHistoryPolling();
}

// ==================== GRUPOS ====================

async function createGroup() {
  const groupName = document.getElementById('newGroupName').value.trim();
  
  if (!groupName) {
    showError('Ingresa un nombre para el grupo');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/grupos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        nombre: groupName,
        creator: currentUsername 
      })
    });

    const data = await res.json();
    
    if (data.success) {
      alert('✓ Grupo creado: ' + groupName);
      document.getElementById('newGroupName').value = '';
      
      if (!myGroups.includes(groupName)) {
        myGroups.push(groupName);
      }
      
      loadGroups();
      openGroupChat(groupName);
    } else {
      showError(data.error || 'Error al crear grupo');
    }
  } catch (err) {
    console.error('Error creando grupo:', err);
    showError('Error de conexión');
  }
}

async function joinGroup() {
  const groupName = document.getElementById('joinGroupName').value.trim();
  
  if (!groupName) {
    showError('Ingresa el nombre del grupo');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/grupos/unirse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        grupo: groupName,
        username: currentUsername 
      })
    });

    const data = await res.json();
    
    if (data.success) {
      alert('✓ Te uniste al grupo: ' + groupName);
      document.getElementById('joinGroupName').value = '';
      
      if (!myGroups.includes(groupName)) {
        myGroups.push(groupName);
      }
      
      loadGroups();
      openGroupChat(groupName);
    } else {
      showError(data.error || 'Error al unirse al grupo');
    }
  } catch (err) {
    console.error('Error uniéndose al grupo:', err);
    showError('Error de conexión');
  }
}

async function loadGroups() {
  try {
    const res = await fetch(`${API_URL}/grupos?username=${currentUsername}`);
    const data = await res.json();
    
    const list = document.getElementById('groupsList');
    
    if (!data.success || !data.grupos) {
      list.innerHTML = '<p class="empty-state">No estás en ningún grupo</p>';
      return;
    }
    
    myGroups = [];
    list.innerHTML = '';
    
    if (data.grupos.includes('Grupos disponibles:')) {
      const lines = data.grupos.split('\n').slice(1);
      lines.forEach(line => {
        const match = line.match(/- (.+?) \(/);
        if (match) {
          const groupName = match[1].trim();
          myGroups.push(groupName);
          
          const div = document.createElement('div');
          div.className = 'conversation-item';
          if (currentChat === groupName && isGroup) {
            div.classList.add('active');
          }
          div.innerHTML = `<span>👥</span><strong>${groupName}</strong>`;
          div.onclick = () => openGroupChat(groupName);
          list.appendChild(div);
        }
      });
    }
    
    if (myGroups.length === 0) {
      list.innerHTML = '<p class="empty-state">No estás en ningún grupo</p>';
    }
  } catch (err) {
    console.error('Error cargando grupos:', err);
  }
}

function openGroupChat(groupName) {
  currentChat = groupName;
  isGroup = true;
  
  updateChatHeader(`👥 Grupo: ${groupName}`, 'Chat grupal');
  showMessageInput();
  loadHistory(groupName, true, true); // true = carga inicial
  
  loadGroups();
  
  // INICIAR polling
  startHistoryPolling();
}

// ==================== MENSAJES ====================

async function loadHistory(target, isGrupo, showLoading = true) {
  const container = document.getElementById('messagesContainer');
  
  if (showLoading) {
    container.innerHTML = '<p style="text-align: center; color: #999;">Cargando historial...</p>';
  }

  try {
    const url = isGrupo 
      ? `${API_URL}/historial-grupo/${target}?username=${currentUsername}`
      : `${API_URL}/historial/${target}?from=${currentUsername}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.success && data.historial) {
      // COMPARAR con último contenido para evitar re-renderizado innecesario
      if (data.historial === lastHistoryContent && !showLoading) {
        return; // Sin cambios, no hacer nada
      }
      
      lastHistoryContent = data.historial;
      
      if (data.historial.includes('No hay historial')) {
        container.innerHTML = `
          <div class="welcome-message">
            <h3>📭 Sin mensajes</h3>
            <p>Sé el primero en enviar un mensaje</p>
          </div>
        `;
      } else {
        const wasAtBottom = container.scrollHeight - container.scrollTop === container.clientHeight;
        
        container.innerHTML = `
          <div class="message-history">
            <pre>${data.historial}</pre>
          </div>
        `;
        
        if (wasAtBottom || showLoading) {
          container.scrollTop = container.scrollHeight;
        }
      }
    } else {
      container.innerHTML = '<p style="text-align: center; color: #999;">No hay mensajes aún</p>';
    }
  } catch (err) {
    console.error('Error cargando historial:', err);
    if (showLoading) {
      container.innerHTML = '<p style="text-align: center; color: red;">Error cargando historial</p>';
    }
  }
}

async function sendMessage() {
  const message = document.getElementById('messageText').value.trim();
  
  if (!message) {
    return;
  }
  
  if (!currentChat) {
    showError('Selecciona un chat primero');
    return;
  }

  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = 'Enviando...';
  btn.disabled = true;

  try {
    const url = isGroup ? `${API_URL}/enviar-grupo` : `${API_URL}/enviar`;
    const body = isGroup 
      ? { from: currentUsername, grupo: currentChat, message }
      : { from: currentUsername, to: currentChat, message };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    
    if (data.success) {
      document.getElementById('messageText').value = '';
      
      // Actualizar inmediatamente + resetear cache
      lastHistoryContent = '';
      await loadHistory(currentChat, isGroup, false);
    } else {
      showError(data.error || 'Error al enviar mensaje');
    }
  } catch (err) {
    console.error('Error enviando mensaje:', err);
    showError('Error de conexión');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
    document.getElementById('messageText').focus();
  }
}

// ==================== POLLING OPTIMIZADO ====================

function startHistoryPolling() {
  stopHistoryPolling(); // Limpiar anterior
  
  // Polling cada 5 segundos (era 3, ahora es menos frecuente)
  historyInterval = setInterval(() => {
    if (currentChat && document.visibilityState === 'visible') {
      loadHistory(currentChat, isGroup, false);
    }
  }, 5000); // CAMBIO: 5 segundos en vez de 3
}

function stopHistoryPolling() {
  if (historyInterval) {
    clearInterval(historyInterval);
    historyInterval = null;
    console.log('[INFO] Polling detenido');
  }
}

// Pausar polling cuando el tab no está visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    stopHistoryPolling();
  } else if (currentChat) {
    startHistoryPolling();
  }
});

// ==================== UI HELPERS ====================

function updateChatHeader(title, subtitle) {
  const header = document.getElementById('chatHeader');
  header.innerHTML = `
    <div class="chat-info">
      <h2>${title}</h2>
      <p>${subtitle}</p>
    </div>
  `;
}

function showMessageInput() {
  const container = document.getElementById('messageInputContainer');
  container.classList.remove('hidden');
}

function resetMainContent() {
  stopHistoryPolling(); // IMPORTANTE
  
  updateChatHeader('Bienvenido 👋', 'Selecciona un chat o crea uno nuevo');
  document.getElementById('messageInputContainer').classList.add('hidden');
  document.getElementById('messagesContainer').innerHTML = `
    <div class="welcome-message">
      <h3>🎉 Comienza a chatear</h3>
      <p>Selecciona una conversación del sidebar o inicia una nueva</p>
      <ul>
        <li>Abre un chat con otro usuario</li>
        <li>Crea o únete a grupos</li>
        <li>Envía mensajes y consulta el historial</li>
      </ul>
    </div>
  `;
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('usernameInput');
  if (usernameInput) {
    usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') login();
    });
    usernameInput.focus();
  }

  const messageInput = document.getElementById('messageText');
  if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
});