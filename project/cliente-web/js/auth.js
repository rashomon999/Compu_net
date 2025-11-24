// ============================================
// js/auth.js - Autenticación con configuración de servidor
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';
import { showError, showChatInterface } from './ui.js';
import { loadRecentChatsFromICE } from './chats.js';
import { loadGroupsFromICE } from './groups.js';
import { subscribeToRealTimeNotifications } from './notifications.js';
import { callManager } from './callManager.js';

export async function login() {
  const username = document.getElementById('usernameInput').value.trim();
  const serverHost = document.getElementById('serverHostInput')?.value.trim() || 'localhost';
  const serverPort = parseInt(document.getElementById('serverPortInput')?.value) || 10000;
  
  if (!username) {
    showError('Por favor ingresa un nombre de usuario');
    return;
  }
  
  // Validar puerto
  if (serverPort < 1 || serverPort > 65535) {
    showError('Puerto inválido (debe estar entre 1 y 65535)');
    return;
  }

  const btn = document.getElementById('loginButton');
  const statusEl = document.getElementById('connectionStatus');
  const originalText = btn.textContent;
  
  btn.textContent = 'Conectando...';
  btn.disabled = true;
  
  if (statusEl) {
    statusEl.classList.remove('hidden', 'error');
    statusEl.classList.add('connecting');
    statusEl.querySelector('.status-text').textContent = `Conectando a ${serverHost}:${serverPort}...`;
  }

  try {
    // PASO 1: Conectar al servidor ICE con configuración personalizada
    console.log(`🔌 Intentando conectar a ${serverHost}:${serverPort}`);
    await iceClient.connect(username, serverHost, serverPort);
    
    // PASO 2: Guardar estado
    state.currentUsername = username;
    
    // PASO 3: Suscribirse a notificaciones en tiempo real
    if (statusEl) {
      statusEl.querySelector('.status-text').textContent = 'Configurando notificaciones...';
    }
    await subscribeToRealTimeNotifications(username);
    
    // PASO 4: Intentar suscribirse a eventos de llamadas
    try {
      await subscribeToCallEvents(username);
      console.log('✅ Eventos de llamadas habilitados');
      state.callsAvailable = true;
    } catch (err) {
      console.warn('⚠️ CallService no disponible:', err.message);
      state.callsAvailable = false;
    }
    
    // PASO 5: Mostrar interfaz
    if (statusEl) {
      statusEl.querySelector('.status-text').textContent = 'Cargando datos...';
    }
    showChatInterface();
    
    // PASO 6: Cargar datos iniciales
    await loadRecentChatsFromICE();
    await loadGroupsFromICE();
    
    console.log('✅ Login exitoso:', username);
    console.log('🌐 Servidor:', iceClient.getCurrentServerInfo());
    
  } catch (err) {
    console.error('❌ Error en login:', err);
    
    let errorMsg = 'No se pudo conectar al servidor ICE';
    
    if (err.message.includes('ChatService')) {
      errorMsg = `No se pudo conectar a ${serverHost}:${serverPort}\n\nVerifica que:\n• El servidor esté corriendo\n• La dirección IP sea correcta\n• El firewall permita conexiones al puerto ${serverPort}`;
    } else if (err.message.includes('timeout')) {
      errorMsg = `Timeout conectando a ${serverHost}:${serverPort}\n\n¿El servidor está corriendo?`;
    } else {
      errorMsg = err.message;
    }
    
    showError(errorMsg);
    
    if (statusEl) {
      statusEl.classList.remove('connecting');
      statusEl.classList.add('error');
      statusEl.querySelector('.status-icon').textContent = '❌';
      statusEl.querySelector('.status-text').textContent = 'Error de conexión';
    }
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
    
    if (statusEl && iceClient.isClientConnected()) {
      statusEl.classList.add('hidden');
    }
  }
}

export async function logout() {
  try {
    // Limpiar cualquier llamada activa
    if (callManager.isCallActive()) {
      await callManager.endCall();
    }
    
    await iceClient.disconnect();
    console.log('👋 Logout exitoso');
  } catch (err) {
    console.error('Error en logout:', err);
  }
}

// ========================================
// SUSCRIPCIÓN A EVENTOS DE LLAMADAS
// ========================================

async function subscribeToCallEvents(username) {
  try {
    await iceClient.subscribeToCallEvents(username, {
      
      // Llamada entrante
      onIncomingCall: async (offer) => {
        console.log('📞 Llamada entrante de', offer.caller);
        
        const { showIncomingCallUI } = await import('./callUI.js');
        await showIncomingCallUI(offer);
      },
      
      // Respuesta a llamada
      onCallAnswer: async (answer) => {
        console.log('📞 Respuesta de llamada:', answer.status);
        
        const { webrtcManager } = await import('./webrtcManager.js');
        const { showActiveCallUI } = await import('./callUI.js');
        
        await webrtcManager.handleCallAnswer(answer);
        
        if (answer.status === 'ACCEPTED') {
          callManager.activeCall.status = 'CONNECTED';
          callManager.activeCall.answerTime = Date.now();
          callManager.startDurationTimer();
          
          showActiveCallUI(state.currentChat);
        }
      },
      
      // ICE Candidate
      onRtcCandidate: async (candidate) => {
        console.log('🧊 RTC candidate recibido');
        
        const { webrtcManager } = await import('./webrtcManager.js');
        await webrtcManager.handleIceCandidate(candidate);
      },
      
      // Llamada finalizada
      onCallEnded: async (callId, reason) => {
        console.log('📞 Llamada finalizada:', reason);
        
        const { hideCallUI } = await import('./callUI.js');
        const { webrtcManager } = await import('./webrtcManager.js');
        
        webrtcManager.cleanup();
        await callManager.endCall();
        hideCallUI();
        
        showError(`Llamada finalizada: ${reason}`);
      }
    });
    
  } catch (error) {
    throw new Error('CallService no disponible: ' + error.message);
  }
}

// ========================================
// DETECCIÓN AUTOMÁTICA DE SERVIDOR
// ========================================

export async function detectServer() {
  const possibleHosts = ['localhost'];
  const port = 10000;
  
  // Agregar IPs comunes de red local
  const localIP = await getLocalIP();
  if (localIP) {
    const ipParts = localIP.split('.');
    if (ipParts.length === 4) {
      const subnet = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
      // Probar primeras 10 IPs del rango
      for (let i = 1; i <= 10; i++) {
        possibleHosts.push(`${subnet}.${i}`);
      }
    }
  }
  
  console.log('🔍 Buscando servidores en:', possibleHosts);
  
  for (const host of possibleHosts) {
    try {
      // Intentar conexión rápida
      const testClient = new IceClientManager();
      await testClient.connect('test', host, port);
      await testClient.disconnect();
      
      console.log('✅ Servidor encontrado en:', host);
      return { host, port };
    } catch (err) {
      console.log('❌ No encontrado en:', host);
    }
  }
  
  return null;
}

async function getLocalIP() {
  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    await pc.createOffer().then(offer => pc.setLocalDescription(offer));
    
    return new Promise((resolve) => {
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        
        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
        const match = ipRegex.exec(ice.candidate.candidate);
        
        if (match) {
          pc.close();
          resolve(match[1]);
        }
      };
      
      setTimeout(() => {
        pc.close();
        resolve(null);
      }, 1000);
    });
  } catch (err) {
    console.error('Error detectando IP local:', err);
    return null;
  }
}