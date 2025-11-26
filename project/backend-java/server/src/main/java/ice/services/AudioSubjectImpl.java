package main.java.ice.services;

import AudioSystem.*;
import com.zeroc.Ice.Current;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Implementación del Subject para llamadas de audio
 * ✅ MEJORADO: Con sistema de colas para polling (fallback de callbacks)
 */
public class AudioSubjectImpl implements AudioSubject {
    
    // ============================================
    // ESTRUCTURAS DE DATOS
    // ============================================
    
    // Mapea userId → AudioObserverPrx
    private final Map<String, AudioObserverPrx> observers = new ConcurrentHashMap<>();
    
    // Mapea userId → userId (llamada activa BIDIRECCIONAL)
    private final Map<String, String> activeCalls = new ConcurrentHashMap<>();
    
    // Contador de paquetes para debug
    private final Map<String, Long> audioPacketCount = new ConcurrentHashMap<>();
    
    // ✅ NUEVO: Colas para polling (fallback)
    private final Map<String, List<String>> pendingIncomingCalls = new ConcurrentHashMap<>();
    private final Map<String, List<String>> pendingAcceptedCalls = new ConcurrentHashMap<>();
    private final Map<String, List<String>> pendingRejectedCalls = new ConcurrentHashMap<>();
    private final Map<String, List<String>> pendingEndedCalls = new ConcurrentHashMap<>();
    
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
            notifyCallEnded(target, userId);
        }
        
        // Limpiar colas pendientes
        pendingIncomingCalls.remove(userId);
        pendingAcceptedCalls.remove(userId);
        pendingRejectedCalls.remove(userId);
        pendingEndedCalls.remove(userId);
        
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
            System.out.println("[AUDIO] 📤 " + fromUser + " → " + target + " (paquete #" + count + ", " + data.length + " bytes)");
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
        System.out.println("   ❌ Usuario OFFLINE: " + toUser);
        System.out.println("   📋 Usuarios conectados: " + observers.keySet());
        notifyCallRejected(fromUser, toUser);
        return;
    }
    
    // Verificar si el destinatario ya está en otra llamada
    if (activeCalls.containsKey(toUser)) {
        System.out.println("   ⚠️ Usuario ocupado: " + toUser);
        notifyCallRejected(fromUser, toUser);
        return;
    }
    
    // ✅ CRÍTICO: SIEMPRE agregar a cola de polling (sistema primario)
    System.out.println("   📥 Agregando a cola de polling...");
    addPendingIncomingCall(toUser, fromUser);
    System.out.println("   ✅ Llamada en cola para polling");
    
    // ✅ OPCIONAL: Intentar callback también (por si funciona)
    try {
        System.out.println("   📤 Intentando callback directo (opcional)...");
        destPrx.ice_oneway().incomingCallAsync(fromUser).whenComplete((result, ex) -> {
            if (ex != null) {
                System.err.println("   ⚠️ Callback falló (OK, usará polling): " + ex.getMessage());
            } else {
                System.out.println("   ✅ Callback enviado (bonus)");
            }
        });
    } catch (Exception e) {
        System.err.println("   ⚠️ Excepción en callback (OK, usará polling): " + e.getMessage());
    }
}
    
    @Override
    public synchronized void acceptCall(String fromUser, String toUser, Current current) {
        System.out.println("[AUDIO] ✅ Llamada aceptada:");
        System.out.println("   De: " + fromUser);
        System.out.println("   Por: " + toUser);
        
        // CRÍTICO: Establecer llamada BIDIRECCIONAL
        activeCalls.put(fromUser, toUser);
        activeCalls.put(toUser, fromUser);
        
        System.out.println("   📞 Llamada ACTIVA: " + fromUser + " ↔ " + toUser);
        
        // Notificar al llamante
        notifyCallAccepted(fromUser, toUser);
        
        // Resetear contadores de audio
        audioPacketCount.put(fromUser, 0L);
        audioPacketCount.put(toUser, 0L);
    }
    
    @Override
    public synchronized void rejectCall(String fromUser, String toUser, Current current) {
        System.out.println("[AUDIO] ❌ Llamada rechazada:");
        System.out.println("   De: " + fromUser);
        System.out.println("   Por: " + toUser);
        
        notifyCallRejected(fromUser, toUser);
    }
    
    @Override
    public synchronized void hangup(String fromUser, String toUser, Current current) {
        System.out.println("[AUDIO] 📞 Llamada finalizada:");
        System.out.println("   Por: " + fromUser);
        System.out.println("   Con: " + toUser);
        
        // Notificar a ambos usuarios
        notifyCallEnded(fromUser, fromUser);
        notifyCallEnded(toUser, fromUser);
        
        // Limpiar estado de llamada
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
    // ✅ MÉTODOS DE NOTIFICACIÓN (CON FALLBACK)
    // ============================================
    
    private void notifyCallRejected(String userId, String fromUser) {
    // SIEMPRE agregar a cola
    addPendingRejectedCall(userId, fromUser);
    
    // Intentar callback también
    AudioObserverPrx prx = observers.get(userId);
    if (prx != null) {
        try {
            prx.ice_oneway().callRejectedAsync(fromUser);
        } catch (Exception e) {
            // Silencioso, polling lo manejará
        }
    }
}
    
    private void notifyCallAccepted(String userId, String fromUser) {
    // SIEMPRE agregar a cola
    addPendingAcceptedCall(userId, fromUser);
    System.out.println("   ✅ Aceptación en cola para polling");
    
    // Intentar callback también
    AudioObserverPrx prx = observers.get(userId);
    if (prx != null) {
        try {
            prx.ice_oneway().callAcceptedAsync(fromUser);
            System.out.println("   📤 Callback de aceptación enviado");
        } catch (Exception e) {
            System.err.println("   ⚠️ Callback falló (OK, usará polling)");
        }
    }
}
    
    private void notifyCallEnded(String userId, String fromUser) {
    // SIEMPRE agregar a cola
    addPendingEndedCall(userId, fromUser);
    
    // Intentar callback también
    AudioObserverPrx prx = observers.get(userId);
    if (prx != null) {
        try {
            prx.ice_oneway().callEndedAsync(fromUser);
        } catch (Exception e) {
            // Silencioso, polling lo manejará
        }
    }
}
    
    // ============================================
    // ✅ MÉTODOS PARA POLLING (FALLBACK)
    // ============================================
    
    @Override
    public synchronized String[] getPendingIncomingCalls(String userId, Current current) {
        List<String> calls = pendingIncomingCalls.remove(userId);
        if (calls == null || calls.isEmpty()) {
            return new String[0];
        }
        System.out.println("[AUDIO] 📬 Entregando " + calls.size() + " llamadas pendientes a " + userId);
        return calls.toArray(new String[0]);
    }
    
    @Override
    public synchronized String[] getPendingAcceptedCalls(String userId, Current current) {
        List<String> calls = pendingAcceptedCalls.remove(userId);
        if (calls == null || calls.isEmpty()) {
            return new String[0];
        }
        System.out.println("[AUDIO] 📬 Entregando " + calls.size() + " aceptaciones pendientes a " + userId);
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
    // MÉTODOS AUXILIARES PARA COLAS
    // ============================================
    
    private void addPendingIncomingCall(String userId, String fromUser) {
        pendingIncomingCalls.computeIfAbsent(userId, k -> new ArrayList<>()).add(fromUser);
        System.out.println("   📥 Llamada agregada a queue de " + userId);
    }
    
    private void addPendingAcceptedCall(String userId, String fromUser) {
        pendingAcceptedCalls.computeIfAbsent(userId, k -> new ArrayList<>()).add(fromUser);
        System.out.println("   📥 Aceptación agregada a queue de " + userId);
    }
    
    private void addPendingRejectedCall(String userId, String fromUser) {
        pendingRejectedCalls.computeIfAbsent(userId, k -> new ArrayList<>()).add(fromUser);
    }
    
    private void addPendingEndedCall(String userId, String fromUser) {
        pendingEndedCalls.computeIfAbsent(userId, k -> new ArrayList<>()).add(fromUser);
    }
    
    // ============================================
    // UTILIDADES
    // ============================================
    
    @Override
    public String[] getConnectedUsers(Current current) {
        return observers.keySet().toArray(new String[0]);
    }
}