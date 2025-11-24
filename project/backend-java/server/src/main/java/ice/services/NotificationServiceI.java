package ice.services;
// Ubicación: backend-java/server/src/main/java/ice/services/NotificationServiceI.java

import ChatSystem.*;
import com.zeroc.Ice.Current;
import tcp.HistoryService;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Implementación ICE del servicio de notificaciones
 * Patrón Observer: Los clientes se suscriben y reciben notificaciones push
 */
public class NotificationServiceI implements NotificationService {
    private final HistoryService historyService;
    
    // Mapa de callbacks de clientes suscritos
    private final Map<String, NotificationCallbackPrx> subscribers = new ConcurrentHashMap<>();

    public NotificationServiceI(HistoryService historyService) {
        this.historyService = historyService;
    }

    @Override
    public void subscribe(String username, NotificationCallbackPrx callback, Current current) {
        subscribers.put(username, callback);
        System.out.println("[ICE] 🔔 Usuario suscrito a notificaciones: " + username);
        
        // Inicializar timestamp para este usuario en HistoryService
        historyService.initializeUser(username);
    }

    @Override
    public void unsubscribe(String username, Current current) {
        subscribers.remove(username);
        System.out.println("[ICE] 🔕 Usuario desuscrito: " + username);
    }

    @Override
    public Message[] getNewMessages(String username, Current current) {
        try {
            // Obtener mensajes nuevos desde HistoryService
            List<Map<String, String>> newMessages = historyService.getNewMessages(username);
            
            if (!newMessages.isEmpty()) {
                System.out.println("[ICE] 📬 " + username + " tiene " + newMessages.size() + " mensajes nuevos");
            }
            
            // Convertir a formato ICE Message
            return newMessages.stream()
                .map(msgData -> {
                    Message msg = new Message();
                    msg.sender = msgData.get("from");
                    msg.recipient = msgData.get("to");
                    msg.content = msgData.get("message");
                    msg.type = msgData.get("type");
                    msg.timestamp = msgData.get("timestamp");
                    msg.isGroup = Boolean.parseBoolean(msgData.get("isGroup"));
                    return msg;
                })
                .toArray(Message[]::new);
                
        } catch (Exception e) {
            System.err.println("[ERROR] Error obteniendo mensajes nuevos: " + e.getMessage());
            return new Message[0];
        }
    }

    @Override
    public void markAsRead(String username, Current current) {
        historyService.markAsRead(username);
        System.out.println("[ICE] ✅ Mensajes marcados como leídos: " + username);
    }
    
    /**
     * Método interno para enviar notificaciones push
     * Llamado por ChatServiceI cuando llega un mensaje nuevo
     */
    public void notifyNewMessage(String recipient, Message msg) {
        NotificationCallbackPrx callback = subscribers.get(recipient);
        
        if (callback != null) {
            try {
                // Enviar notificación asíncrona al cliente
                callback.onNewMessageAsync(msg).whenComplete((result, ex) -> {
                    if (ex != null) {
                        System.err.println("[WARN] Error notificando a " + recipient + ": " + ex.getMessage());
                        // Remover suscriptor si hay error (cliente desconectado)
                        subscribers.remove(recipient);
                    } else {
                        System.out.println("[PUSH] 🔔 Notificación enviada a " + recipient);
                    }
                });
                
            } catch (Exception e) {
                System.err.println("[ERROR] Error en notificación push: " + e.getMessage());
                subscribers.remove(recipient);
            }
        } else {
            System.out.println("[INFO] Usuario " + recipient + " no está suscrito a notificaciones");
        }
    }
    
    /**
     * Notificar cuando se crea un grupo
     */
    public void notifyGroupCreated(String groupName, String creator, List<String> members) {
        for (String member : members) {
            NotificationCallbackPrx callback = subscribers.get(member);
            if (callback != null) {
                try {
                    callback.onGroupCreatedAsync(groupName, creator);
                } catch (Exception e) {
                    System.err.println("[ERROR] Error notificando creación de grupo: " + e.getMessage());
                }
            }
        }
    }
    
    /**
     * Notificar cuando alguien se une a un grupo
     */
    public void notifyUserJoinedGroup(String groupName, String username, List<String> members) {
        for (String member : members) {
            if (!member.equals(username)) { // No notificar al que se unió
                NotificationCallbackPrx callback = subscribers.get(member);
                if (callback != null) {
                    try {
                        callback.onUserJoinedGroupAsync(groupName, username);
                    } catch (Exception e) {
                        System.err.println("[ERROR] Error notificando unión a grupo: " + e.getMessage());
                    }
                }
            }
        }
    }
}