package ice.services;
// Ubicación: backend-java/server/src/main/java/ice/services/VoiceServiceI.java

import ChatSystem.*;
import com.zeroc.Ice.Current;
import utils.HistoryManager;

import java.util.Base64;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Implementación ICE del servicio de notas de voz
 * Maneja grabación, almacenamiento y recuperación de audios
 */
public class VoiceServiceI implements VoiceService {
    private final HistoryManager historyManager;
    private final NotificationServiceI notificationService;

    public VoiceServiceI(HistoryManager historyManager, NotificationServiceI notificationService) {
        this.historyManager = historyManager;
        this.notificationService = notificationService;
    }

    @Override
    public String saveVoiceNote(String sender, String target, String audioDataBase64, boolean isGroup, Current current) {
        try {
            System.out.println("[ICE] 🎤 Guardando nota de voz:");
            System.out.println("   Emisor: " + sender);
            System.out.println("   Receptor: " + target);
            System.out.println("   Tipo: " + (isGroup ? "Grupo" : "Privado"));
            System.out.println("   Tamaño Base64: " + audioDataBase64.length() + " chars");
            
            // Decodificar audio desde Base64
            byte[] audioData = Base64.getDecoder().decode(audioDataBase64);
            System.out.println("   Tamaño decodificado: " + audioData.length + " bytes");
            
            // Validar tamaño
            if (audioData.length < 100) {
                return "ERROR: Audio demasiado corto (menos de 100 bytes)";
            }
            
            if (audioData.length > 10_000_000) { // 10 MB máximo
                return "ERROR: Audio demasiado grande (máximo 10 MB)";
            }
            
            // Guardar usando HistoryManager existente
            // Esto automáticamente:
            // 1. Guarda el archivo de audio en disco con timestamp único
            // 2. Registra en chat_history.json con referencia al archivo
            historyManager.saveVoiceMessage(sender, target, audioData, isGroup);
            
            System.out.println("   ✅ Nota de voz guardada exitosamente");
            
            // Notificar al destinatario
            if (notificationService != null) {
                Message msg = new Message();
                msg.sender = sender;
                msg.recipient = target;
                msg.content = "🎤 Nota de voz";
                msg.type = "VOICE";
                msg.timestamp = java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                msg.isGroup = isGroup;
                
                if (isGroup) {
                    // Notificar a todos los miembros del grupo
                    List<String> members = historyManager.getGroupMembers(target);
                    for (String member : members) {
                        if (!member.equals(sender)) {
                            notificationService.notifyNewMessage(member, msg);
                        }
                    }
                } else {
                    // Notificar solo al destinatario
                    notificationService.notifyNewMessage(target, msg);
                }
            }
            
            return "SUCCESS: Nota de voz guardada correctamente";
            
        } catch (IllegalArgumentException e) {
            System.err.println("[ERROR] Base64 inválido: " + e.getMessage());
            return "ERROR: Formato de audio inválido (Base64 corrupto)";
        } catch (Exception e) {
            System.err.println("[ERROR] Error guardando nota de voz: " + e.getMessage());
            e.printStackTrace();
            return "ERROR: " + e.getMessage();
        }
    }

    @Override
    public String getVoiceNote(String audioFileRef, Current current) {
        try {
            System.out.println("[ICE] 🔊 Recuperando nota de voz: " + audioFileRef);
            
            // Buscar el mensaje de voz en el historial
            List<HistoryManager.ChatMessage> allMessages = historyManager.getAllMessages();
            
            for (HistoryManager.ChatMessage msg : allMessages) {
                if ("VOICE".equals(msg.type) && msg.content.contains(audioFileRef)) {
                    // Cargar audio usando HistoryManager
                    byte[] audioData = historyManager.getAudioFromMessage(msg);
                    
                    if (audioData != null && audioData.length > 0) {
                        // Codificar a Base64 para enviar al navegador
                        String base64Audio = Base64.getEncoder().encodeToString(audioData);
                        System.out.println("   ✅ Audio recuperado: " + audioData.length + " bytes");
                        return base64Audio;
                    } else {
                        System.err.println("   ⚠️  Archivo de audio no encontrado o vacío");
                        return "";
                    }
                }
            }
            
            System.err.println("   ⚠️  Referencia de audio no encontrada en historial");
            return "";
            
        } catch (Exception e) {
            System.err.println("[ERROR] Error recuperando nota de voz: " + e.getMessage());
            e.printStackTrace();
            return "";
        }
    }

    @Override
    public VoiceNote[] getVoiceNotesHistory(String user1, String user2, Current current) {
        try {
            System.out.println("[ICE] 📜 Historial de notas de voz: " + user1 + " ↔ " + user2);
            
            // Obtener historial de conversación
            List<HistoryManager.ChatMessage> messages = 
                historyManager.getConversationHistory(user1, user2);
            
            // Filtrar solo mensajes de voz
            List<VoiceNote> voiceNotes = messages.stream()
                .filter(msg -> "VOICE".equals(msg.type))
                .map(msg -> {
                    VoiceNote note = new VoiceNote();
                    note.id = extractFilename(msg.content);
                    note.sender = msg.sender;
                    note.target = msg.recipient;
                    note.audioFileRef = extractFilename(msg.content);
                    note.isGroup = msg.isGroup;
                    note.timestamp = msg.timestamp;
                    note.durationSeconds = 0; // Podría calcularse si se necesita
                    return note;
                })
                .collect(Collectors.toList());
            
            System.out.println("   → " + voiceNotes.size() + " notas de voz encontradas");
            return voiceNotes.toArray(new VoiceNote[0]);
                
        } catch (Exception e) {
            System.err.println("[ERROR] Error obteniendo historial de voz: " + e.getMessage());
            return new VoiceNote[0];
        }
    }

    @Override
    public VoiceNote[] getGroupVoiceNotes(String groupName, Current current) {
        try {
            System.out.println("[ICE] 📜 Notas de voz del grupo: " + groupName);
            
            // Obtener historial del grupo
            List<HistoryManager.ChatMessage> messages = 
                historyManager.getGroupHistory(groupName);
            
            // Filtrar solo mensajes de voz
            List<VoiceNote> voiceNotes = messages.stream()
                .filter(msg -> "VOICE".equals(msg.type))
                .map(msg -> {
                    VoiceNote note = new VoiceNote();
                    note.id = extractFilename(msg.content);
                    note.sender = msg.sender;
                    note.target = msg.recipient;
                    note.audioFileRef = extractFilename(msg.content);
                    note.isGroup = msg.isGroup;
                    note.timestamp = msg.timestamp;
                    note.durationSeconds = 0;
                    return note;
                })
                .collect(Collectors.toList());
            
            System.out.println("   → " + voiceNotes.size() + " notas de voz encontradas");
            return voiceNotes.toArray(new VoiceNote[0]);
                
        } catch (Exception e) {
            System.err.println("[ERROR] Error obteniendo notas de voz del grupo: " + e.getMessage());
            return new VoiceNote[0];
        }
    }
    
    /**
     * Extrae el nombre del archivo de audio del contenido del mensaje
     * Formato: [AUDIO_FILE:filename.wav]
     */
    private String extractFilename(String content) {
        if (content != null && content.startsWith("[AUDIO_FILE:") && content.endsWith("]")) {
            return content.substring(12, content.length() - 1);
        }
        return "";
    }
}