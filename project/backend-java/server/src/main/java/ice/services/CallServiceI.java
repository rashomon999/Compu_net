package ice.services;
// Ubicación: backend-java/server/src/main/java/ice/services/CallServiceI.java

import ChatSystem.*;
import com.zeroc.Ice.Current;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ⚡ CallService - Sistema del Profesor (COMPLETO)
 * Audio fluye DIRECTO por el servidor
 */
public class CallServiceI implements CallService {
    
    private final Map<String, CallCallbackPrx> subscribers = new ConcurrentHashMap<>();
    private final Map<String, String> activeCalls = new ConcurrentHashMap<>();
    private int audioPacketCount = 0;

    // ========================================
    // 🎵 ENVIAR AUDIO (REENVÍO DIRECTO)
    // ========================================
    @Override
    public synchronized void sendAudio(String fromUser, byte[] data, Current current) {
        String target = activeCalls.get(fromUser);
        
        if (target == null) {
            // No hay llamada activa - silenciar (no loguear para no saturar)
            return;
        }

        // Loguear solo cada 50 paquetes para no saturar
        audioPacketCount++;
        if (audioPacketCount % 50 == 0) {
            System.out.println("[CALL] 🎵 Audio fluye: " + fromUser + " → " + target 
                             + " (" + data.length + " bytes)");
        }

        CallCallbackPrx prx = subscribers.get(target);
        if (prx != null) {
            try {
                // ✅ Envío asíncrono para no bloquear
                prx.receiveAudioAsync(data).whenComplete((result, ex) -> {
                    if (ex != null) {
                        System.err.println("[CALL] ❌ Error enviando audio a " + target + ": " + ex.getMessage());
                    }
                });
            } catch (Exception e) {
                System.err.println("[CALL] ❌ Error enviando audio: " + e.getMessage());
            }
        } else {
            System.err.println("[CALL] ⚠️ Usuario " + target + " no tiene callback registrado");
        }
    }

    // ========================================
    // 📞 INICIAR LLAMADA
    // ========================================
    @Override
    public synchronized void startCall(String fromUser, String toUser, Current current) {
        System.out.println("╔════════════════════════════════════════╗");
        System.out.println("║  📞 NUEVA LLAMADA                      ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("   De:    " + fromUser);
        System.out.println("   Para:  " + toUser);
        
        CallCallbackPrx dest = subscribers.get(toUser);
        if (dest != null) {
            try {
                System.out.println("   ✅ Notificando a " + toUser + "...");
                dest.incomingCallAsync(fromUser).whenComplete((result, ex) -> {
                    if (ex != null) {
                        System.err.println("   ❌ Error notificando: " + ex.getMessage());
                    } else {
                        System.out.println("   ✅ Notificación enviada exitosamente");
                    }
                });
            } catch (Exception e) {
                System.err.println("   ❌ Error notificando: " + e.getMessage());
            }
        } else {
            System.out.println("   ⚠️ Usuario " + toUser + " no está conectado");
            System.out.println("   📋 Usuarios conectados: " + subscribers.keySet());
        }
    }

    // ========================================
    // ✅ ACEPTAR LLAMADA
    // ========================================
    @Override
    public synchronized void acceptCall(String fromUser, String toUser, Current current) {
        System.out.println("╔════════════════════════════════════════╗");
        System.out.println("║  ✅ LLAMADA ACEPTADA                   ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("   " + toUser + " aceptó llamada de " + fromUser);
        
        CallCallbackPrx caller = subscribers.get(fromUser);
        if (caller != null) {
            try {
                System.out.println("   📤 Notificando aceptación a " + fromUser + "...");
                caller.callAcceptedAsync(toUser).whenComplete((result, ex) -> {
                    if (ex != null) {
                        System.err.println("   ❌ Error notificando aceptación: " + ex.getMessage());
                    } else {
                        System.out.println("   ✅ Aceptación notificada");
                    }
                });
                
                // ✅ Marcar llamada como activa (bidireccional)
                activeCalls.put(fromUser, toUser);
                activeCalls.put(toUser, fromUser);
                
                System.out.println("   ✅ Canal de audio establecido:");
                System.out.println("      " + fromUser + " ↔ " + toUser);
                System.out.println("   🎵 Audio puede fluir ahora");
                
            } catch (Exception e) {
                System.err.println("   ❌ Error: " + e.getMessage());
            }
        } else {
            System.err.println("   ⚠️ " + fromUser + " no está conectado");
        }
    }

    // ========================================
    // ❌ RECHAZAR LLAMADA
    // ========================================
    @Override
    public synchronized void rejectCall(String fromUser, String toUser, Current current) {
        System.out.println("╔════════════════════════════════════════╗");
        System.out.println("║  ❌ LLAMADA RECHAZADA                  ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("   " + toUser + " rechazó llamada de " + fromUser);
        
        CallCallbackPrx caller = subscribers.get(fromUser);
        if (caller != null) {
            try {
                caller.callRejectedAsync(toUser);
                System.out.println("   ✅ Notificación enviada");
            } catch (Exception e) {
                System.err.println("   ❌ Error: " + e.getMessage());
            }
        }
    }

    // ========================================
    // 📴 COLGAR LLAMADA
    // ========================================
    @Override
    public synchronized void colgar(String fromUser, String toUser, Current current) {
        System.out.println("╔════════════════════════════════════════╗");
        System.out.println("║  📴 LLAMADA FINALIZADA                 ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("   " + fromUser + " colgó a " + toUser);
        
        // Notificar al otro usuario
        CallCallbackPrx receiver = subscribers.get(toUser);
        if (receiver != null) {
            try {
                receiver.callColgadaAsync(fromUser);
                System.out.println("   ✅ Notificación enviada a " + toUser);
            } catch (Exception e) {
                System.err.println("   ❌ Error: " + e.getMessage());
            }
        }
        
        // Limpiar llamada activa
        activeCalls.remove(fromUser);
        activeCalls.remove(toUser);
        
        System.out.println("   ✅ Canal de audio cerrado");
    }

    // ========================================
    // 🔔 SUSCRIPCIÓN
    // ========================================
    @Override
    public synchronized void subscribe(String username, CallCallbackPrx callback, Current current) {
        subscribers.put(username, callback);
        System.out.println("╔════════════════════════════════════════╗");
        System.out.println("║  🔔 NUEVO SUSCRIPTOR                   ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("   Usuario:   " + username);
        System.out.println("   Callback:  " + (callback != null ? "✅" : "❌"));
        System.out.println("   Total:     " + subscribers.size() + " usuarios");
        System.out.println("   Usuarios:  " + subscribers.keySet());
    }

    @Override
    public synchronized void unsubscribe(String username, Current current) {
        subscribers.remove(username);
        activeCalls.remove(username);
        System.out.println("╔════════════════════════════════════════╗");
        System.out.println("║  📴 USUARIO DESCONECTADO               ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("   Usuario: " + username);
        System.out.println("   Quedan:  " + subscribers.size() + " usuarios");
    }

    // ========================================
    // 📋 USUARIOS CONECTADOS
    // ========================================
    @Override
    public String[] getConnectedUsers(Current current) {
        return subscribers.keySet().toArray(new String[0]);
    }
}