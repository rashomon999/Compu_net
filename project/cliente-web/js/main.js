import { login } from './auth.js';
import { openChat } from './chats.js';
import { createGroup, joinGroup } from './groups.js';
import { sendMessage } from './messages.js';
import { stopPolling } from './polling.js';
import { state, resetState } from './state.js';
import { showLoginInterface, resetMainContent } from './ui.js';

// Funciones globales para HTML
window.login = login;
window.openChat = openChat;
window.createGroup = createGroup;
window.joinGroup = joinGroup;
window.sendMessage = sendMessage;
window.switchTab = switchTab;
window.logout = logout;

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  
  if (tab === 'chats') {
    document.querySelectorAll('.tab')[0].classList.add('active');
    document.getElementById('chatsTab').classList.add('active');
    import('./chats.js').then(m => m.loadRecentChats());
  } else {
    document.querySelectorAll('.tab')[1].classList.add('active');
    document.getElementById('gruposTab').classList.add('active');
    import('./groups.js').then(m => m.loadGroups());
  }
}

function logout() {
  stopPolling();
  resetState();
  showLoginInterface();
  document.getElementById('usernameInput').value = '';
  resetMainContent();
}

// Event listeners
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