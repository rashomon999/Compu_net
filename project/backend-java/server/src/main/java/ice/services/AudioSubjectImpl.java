package main.java.ice.services;

import AudioSystem.*;
import com.zeroc.Ice.Current;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Implementación EXACTA del profesor
 * Sistema de llamadas VoIP punto a punto
 */
public class AudioSubjectImpl implements AudioSubject {
    
    // ============================================
    // ESTRUCTURAS DE DATOS (como el profesor)
    // ============================================
    
    // Mapea userId → AudioObserverPrx
    private final Map<String, AudioObserverPrx> observers = new ConcurrentHashMap<>();
    
    // Mapea userId → userId (llamada activa BIDIRECCIONAL)
    private final Map<String, String> activeCalls = new ConcurrentHashMap<>();
    
    // Contador de paquetes para estadísticas
    private final Map<String, Long> audioPacketCount = new ConcurrentHashMap<>();
    
    // Colas para polling (fallback cuando callbacks no funcionan)
    private final Map<String, List<String>> pendingIncomingCalls = new ConcurrentHashMap<>();
    private final Map<String, List<String>> pendingAcceptedCalls = new ConcurrentHashMap<>();
    private final Map<String, List<String>> pendingRejectedCalls = new ConcurrentHashMap<>();
    private final Map<String, List<String>> pendingEndedCalls = new ConcurrentHashMap<>();
    
    // ============================================
    // GESTIÓN DE CONEXIONES (como el profesor)
    // ============================================
    
    @Override
    public synchronized void attach(String userId, AudioObserverPrx obs, Current current) {
        System.out.println("[AUDIO] Usuario conectado: " + userId);
        
        // CRÍTICO: Fijar el proxy a la conexión actual (para WebSocket)
        AudioObserverPrx proxy = obs.ice_fixed(current.con);
        
        // Registrar el usuario
        observers.put(userId, proxy);
        System.out.println("   ✅ Total conectados: " + observers.size());
        
        // Configurar callback de desconexión
        if (current.con != null) {
            current.con.setCloseCallback(con -> {
                System.out.println("[AUDIO] Usuario desconectado: " + userId);
                handleDisconnection(userId);
            });
        }
    }
    
    @Override
    public synchronized void detach(String userId, Current current) {
        System.out.println("[AUDIO] Desconexión manual: " + userId);
        handleDisconnection(userId);
    }
    
    private void handleDisconnection(String userId) {
        observers.remove(userId);
        
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
                } catch (Exception e) {
                    System.err.println("   ❌ Error notificando desconexión: " + e);
                }
            }
        }
        
        // Limpiar colas
        pendingIncomingCalls.remove(userId);
        pendingAcceptedCalls.remove(userId);
        pendingRejectedCalls.remove(userId);
        pendingEndedCalls.remove(userId);
        audioPacketCount.remove(userId);
        
        System.out.println("   ✅ Recursos liberados");
    }
    
    // ============================================
    // ENRUTAMIENTO DE AUDIO (como el profesor)
    // ============================================
    @Override
public synchronized void sendAudio(String fromUser, byte[] data, Current current) {
    // PASO 1: Buscar con quién está hablando
    String target = activeCalls.get(fromUser);
    
    // Incrementar contador (para debug)
    long count = audioPacketCount.merge(fromUser, 1L, Long::sum);
    
    // Log cada 100 paquetes
    if (count % 100 == 0) {
        System.out.println("[AUDIO] sendAudio #" + count + ": " + fromUser + " → " + target 
            + " | " + (data != null ? data.length : 0) + " bytes");
    }
    
    // PASO 2: Validar que haya llamada activa
    if (target == null) {
        if (count <= 5) {
            System.out.println("   ⚠️ No hay llamada activa para " + fromUser);
            System.out.println("   📋 activeCalls actual: " + activeCalls);
        }
        return;
    }
    
    // PASO 3: Obtener el proxy del destinatario
    AudioObserverPrx prx = observers.get(target);
    
    if (prx != null) {
        try {
            // PASO 4: Enviar el audio de forma asíncrona
            prx.receiveAudioAsync(data);
            
            if (count % 100 == 0) {
                System.out.println("   ✅ Audio enviado correctamente");
            }
        } catch (Exception e) {
            System.err.println("   ❌ Error enviando audio: " + e);
        }
    } else {
        if (count <= 5) {
            System.out.println("   ❌ No se encontró proxy para " + target);
        }
    }
}
    
    // ============================================
    // GESTIÓN DE LLAMADAS (EXACTO como el profesor)
    // ============================================
    
    @Override
    public synchronized void startCall(String fromUser, String toUser, Current current) {
        System.out.println("[AUDIO] startCall: " + fromUser + " → " + toUser);
        
        // Buscar el Observer del destinatario
        AudioObserverPrx dest = observers.get(toUser);
        
        if (dest != null) {
            // Notificar al destinatario de la llamada entrante
            dest.incomingCallAsync(fromUser);
            System.out.println("   ✅ Notificación enviada a " + toUser);
            
            // También agregar a cola de polling (fallback)
            addPendingIncomingCall(toUser, fromUser);
        } else {
            System.out.println("   ❌ Usuario no encontrado: " + toUser);
        }
    }
    
   @Override
public synchronized void acceptCall(String fromUser, String toUser, Current current) {
    System.out.println("[AUDIO] acceptCall: " + fromUser + " → " + toUser);
    System.out.println("   fromUser (caller): " + fromUser);
    System.out.println("   toUser (acceptor): " + toUser);
    
    // ✅ EXACTO DEL PROFESOR:
    // fromUser = quien LLAMÓ originalmente (Maria)
    // toUser = quien está ACEPTANDO ahora (Luis)
    
    // Buscar el Observer del LLAMANTE original
    AudioObserverPrx caller = observers.get(fromUser);
    
    if (caller != null) {
        // Notificar al llamante que la llamada fue aceptada
        // Le pasamos el nombre de quien aceptó (toUser)
        caller.callAcceptedAsync(toUser);
        System.out.println("   ✅ Notificación 'callAccepted' enviada a " + fromUser + " (llamante)");
        
        // CRÍTICO: Marca la llamada como activa (BIDIRECCIONAL)
        activeCalls.put(fromUser, toUser);  // Maria → Luis
        activeCalls.put(toUser, fromUser);  // Luis → Maria
        
        System.out.println("   📞 Llamada BIDIRECCIONAL activa:");
        System.out.println("      " + fromUser + " ↔ " + toUser);
        System.out.println("   🔊 Enrutamiento de audio configurado:");
        System.out.println("      Audio de " + fromUser + " → " + toUser);
        System.out.println("      Audio de " + toUser + " → " + fromUser);
        
        // Inicializar contadores
        audioPacketCount.put(fromUser, 0L);
        audioPacketCount.put(toUser, 0L);
        
        // También agregar a cola de polling (fallback)
        addPendingAcceptedCall(fromUser, toUser);
    } else {
        System.out.println("   ❌ No se encontró al llamante: " + fromUser);
    }
}
    
    @Override
    public synchronized void rejectCall(String fromUser, String toUser, Current current) {
        System.out.println("[AUDIO] rejectCall: " + fromUser + " → " + toUser);
        
        AudioObserverPrx caller = observers.get(fromUser);
        
        if (caller != null) {
            caller.callRejectedAsync(toUser);
            System.out.println("   ✅ Rechazo enviado a " + fromUser);
            
            // También agregar a cola de polling (fallback)
            addPendingRejectedCall(fromUser, toUser);
        }
    }
    
    @Override
    public synchronized void hangup(String fromUser, String toUser, Current current) {
        System.out.println("[AUDIO] hangup: " + fromUser + " → " + toUser);
        
        // PASO 1: Notificar al que colgó (para UI local)
        AudioObserverPrx caller = observers.get(fromUser);
        if (caller != null) {
            caller.callEndedAsync(fromUser);
        }
        
        // PASO 2: Notificar al receptor que el otro colgó
        AudioObserverPrx receiver = observers.get(toUser);
        if (receiver != null) {
            receiver.callEndedAsync(fromUser);
        }
        
        // PASO 3: Limpiar el estado de la llamada
        activeCalls.remove(fromUser);
        activeCalls.remove(toUser);
        
        // Mostrar estadísticas
        Long packetsFrom = audioPacketCount.remove(fromUser);
        Long packetsTo = audioPacketCount.remove(toUser);
        
        System.out.println("   📊 Estadísticas:");
        System.out.println("      " + fromUser + ": " + (packetsFrom != null ? packetsFrom : 0) + " paquetes");
        System.out.println("      " + toUser + ": " + (packetsTo != null ? packetsTo : 0) + " paquetes");
        System.out.println("   ✅ Llamada terminada");
        
        // También agregar a colas de polling (fallback)
        addPendingEndedCall(fromUser, toUser);
        addPendingEndedCall(toUser, fromUser);
    }
    
    // ============================================
    // MÉTODOS DE POLLING (fallback)
    // ============================================
    
    @Override
    public synchronized String[] getPendingIncomingCalls(String userId, Current current) {
        List<String> calls = pendingIncomingCalls.remove(userId);
        if (calls == null || calls.isEmpty()) {
            return new String[0];
        }
        return calls.toArray(new String[0]);
    }
    
    @Override
    public synchronized String[] getPendingAcceptedCalls(String userId, Current current) {
        List<String> calls = pendingAcceptedCalls.remove(userId);
        if (calls == null || calls.isEmpty()) {
            return new String[0];
        }
        return calls.toArray(new String[0]);
    }
    
    @Override
    public synchronized String[] getPendingRejectedCalls(String userId, Current current) {
        List<String> calls = pendingRejectedCalls.remove(userId);
        if (calls == null || calls.isEmpty()) {
            return new String[0];
        }
        return calls.toArray(new String[0]);
    }
    
    @Override
    public synchronized String[] getPendingEndedCalls(String userId, Current current) {
        List<String> calls = pendingEndedCalls.remove(userId);
        if (calls == null || calls.isEmpty()) {
            return new String[0];
        }
        return calls.toArray(new String[0]);
    }
    
    // ============================================
    // UTILIDADES
    // ============================================
    
    @Override
    public String[] getConnectedUsers(Current current) {
        return observers.keySet().toArray(new String[0]);
    }
    
    private void addPendingIncomingCall(String userId, String fromUser) {
        pendingIncomingCalls.computeIfAbsent(userId, k -> new ArrayList<>()).add(fromUser);
    }
    
    private void addPendingAcceptedCall(String userId, String fromUser) {
        pendingAcceptedCalls.computeIfAbsent(userId, k -> new ArrayList<>()).add(fromUser);
    }
    
    private void addPendingRejectedCall(String userId, String fromUser) {
        pendingRejectedCalls.computeIfAbsent(userId, k -> new ArrayList<>()).add(fromUser);
    }
    
    private void addPendingEndedCall(String userId, String fromUser) {
        pendingEndedCalls.computeIfAbsent(userId, k -> new ArrayList<>()).add(fromUser);
    }
}