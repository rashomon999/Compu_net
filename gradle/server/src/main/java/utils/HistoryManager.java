package utils;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.*;
import java.lang.reflect.Type;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

public class HistoryManager {
    private static final String HISTORY_FILE = "chat_history.json";
    private static final String GROUPS_FILE = "groups.json";
    
    private List<ChatMessage> messages;
    private Map<String, Group> groups;
    private AudioFileManager audioManager;
    private Gson gson;

    public HistoryManager() {
        this.gson = new GsonBuilder()
                .setPrettyPrinting()
                .create();
        this.audioManager = new AudioFileManager();
        
        this.messages = loadMessages();
        this.groups = loadGroups();
        
        System.out.println("✓ Historial cargado: " + messages.size() + " mensajes");
        System.out.println("✓ Grupos cargados: " + groups.size() + " grupos\n");
    }

    // ========== MENSAJES DE TEXTO ==========
    
    public void saveMessage(String sender, String recipient, String type, String content, boolean isGroup) {
        ChatMessage msg = new ChatMessage(sender, recipient, type, content, isGroup);
        messages.add(msg);
        persistMessages();
        
        System.out.println("[💾] " + msg);
    }

    // ========== MENSAJES DE VOZ ==========
    
    /**
     * Guarda un mensaje de voz con persistencia de archivo de audio
     */
    public void saveVoiceMessage(String sender, String recipient, byte[] audioData, boolean isGroup) {
        try {
            // Guardar archivo de audio
            String audioFilename = audioManager.saveAudio(audioData, sender, recipient);
            
            if (audioFilename != null) {
                // Crear mensaje con referencia al archivo
                String content = "[AUDIO_FILE:" + audioFilename + "]";
                ChatMessage msg = new ChatMessage(sender, recipient, "VOICE", content, isGroup);
                messages.add(msg);
                persistMessages();
                
                String icon = isGroup ? "👥" : "💬";
                String prefix = isGroup ? "[GRUPO: " + recipient + "]" : "[PRIVADO]";
                System.out.println("[💾] " + icon + " " + prefix + " [VOZ] " + 
                                 sender + " → " + recipient + 
                                 " (" + audioData.length + " bytes)");
            }
        } catch (Exception e) {
            System.err.println("❌ Error guardando mensaje de voz: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * Recupera el audio de un mensaje de voz guardado
     */
    public byte[] getAudioFromMessage(ChatMessage msg) {
        if (msg.type.equals("VOICE") && msg.content.startsWith("[AUDIO_FILE:")) {
            String filename = msg.content.replaceAll("\\[AUDIO_FILE:|\\]", "");
            return audioManager.loadAudio(filename);
        }
        return null;
    }

    // ========== HISTORIAL GENERAL ==========
    
    public List<ChatMessage> getConversationHistory(String user1, String user2) {
        return messages.stream()
                .filter(msg -> !msg.isGroup && (
                    (msg.sender.equals(user1) && msg.recipient.equals(user2)) ||
                    (msg.sender.equals(user2) && msg.recipient.equals(user1))
                ))
                .collect(Collectors.toList());
    }

    public List<ChatMessage> getGroupHistory(String groupName) {
        return messages.stream()
                .filter(msg -> msg.isGroup && msg.recipient.equals(groupName))
                .collect(Collectors.toList());
    }

    public List<ChatMessage> getAllMessages() {
        return new ArrayList<>(messages);
    }
    
    /**
     * Obtiene todos los mensajes de un usuario (enviados y recibidos)
     */
    public List<ChatMessage> getUserMessages(String username) {
        return messages.stream()
                .filter(msg -> msg.sender.equals(username) || msg.recipient.equals(username))
                .collect(Collectors.toList());
    }
    
    /**
     * Obtiene solo mensajes de voz
     */
    public List<ChatMessage> getVoiceMessages() {
        return messages.stream()
                .filter(msg -> msg.type.equals("VOICE"))
                .collect(Collectors.toList());
    }

    private void persistMessages() {
        try (Writer writer = new FileWriter(HISTORY_FILE)) {
            gson.toJson(messages, writer);
        } catch (IOException e) {
            System.err.println("❌ Error guardando mensajes: " + e.getMessage());
        }
    }

    private List<ChatMessage> loadMessages() {
        File file = new File(HISTORY_FILE);
        if (!file.exists()) {
            return new ArrayList<>();
        }

        try (Reader reader = new FileReader(HISTORY_FILE)) {
            Type listType = new TypeToken<ArrayList<ChatMessage>>(){}.getType();
            List<ChatMessage> loaded = gson.fromJson(reader, listType);
            return loaded != null ? loaded : new ArrayList<>();
        } catch (IOException e) {
            System.err.println("⚠️  Error cargando historial: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    // ========== GRUPOS ==========
    
    public boolean createGroup(String groupName, String creator) {
        if (groups.containsKey(groupName)) {
            return false;
        }
        
        Group group = new Group(groupName, creator);
        groups.put(groupName, group);
        persistGroups();
        System.out.println("[📁] Grupo creado: " + groupName + " por " + creator);
        return true;
    }

    public boolean addUserToGroup(String groupName, String username) {
        Group group = groups.get(groupName);
        if (group == null) {
            return false;
        }
        
        if (!group.members.contains(username)) {
            group.members.add(username);
            persistGroups();
            System.out.println("[📁] " + username + " añadido a " + groupName);
        }
        return true;
    }

    public List<String> getGroupMembers(String groupName) {
        Group group = groups.get(groupName);
        return group != null ? new ArrayList<>(group.members) : new ArrayList<>();
    }

    public Set<String> getAllGroups() {
        return groups.keySet();
    }

    public boolean groupExists(String groupName) {
        return groups.containsKey(groupName);
    }

    private void persistGroups() {
        try (Writer writer = new FileWriter(GROUPS_FILE)) {
            gson.toJson(groups, writer);
        } catch (IOException e) {
            System.err.println("❌ Error guardando grupos: " + e.getMessage());
        }
    }

    private Map<String, Group> loadGroups() {
        File file = new File(GROUPS_FILE);
        if (!file.exists()) {
            return new HashMap<>();
        }

        try (Reader reader = new FileReader(GROUPS_FILE)) {
            Type mapType = new TypeToken<HashMap<String, Group>>(){}.getType();
            Map<String, Group> loaded = gson.fromJson(reader, mapType);
            return loaded != null ? loaded : new HashMap<>();
        } catch (IOException e) {
            System.err.println("⚠️  Error cargando grupos: " + e.getMessage());
            return new HashMap<>();
        }
    }

    // ========== CLASES INTERNAS ==========
    
    public static class ChatMessage {
        public String sender;
        public String recipient;
        public String type; // "TEXT", "VOICE"
        public String content;
        public boolean isGroup;
        public String timestamp;

        public ChatMessage(String sender, String recipient, String type, String content, boolean isGroup) {
            this.sender = sender;
            this.recipient = recipient;
            this.type = type;
            this.content = content;
            this.isGroup = isGroup;
            this.timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        }

        @Override
        public String toString() {
            String icon = isGroup ? "👥" : "💬";
            String prefix = isGroup ? "[GRUPO: " + recipient + "]" : "[PRIVADO]";
            String msgContent = type.equals("VOICE") ? "🎤 [NOTA DE VOZ]" : content;
            return String.format("%s %s [%s] %s → %s: %s", icon, prefix, timestamp, sender, recipient, msgContent);
        }
    }

    public static class Group {
        public String name;
        public String creator;
        public Set<String> members;
        public String createdAt;

        public Group(String name, String creator) {
            this.name = name;
            this.creator = creator;
            this.members = new HashSet<>();
            this.members.add(creator);
            this.createdAt = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        }
    }
}