package ice.services;
// Ubicación: backend-java/server/src/main/java/ice/services/ChatServiceI.java

import ChatSystem.*;
import com.zeroc.Ice.Current;
import tcp.MessageService;
import tcp.HistoryService;

import java.util.List;

/**
 * Implementación ICE del servicio de chat
 * ✅ CON NOTIFICACIONES EN TIEMPO REAL
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
        System.out.println("✅ NotificationService inyectado en ChatServiceI");
    }

    @Override
    public String sendPrivateMessage(String sender, String recipient, String message, Current current) {
        System.out.println("\n╔════════════════════════════════════════╗");
        System.out.println("║   MENSAJE PRIVADO                      ║");
        System.out.println("╠════════════════════════════════════════╣");
        System.out.println("║  De:      " + sender);
        System.out.println("║  Para:    " + recipient);
        System.out.println("║  Mensaje: " + message.substring(0, Math.min(message.length(), 50)));
        System.out.println("╚════════════════════════════════════════╝");
        
        // 1. Guardar mensaje usando lógica existente
        String result = messageService.sendPrivateMessage(sender, recipient, message);
        
       // En ChatServiceI.java - sendPrivateMessage()

if (result.startsWith("SUCCESS")) {
    System.out.println("   ✅ Mensaje guardado");
    
    if (notificationService != null) {
        try {
            Message msg = new Message();
            msg.sender = sender;
            msg.recipient = recipient;
            msg.content = message;
            msg.type = "TEXT";
            msg.timestamp = java.time.LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            msg.isGroup = false;
            
            // ✅ Encolar el mensaje (NO llamar callback)
            notificationService.notifyNewMessage(recipient, msg);
            System.out.println("   ✅ Mensaje encolado para polling");
            
        } catch (Exception e) {
            System.err.println("   ⚠️ Error: " + e.getMessage());
        }
    }
}
        
        return result;
    }

    @Override
    public String sendGroupMessage(String sender, String groupName, String message, Current current) {
        System.out.println("\n╔════════════════════════════════════════╗");
        System.out.println("║   MENSAJE GRUPAL                       ║");
        System.out.println("╠════════════════════════════════════════╣");
        System.out.println("║  De:    " + sender);
        System.out.println("║  Grupo: " + groupName);
        System.out.println("║  Msg:   " + message.substring(0, Math.min(message.length(), 50)));
        System.out.println("╚════════════════════════════════════════╝");
        
        // 1. Guardar mensaje
        String result = messageService.sendGroupMessage(sender, groupName, message);
        
        // 2. Notificar a todos los miembros del grupo (excepto al emisor)
        if (result.startsWith("SUCCESS") && notificationService != null) {
            try {
                // Crear objeto Message
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
                System.out.println("   👥 Miembros del grupo: " + members.size());
                
                int notified = 0;
                for (String member : members) {
                    if (!member.equals(sender)) {
                        System.out.println("   📢 Notificando a: " + member);
                        notificationService.notifyNewMessage(member, msg);
                        notified++;
                    }
                }
                
                System.out.println("   ✅ " + notified + " notificaciones enviadas");
                
            } catch (Exception e) {
                System.err.println("   ⚠️ Error enviando notificaciones: " + e.getMessage());
                e.printStackTrace();
            }
        } else if (notificationService == null) {
            System.out.println("   ⚠️ NotificationService NO disponible");
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