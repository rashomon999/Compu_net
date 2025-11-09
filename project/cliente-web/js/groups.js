// ============================================
// js/groups.js - Gestión de grupos MEJORADO
// ============================================

import { API_URL } from './config.js';
import { state } from './state.js';
import { showError, updateChatHeader, showMessageInput } from './ui.js';
import { loadHistory } from './messages.js';
import { startPolling } from './polling.js';

export async function createGroup() {
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
        creator: state.currentUsername 
      })
    });

    const data = await res.json();
    
    if (data.success) {
      alert('✓ Grupo creado: ' + groupName);
      document.getElementById('newGroupName').value = '';
      
      if (!state.myGroups.includes(groupName)) {
        state.myGroups.push(groupName);
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

export async function joinGroup() {
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
        username: state.currentUsername 
      })
    });

    const data = await res.json();
    
    if (data.success) {
      alert('✓ Te uniste al grupo: ' + groupName);
      document.getElementById('joinGroupName').value = '';
      
      if (!state.myGroups.includes(groupName)) {
        state.myGroups.push(groupName);
      }
      
      loadGroups();
      openGroupChat(groupName);
    } else {
      showError(data.error || 'Error al unirse');
    }
  } catch (err) {
    console.error('Error uniéndose:', err);
    showError('Error de conexión');
  }
}

export async function loadGroups() {
  try {
    const res = await fetch(`${API_URL}/grupos?username=${state.currentUsername}`);
    const data = await res.json();
    
    // 🔍 DEBUG: Ver qué está devolviendo el servidor
    console.log('📦 Respuesta de grupos:', data);
    
    const list = document.getElementById('groupsList');
    
    // Verificar si hay error en la respuesta
    if (!data.success) {
      console.warn('⚠️ Error en respuesta:', data.error);
      list.innerHTML = '<p class="empty-state">No estás en ningún grupo</p>';
      return;
    }
    
    // 🆕 Manejar diferentes formatos de respuesta
    let groups = [];
    
    // Formato 1: Array de grupos
    if (Array.isArray(data.grupos)) {
      groups = data.grupos;
      console.log('✓ Formato array detectado:', groups);
    }
    // Formato 2: String con lista
    else if (typeof data.grupos === 'string') {
      groups = parseGroupsFromString(data.grupos);
      console.log('✓ Formato string parseado:', groups);
    }
    // Formato 3: No hay grupos
    else {
      console.log('ℹ️ Sin grupos disponibles');
      list.innerHTML = '<p class="empty-state">No estás en ningún grupo</p>';
      return;
    }
    
    // Actualizar estado y UI
    state.myGroups = groups;
    
    if (groups.length === 0) {
      list.innerHTML = '<p class="empty-state">No estás en ningún grupo</p>';
      return;
    }
    
    // Renderizar grupos
    list.innerHTML = '';
    groups.forEach(groupName => {
      const div = document.createElement('div');
      div.className = 'conversation-item';
      
      if (state.currentChat === groupName && state.isGroup) {
        div.classList.add('active');
      }
      
      div.innerHTML = `<span>👥</span><strong>${groupName}</strong>`;
      div.onclick = () => openGroupChat(groupName);
      list.appendChild(div);
    });
    
    console.log('✓ Grupos cargados:', groups);
    
  } catch (err) {
    console.error('❌ Error cargando grupos:', err);
    const list = document.getElementById('groupsList');
    list.innerHTML = '<p class="empty-state">Error al cargar grupos</p>';
  }
}

/**
 * 🆕 Parsea el formato de string que devuelve el backend
 */
function parseGroupsFromString(groupsString) {
  const groups = [];
  
  // Formato esperado:
  // "Grupos disponibles:\n- Grupo1 (2 miembros)\n- Grupo2 (3 miembros)"
  
  if (!groupsString || groupsString === 'No hay grupos creados') {
    return [];
  }
  
  const lines = groupsString.split('\n');
  
  for (const line of lines) {
    // Buscar líneas que empiecen con "- "
    const match = line.match(/^-\s*(.+?)\s*\(/);
    if (match) {
      groups.push(match[1].trim());
    }
  }
  
  return groups;
}

export function openGroupChat(groupName) {
  // 🔒 Verificar que el usuario sea miembro ANTES de abrir
  if (!state.myGroups.includes(groupName)) {
    showError('No eres miembro de este grupo');
    console.warn('⚠️ Intento de acceder a grupo sin membresía:', groupName);
    return;
  }

  state.currentChat = groupName;
  state.isGroup = true;
  
  updateChatHeader(`👥 Grupo: ${groupName}`, 'Chat grupal');
  showMessageInput();
  loadHistory(groupName, true, true);
  startPolling();
  
  // 🆕 Actualizar SOLO el estilo activo sin recargar todo
  updateActiveGroupInUI(groupName);
}

/**
 * 🆕 Actualiza visualmente el grupo activo sin recargar la lista completa
 */
function updateActiveGroupInUI(groupName) {
  const list = document.getElementById('groupsList');
  const items = list.querySelectorAll('.conversation-item');
  
  items.forEach(item => {
    const itemName = item.querySelector('strong').textContent;
    if (itemName === groupName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}