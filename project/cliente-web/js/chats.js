import { state } from './state.js';
import { showError, updateChatHeader, showMessageInput } from './ui.js';
import { loadHistory } from './messages.js';
import { startPolling } from './polling.js';

export function loadRecentChats() {
  const list = document.getElementById('chatsList');
  
  if (state.recentChats.length === 0) {
    list.innerHTML = '<p class="empty-state">No hay conversaciones aún</p>';
    return;
  }
  
  list.innerHTML = '';
  state.recentChats.forEach(chatUser => {
    const div = document.createElement('div');
    div.className = 'conversation-item';
    if (state.currentChat === chatUser && !state.isGroup) {
      div.classList.add('active');
    }
    div.innerHTML = `<span>💬</span><strong>${chatUser}</strong>`;
    div.onclick = () => openChatFromList(chatUser);
    list.appendChild(div);
  });
}

export function openChat() {
  const user = document.getElementById('newChatUser').value.trim();
  
  if (!user) {
    showError('Ingresa un nombre de usuario');
    return;
  }
  
  if (user === state.currentUsername) {
    showError('No puedes chatear contigo mismo');
    return;
  }
  
  document.getElementById('newChatUser').value = '';
  openChatFromList(user);
}

export function openChatFromList(user) {
  if (!state.recentChats.includes(user)) {
    state.recentChats.unshift(user);
    loadRecentChats();
  }
  
  state.currentChat = user;
  state.isGroup = false;
  
  updateChatHeader(`💬 Chat con ${user}`, 'Conversación privada');
  showMessageInput();
  loadHistory(user, false, true);
  startPolling();
}