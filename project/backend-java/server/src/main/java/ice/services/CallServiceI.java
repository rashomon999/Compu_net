package ice.services;
// Ubicación: backend-java/server/src/main/java/ice/services/CallServiceI.java

import ChatSystem.*;
import com.zeroc.Ice.Current;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ⚡ CallService - Sistema del Profesor
 * Audio fluye DIRECTO por el servidor (sin WebRTC)
 */
public class CallServiceI implements CallService {
    
    private final Map<String, CallCallbackPrx> subscribers = new ConcurrentHashMap<>();
    private final Map<String, String> activeCalls = new ConcurrentHashMap<>();

    // ========================================
    // 🎵 ENVIAR AUDIO (REENVÍO DIRECTO)
    // ========================================
    @Override
    public synchronized void sendAudio(String fromUser, byte[] data, Current current) {
        String target = activeCalls.get(fromUser);
        
        if (target == null) {
            // No hay llamada activa - silenciar
            return;
        }

        // Loguear solo cada 50 paquetes para no saturar
        if (System.currentTimeMillis() % 1000 < 50) {
            System.out.println("[CALL] 🎵 Audio: " + fromUser + " → " + target 
                             + " (" + data.length + " bytes)");
        }

        CallCallbackPrx prx = subscribers.get(target);
        if (prx != null) {
            try {
                // Envío asíncrono para no bloquear
                prx.receiveAudioAsync(data);
            } catch (Exception e) {
                System.err.println("[CALL] ❌ Error enviando audio: " + e.getMessage());
            }
        }
    }

    // ========================================
    // 📞 INICIAR LLAMADA
    // ========================================
    @Override
    public synchronized void startCall(String fromUser, String toUser, Current current) {
        System.out.println("[CALL] 📞 Llamada: " + fromUser + " → " + toUser);
        
        CallCallbackPrx dest = subscribers.get(toUser);
        if (dest != null) {
            try {
                dest.incomingCallAsync(fromUser);
                System.out.println("[CALL] ✅ Notificación enviada a " + toUser);
            } catch (Exception e) {
                System.err.println("[CALL] ❌ Error notificando: " + e.getMessage());
            }
        } else {
            System.out.println("[CALL] ⚠️ Usuario " + toUser + " no está conectado");
        }
    }

    // ========================================
    // ✅ ACEPTAR LLAMADA
    // ========================================
    @Override
    public synchronized void acceptCall(String fromUser, String toUser, Current current) {
        System.out.println("[CALL] ✅ Aceptada: " + toUser + " acepta a " + fromUser);
        
        CallCallbackPrx caller = subscribers.get(fromUser);
        if (caller != null) {
            try {
                caller.callAcceptedAsync(toUser);
                
                // Marcar llamada como activa (bidireccional)
                activeCalls.put(fromUser, toUser);
                activeCalls.put(toUser, fromUser);
                
                System.out.println("[CALL] ✅ Llamada activa entre " + fromUser + " ↔ " + toUser);
            } catch (Exception e) {
                System.err.println("[CALL] ❌ Error: " + e.getMessage());
            }
        }
    }

    // ========================================
    // ❌ RECHAZAR LLAMADA
    // ========================================
    @Override
    public synchronized void rejectCall(String fromUser, String toUser, Current current) {
        System.out.println("[CALL] ❌ Rechazada: " + toUser + " rechaza a " + fromUser);
        
        CallCallbackPrx caller = subscribers.get(fromUser);
        if (caller != null) {
            try {
                caller.callRejectedAsync(toUser);
            } catch (Exception e) {
                System.err.println("[CALL] ❌ Error: " + e.getMessage());
            }
        }
    }

    // ========================================
    // 📴 COLGAR LLAMADA
    // ========================================
    @Override
    public synchronized void colgar(String fromUser, String toUser, Current current) {
        System.out.println("[CALL] 📴 Colgado: " + fromUser + " → " + toUser);
        
        // Notificar al otro usuario
        CallCallbackPrx receiver = subscribers.get(toUser);
        if (receiver != null) {
            try {
                receiver.callColgadaAsync(fromUser);
            } catch (Exception e) {
                System.err.println("[CALL] ❌ Error: " + e.getMessage());
            }
        }
        
        // Limpiar llamada activa
        activeCalls.remove(fromUser);
        activeCalls.remove(toUser);
        
        System.out.println("[CALL] ✅ Llamada finalizada");
    }

    // ========================================
    // 🔔 SUSCRIPCIÓN
    // ========================================
    @Override
    public synchronized void subscribe(String username, CallCallbackPrx callback, Current current) {
        subscribers.put(username, callback);
        System.out.println("[CALL] 📞 Usuario suscrito: " + username);
        System.out.println("[CALL]    Total conectados: " + subscribers.size());
    }

    @Override
    public synchronized void unsubscribe(String username, Current current) {
        subscribers.remove(username);
        activeCalls.remove(username);
        System.out.println("[CALL] 📴 Usuario desconectado: " + username);
    }

    // ========================================
    // 📋 USUARIOS CONECTADOS
    // ========================================
    @Override
    public String[] getConnectedUsers(Current current) {
        return subscribers.keySet().toArray(new String[0]);
    }
}