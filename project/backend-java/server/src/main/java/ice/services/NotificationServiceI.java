package ice.services;
// Ubicación: backend-java/server/src/main/java/ice/services/NotificationServiceI.java

import ChatSystem.*;
import com.zeroc.Ice.Current;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Servicio de notificaciones push en tiempo real
 * ✅ IMPLEMENTACIÓN COMPLETA CON CALLBACKS
 */
public class NotificationServiceI implements NotificationService {
    
    // Mapa de usuarios suscritos → callbacks
    private final Map<String, NotificationCallbackPrx> subscribers = new ConcurrentHashMap<>();
    
    public NotificationServiceI() {
        System.out.println("✅ NotificationServiceI inicializado");
    }
    
    // ========================================
    // SUSCRIPCIÓN
    // ========================================
    
    @Override
    public void subscribe(String username, NotificationCallbackPrx callback, Current current) {
        System.out.println("\n╔════════════════════════════════════════╗");
        System.out.println("║  NUEVA SUSCRIPCIÓN                     ║");
        System.out.println("╠════════════════════════════════════════╣");
        System.out.println("║  Usuario: " + username.padEnd(30) + "║");
        System.out.println("╚════════════════════════════════════════╝");
        
        if (callback == null) {
            System.err.println("❌ Callback es null, no se puede suscribir");
            return;
        }
        
        // Guardar el callback
        subscribers.put(username, callback);
        
        System.out.println("   ✅ Usuario suscrito a notificaciones");
        System.out.println("   📊 Total suscritos: " + subscribers.size());
        System.out.println("   👥 Usuarios activos: " + subscribers.keySet());
        System.out.println("");
    }
    
    @Override
    public void unsubscribe(String username, Current current) {
        System.out.println("📕 [NOTIF] Usuario desuscrito: " + username);
        subscribers.remove(username);
        System.out.println("   📊 Total suscritos: " + subscribers.size());
    }
    
    // ========================================
    // 🔥 NOTIFICAR MENSAJE (LLAMADO POR ChatServiceI)
    // ========================================
    
    /**
     * Notifica a UN usuario específico sobre un mensaje nuevo
     * Este método es llamado por ChatServiceI cuando se envía un mensaje
     */
    public void notifyNewMessage(String targetUser, Message msg) {
        System.out.println("\n🔔 ════════════════════════════════════════");
        System.out.println("📢 NOTIFICANDO MENSAJE NUEVO");
        System.out.println("════════════════════════════════════════");
        System.out.println("   🎯 Para:    " + targetUser);
        System.out.println("   📤 De:      " + msg.sender);
        System.out.println("   📝 Mensaje: " + msg.content.substring(0, Math.min(msg.content.length(), 50)));
        System.out.println("   👥 Grupo:   " + msg.isGroup);
        System.out.println("════════════════════════════════════════");
        
        // 1. Verificar si el usuario está suscrito
        NotificationCallbackPrx callback = subscribers.get(targetUser);
        
        if (callback == null) {
            System.out.println("   ⚠️ Usuario NO está suscrito (sin callback)");
            System.out.println("   📊 Usuarios suscritos actuales: " + subscribers.keySet());
            System.out.println("🔔 ════════════════════════════════════════\n");
            return;
        }
        
        System.out.println("   ✅ Usuario SÍ está suscrito");
        
        // 2. Enviar notificación al callback
        try {
            System.out.println("   📡 Invocando callback.onNewMessage()...");
            callback.onNewMessage(msg);
            System.out.println("   ✅ Callback ejecutado exitosamente");
            
        } catch (Exception e) {
            System.err.println("   ❌ Error enviando notificación:");
            System.err.println("      " + e.getClass().getSimpleName() + ": " + e.getMessage());
            e.printStackTrace();
            
            // Si el callback falló, remover al usuario
            System.out.println("   🗑️ Removiendo callback inválido");
            subscribers.remove(targetUser);
        }
        
        System.out.println("🔔 ════════════════════════════════════════\n");
    }
    
    /**
     * Notifica creación de grupo a TODOS los usuarios suscritos
     */
    public void notifyGroupCreated(String groupName, String creator) {
        System.out.println("📢 [NOTIF BROADCAST] Grupo creado: " + groupName + " por " + creator);
        System.out.println("   👥 Notificando a " + subscribers.size() + " usuarios...");
        
        int notified = 0;
        for (Map.Entry<String, NotificationCallbackPrx> entry : subscribers.entrySet()) {
            try {
                entry.getValue().onGroupCreated(groupName, creator);
                notified++;
            } catch (Exception e) {
                System.err.println("   ⚠️ Error notificando a " + entry.getKey());
                subscribers.remove(entry.getKey());
            }
        }
        
        System.out.println("   ✅ " + notified + " usuarios notificados");
    }
    
    /**
     * Notifica que un usuario se unió a un grupo
     */
    public void notifyUserJoinedGroup(String groupName, String username) {
        System.out.println("📢 [NOTIF BROADCAST] " + username + " se unió a " + groupName);
        System.out.println("   👥 Notificando a " + subscribers.size() + " usuarios...");
        
        int notified = 0;
        for (Map.Entry<String, NotificationCallbackPrx> entry : subscribers.entrySet()) {
            try {
                entry.getValue().onUserJoinedGroup(groupName, username);
                notified++;
            } catch (Exception e) {
                System.err.println("   ⚠️ Error notificando a " + entry.getKey());
                subscribers.remove(entry.getKey());
            }
        }
        
        System.out.println("   ✅ " + notified + " usuarios notificados");
    }
    
    // ========================================
    // POLLING (FALLBACK - NO RECOMENDADO)
    // ========================================
    
    @Override
    public Message[] getNewMessages(String username, Current current) {
        // Este método es para polling, no lo usamos
        System.out.println("⚠️ [NOTIF] getNewMessages() llamado (polling no recomendado)");
        return new Message[0];
    }
    
    @Override
    public void markAsRead(String username, Current current) {
        // No implementado
    }
    
    // ========================================
    // DEBUG
    // ========================================
    
    /**
     * Método de debug para verificar suscriptores
     */
    public void printSubscribers() {
        System.out.println("\n📊 ════════ SUSCRIPTORES ACTIVOS ════════");
        System.out.println("   Total: " + subscribers.size());
        for (String user : subscribers.keySet()) {
            System.out.println("   • " + user);
        }
        System.out.println("════════════════════════════════════════\n");
    }
    
    /**
     * Obtiene el número de usuarios suscritos
     */
    public int getSubscriberCount() {
        return subscribers.size();
    }
}