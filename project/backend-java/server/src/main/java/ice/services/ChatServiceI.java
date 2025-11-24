package ice.services;
// Ubicación: backend-java/server/src/main/java/ice/services/ChatServiceI.java

import ChatSystem.*;
import com.zeroc.Ice.Current;
import tcp.MessageService;
import tcp.HistoryService;

import java.util.List;

/**
 * Implementación ICE del servicio de chat
 * Reutiliza la lógica existente de MessageService y HistoryService
 */
public class ChatServiceI implements ChatService {
    private final MessageService messageService;
    private final HistoryService historyService;
    private NotificationServiceI notificationService;

    public ChatServiceI(MessageService messageService, HistoryService historyService) {
        this.messageService = messageService;
        this.historyService = historyService;
    }
    
    /**
     * Inyectar servicio de notificaciones para enviar push
     */
    public void setNotificationService(NotificationServiceI notificationService) {
        this.notificationService = notificationService;
    }

    @Override
    public String sendPrivateMessage(String sender, String recipient, String message, Current current) {
        System.out.println("[ICE] 💬 Mensaje privado: " + sender + " → " + recipient);
        
        // Enviar mensaje usando lógica existente
        String result = messageService.sendPrivateMessage(sender, recipient, message);
        
        // Si fue exitoso y hay servicio de notificaciones, enviar push
        if (result.startsWith("SUCCESS") && notificationService != null) {
            Message msg = new Message();
            msg.sender = sender;
            msg.recipient = recipient;
            msg.content = message;
            msg.type = "TEXT";
            msg.timestamp = java.time.LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            msg.isGroup = false;
            
            notificationService.notifyNewMessage(recipient, msg);
        }
        
        return result;
    }

    @Override
    public String sendGroupMessage(String sender, String groupName, String message, Current current) {
        System.out.println("[ICE] 👥 Mensaje grupal: " + sender + " → " + groupName);
        
        String result = messageService.sendGroupMessage(sender, groupName, message);
        
        // Notificar a todos los miembros del grupo
        if (result.startsWith("SUCCESS") && notificationService != null) {
            Message msg = new Message();
            msg.sender = sender;
            msg.recipient = groupName;
            msg.content = message;
            msg.type = "TEXT";
            msg.timestamp = java.time.LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            msg.isGroup = true;
            
            // Obtener miembros y notificar a cada uno (excepto al emisor)
            List<String> members = historyService.getHistoryManager().getGroupMembers(groupName);
            for (String member : members) {
                if (!member.equals(sender)) {
                    notificationService.notifyNewMessage(member, msg);
                }
            }
        }
        
        return result;
    }

    @Override
    public String getConversationHistory(String user1, String user2, Current current) {
        System.out.println("[ICE] 📜 Historial: " + user1 + " ↔ " + user2);
        return historyService.getConversationHistory(user1, user2);
    }

    @Override
    public String getGroupHistory(String groupName, String username, Current current) {
        System.out.println("[ICE] 📜 Historial grupal: " + groupName + " (usuario: " + username + ")");
        
        // Verificar membresía antes de devolver historial
        List<String> members = historyService.getHistoryManager().getGroupMembers(groupName);
        
        if (!members.contains(username)) {
            return "ERROR: No eres miembro de este grupo";
        }
        
        return historyService.getGroupHistory(groupName);
    }

    @Override
    public String[] getRecentConversations(String username, Current current) {
        System.out.println("[ICE] 📋 Conversaciones recientes: " + username);
        List<String> conversations = historyService.getRecentConversations(username);
        return conversations.toArray(new String[0]);
    }
}