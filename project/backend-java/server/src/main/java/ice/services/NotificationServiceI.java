package ice.services;

import ChatSystem.*;
import com.zeroc.Ice.Current;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Servicio de notificaciones con POLLING
 * ✅ getNewMessages() devuelve mensajes pendientes
 */
public class NotificationServiceI implements NotificationService {
    
    // Mapa: usuario → cola de mensajes pendientes
    private final Map<String, Queue<Message>> pendingMessages = new ConcurrentHashMap<>();
    
    // Mapa: usuario → callbacks (opcional, para future use)
    private final Map<String, NotificationCallbackPrx> subscribers = new ConcurrentHashMap<>();
    
    public NotificationServiceI() {
        System.out.println("✅ NotificationServiceI inicializado");
    }
    
    // ========================================
    // SUSCRIPCIÓN (para future)
    // ========================================
    
    @Override
    public void subscribe(String username, NotificationCallbackPrx callback, Current current) {
        System.out.println("\n╔════════════════════════════════════╗");
        System.out.println("║  NUEVA SUSCRIPCIÓN                 ║");
        System.out.println("╠════════════════════════════════════╣");
        System.out.println("║  Usuario: " + String.format("%-24s", username) + "║");
        System.out.println("╚════════════════════════════════════╝");
        
        if (callback == null) {
            System.err.println("❌ Callback es null");
            return;
        }
        
        subscribers.put(username, callback);
        System.out.println("   ✅ Suscrito (callbacks)");
        System.out.println("   📊 Total suscritos: " + subscribers.size());
        System.out.println("");
    }
    
    @Override
    public void unsubscribe(String username, Current current) {
        subscribers.remove(username);
        System.out.println("👋 Usuario desuscrito: " + username);
    }
    
    // ========================================
    // ⭐ POLLING - MÉTODO PRINCIPAL
    // ========================================
    
    @Override
    public Message[] getNewMessages(String username, Current current) {
        // System.out.println("📬 [POLLING] " + username + " consultando mensajes...");
        
        Queue<Message> messages = pendingMessages.getOrDefault(username, new LinkedList<>());
        
        if (messages.isEmpty()) {
            return new Message[0];
        }
        
        // Obtener todos los mensajes pendientes
        Message[] result = messages.toArray(new Message[0]);
        
        // Limpiar cola
        messages.clear();
        
        if (result.length > 0) {
            System.out.println("📬 [POLLING] " + username + " recibe " + result.length + " mensaje(s)");
        }
        
        return result;
    }
    
    // ========================================
    // AGREGAR MENSAJE A LA COLA
    // ========================================
    
    /**
     * Llamado por ChatServiceI para encolar un mensaje
     */
    public void notifyNewMessage(String targetUser, Message msg) {
        System.out.println("\n🔔 ════════════════════════════════════");
        System.out.println("📢 ENCOLANDO MENSAJE");
        System.out.println("════════════════════════════════════");
        System.out.println("   🎯 Para: " + targetUser);
        System.out.println("   📤 De: " + msg.sender);
        System.out.println("   📝 Msg: " + msg.content.substring(0, Math.min(msg.content.length(), 40)));
        System.out.println("════════════════════════════════════");
        
        // Crear o obtener la cola del usuario
        Queue<Message> queue = pendingMessages.computeIfAbsent(targetUser, k -> new LinkedList<>());
        
        // Agregar el mensaje
        queue.add(msg);
        
        System.out.println("   ✅ Mensaje encolado");
        System.out.println("   📊 Cola de " + targetUser + ": " + queue.size() + " mensaje(s)");
        System.out.println("🔔 ════════════════════════════════════\n");
    }
    
    // ========================================
    // MÉTODOS NO USADOS (placeholder)
    // ========================================
    
    @Override
    public void markAsRead(String username, Current current) {
        // No implementado
    }
    
    // ========================================
    // DEBUG
    // ========================================
    
    public void printStats() {
        System.out.println("\n📊 ════════ ESTADÍSTICAS ════════");
        System.out.println("   Usuarios con mensajes pendientes: " + pendingMessages.size());
        for (Map.Entry<String, Queue<Message>> entry : pendingMessages.entrySet()) {
            System.out.println("   • " + entry.getKey() + ": " + entry.getValue().size() + " msg");
        }
        System.out.println("════════════════════════════════\n");
    }
}