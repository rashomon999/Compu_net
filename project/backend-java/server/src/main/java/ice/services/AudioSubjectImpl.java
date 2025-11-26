package main.java.ice.services;

import AudioSystem.*;
import com.zeroc.Ice.Current;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Implementación del Subject para llamadas de audio
 * Filosofía del Profesor: Enrutamiento directo, sin WebRTC
 */
public class AudioSubjectImpl implements AudioSubject {
    
    // ============================================
    // ESTRUCTURAS DE DATOS
    // ============================================
    
    // Mapea userId → AudioObserverPrx
    private final Map<String, AudioObserverPrx> observers = new ConcurrentHashMap<>();
    
    // Mapea userId → userId (llamada activa BIDIRECCIONAL)
    // Ejemplo: {"Alice": "Bob", "Bob": "Alice"}
    private final Map<String, String> activeCalls = new ConcurrentHashMap<>();
    
    // Contador de paquetes para debug
    private final Map<String, Long> audioPacketCount = new ConcurrentHashMap<>();
    
    // ============================================
    // GESTIÓN DE CONEXIONES
    // ============================================
    
    @Override
    public synchronized void attach(String userId, AudioObserverPrx obs, Current current) {
        System.out.println("[AUDIO] 🔌 Usuario conectándose: " + userId);
        
        // CRÍTICO: Fijar el proxy a la conexión actual (para WebSocket)
        AudioObserverPrx proxy = obs.ice_fixed(current.con);
        
        // Registrar el usuario
        observers.put(userId, proxy);
        System.out.println("   ✅ Observer registrado");
        System.out.println("   👥 Total conectados: " + observers.size());
        
        // Configurar callback de desconexión
        if (current.con != null) {
            current.con.setCloseCallback(con -> {
                System.out.println("[AUDIO] 👋 Usuario desconectado: " + userId);
                handleDisconnection(userId);
            });
        }
    }
    
    @Override
    public synchronized void detach(String userId, Current current) {
        System.out.println("[AUDIO] 🔌 Usuario desconectándose manualmente: " + userId);
        handleDisconnection(userId);
    }
    
    private void handleDisconnection(String userId) {
        observers.remove(userId);
        audioPacketCount.remove(userId);
        
        // Si estaba en llamada, notificar al otro usuario
        String target = activeCalls.get(userId);
        if (target != null) {
            System.out.println("   📞 Había llamada activa con: " + target);
            
            activeCalls.remove(userId);
            activeCalls.remove(target);
            
            // Notificar al otro usuario
            AudioObserverPrx targetPrx = observers.get(target);
            if (targetPrx != null) {
                try {
                    targetPrx.callEndedAsync(userId);
                    System.out.println("   ✅ Notificado a " + target);
                } catch (Exception e) {
                    System.err.println("   ❌ Error notificando: " + e.getMessage());
                }
            }
        }
        
        System.out.println("   ✅ Recursos liberados");
    }
    
    // ============================================
    // ENRUTAMIENTO DE AUDIO (CRÍTICO)
    // ============================================
    
    @Override
    public synchronized void sendAudio(String fromUser, byte[] data, Current current) {
        // PASO 1: Buscar con quién está hablando
        String target = activeCalls.get(fromUser);
        
        // Log solo cada 100 paquetes para no saturar
        long count = audioPacketCount.merge(fromUser, 1L, Long::sum);
        if (count % 100 == 0) {
            System.out.println("[AUDIO] 📤 " + fromUser + " ha enviado " + count + " paquetes");
            System.out.println("   Enviando a: " + target);
            System.out.println("   Tamaño: " + data.length + " bytes");
        }
        
        // PASO 2: Validar que haya llamada activa
        if (target == null) {
            if (count % 100 == 0) {
                System.out.println("   ⚠️ No hay llamada activa");
            }
            return;
        }
        
        // PASO 3: Obtener el proxy del destinatario
        AudioObserverPrx targetPrx = observers.get(target);
        
        if (targetPrx == null) {
            if (count % 100 == 0) {
                System.out.println("   ⚠️ Destinatario no conectado");
            }
            return;
        }
        
        // PASO 4: Enviar audio de forma asíncrona (NO BLOQUEAR)
        try {
            targetPrx.receiveAudioAsync(data);
        } catch (Exception e) {
            System.err.println("   ❌ Error enviando audio: " + e.getMessage());
        }
    }
    
    // ============================================
    // GESTIÓN DE LLAMADAS
    // ============================================
    
    @Override
    public synchronized void startCall(String fromUser, String toUser, Current current) {
        System.out.println("[AUDIO] 📞 Llamada iniciada:");
        System.out.println("   De: " + fromUser);
        System.out.println("   Para: " + toUser);
        
        // Buscar el Observer del destinatario
        AudioObserverPrx destPrx = observers.get(toUser);
        
        if (destPrx == null) {
            System.out.println("   ❌ Usuario no encontrado: " + toUser);
            
            // Notificar al llamante que el usuario no existe
            AudioObserverPrx callerPrx = observers.get(fromUser);
            if (callerPrx != null) {
                try {
                    callerPrx.callRejectedAsync(toUser);
                } catch (Exception e) {
                    System.err.println("   ❌ Error notificando rechazo: " + e.getMessage());
                }
            }
            return;
        }
        
        // Verificar si el destinatario ya está en otra llamada
        if (activeCalls.containsKey(toUser)) {
            System.out.println("   ⚠️ Usuario ocupado: " + toUser);
            
            AudioObserverPrx callerPrx = observers.get(fromUser);
            if (callerPrx != null) {
                try {
                    callerPrx.callRejectedAsync(toUser);
                } catch (Exception e) {
                    System.err.println("   ❌ Error notificando ocupado: " + e.getMessage());
                }
            }
            return;
        }
        
        // Notificar llamada entrante
        try {
            destPrx.incomingCallAsync(fromUser);
            System.out.println("   ✅ Notificación enviada a " + toUser);
        } catch (Exception e) {
            System.err.println("   ❌ Error notificando llamada: " + e.getMessage());
        }
    }
    
    @Override
    public synchronized void acceptCall(String fromUser, String toUser, Current current) {
        System.out.println("[AUDIO] ✅ Llamada aceptada:");
        System.out.println("   De: " + fromUser);
        System.out.println("   Por: " + toUser);
        
        // Buscar el Observer del llamante original
        AudioObserverPrx callerPrx = observers.get(fromUser);
        
        if (callerPrx == null) {
            System.out.println("   ⚠️ Llamante ya no está conectado");
            return;
        }
        
        // CRÍTICO: Establecer llamada BIDIRECCIONAL
        activeCalls.put(fromUser, toUser);
        activeCalls.put(toUser, fromUser);
        
        System.out.println("   📞 Llamada ACTIVA: " + fromUser + " ↔ " + toUser);
        System.out.println("   activeCalls: " + activeCalls);
        
        // Notificar al llamante que la llamada fue aceptada
        try {
            callerPrx.callAcceptedAsync(toUser);
            System.out.println("   ✅ Notificación enviada a " + fromUser);
        } catch (Exception e) {
            System.err.println("   ❌ Error notificando aceptación: " + e.getMessage());
        }
        
        // Resetear contadores de audio
        audioPacketCount.put(fromUser, 0L);
        audioPacketCount.put(toUser, 0L);
    }
    
    @Override
    public synchronized void rejectCall(String fromUser, String toUser, Current current) {
        System.out.println("[AUDIO] ❌ Llamada rechazada:");
        System.out.println("   De: " + fromUser);
        System.out.println("   Por: " + toUser);
        
        AudioObserverPrx callerPrx = observers.get(fromUser);
        
        if (callerPrx != null) {
            try {
                callerPrx.callRejectedAsync(toUser);
                System.out.println("   ✅ Notificación enviada");
            } catch (Exception e) {
                System.err.println("   ❌ Error notificando rechazo: " + e.getMessage());
            }
        }
    }
    
    @Override
    public synchronized void hangup(String fromUser, String toUser, Current current) {
        System.out.println("[AUDIO] 📞 Llamada finalizada:");
        System.out.println("   Por: " + fromUser);
        System.out.println("   Con: " + toUser);
        
        // PASO 1: Notificar al que colgó (para UI local)
        AudioObserverPrx callerPrx = observers.get(fromUser);
        if (callerPrx != null) {
            try {
                callerPrx.callEndedAsync(fromUser);
            } catch (Exception e) {
                System.err.println("   ❌ Error notificando a caller: " + e.getMessage());
            }
        }
        
        // PASO 2: Notificar al otro usuario
        AudioObserverPrx receiverPrx = observers.get(toUser);
        if (receiverPrx != null) {
            try {
                receiverPrx.callEndedAsync(fromUser);
                System.out.println("   ✅ Notificado a " + toUser);
            } catch (Exception e) {
                System.err.println("   ❌ Error notificando a receiver: " + e.getMessage());
            }
        }
        
        // PASO 3: Limpiar estado de llamada
        activeCalls.remove(fromUser);
        activeCalls.remove(toUser);
        
        // Mostrar estadísticas finales
        Long packetsFrom = audioPacketCount.get(fromUser);
        Long packetsTo = audioPacketCount.get(toUser);
        
        System.out.println("   📊 Estadísticas:");
        System.out.println("      " + fromUser + ": " + (packetsFrom != null ? packetsFrom : 0) + " paquetes");
        System.out.println("      " + toUser + ": " + (packetsTo != null ? packetsTo : 0) + " paquetes");
        
        audioPacketCount.remove(fromUser);
        audioPacketCount.remove(toUser);
        
        System.out.println("   ✅ Recursos liberados");
    }
    
    // ============================================
    // UTILIDADES
    // ============================================
    
    @Override
    public String[] getConnectedUsers(Current current) {
        System.out.println("[AUDIO] 👥 Usuarios conectados: " + observers.size());
        return observers.keySet().toArray(new String[0]);
    }
}