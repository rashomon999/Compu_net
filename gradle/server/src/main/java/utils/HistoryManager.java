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

/**
 * {@code HistoryManager} gestiona el historial de chat (mensajes de texto y voz)
 * y la administración de grupos. Además, persiste la información en formato JSON.
 *
 * Funciones principales:
 *
 *   Guardar y recuperar mensajes de texto o voz
 *   Manejar grupos (creación, membresías, eliminación)
 *   Persistencia de datos en archivos JSON
 *   Gestión de archivos de audio asociados
 *
 * Archivos generados:
 * 
 *   {@code chat_history.json} → historial general
 *   {@code groups.json} → datos de grupos
 */
public class HistoryManager {
    private static final String HISTORY_FILE = "chat_history.json";
    private static final String GROUPS_FILE = "groups.json";
    
    private List<ChatMessage> messages;
    private Map<String, Group> groups;
    private AudioFileManager audioManager;
    private Gson gson;

    /**
     * Constructor principal.
     * Carga los historiales y grupos desde disco, o los inicializa vacíos si no existen.
     */
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
    
    // Guarda un mensaje de texto en el historial y lo persiste en disco.
    public void saveMessage(String sender, String recipient, String type, String content, boolean isGroup) {
        ChatMessage msg = new ChatMessage(sender, recipient, type, content, isGroup);
        messages.add(msg);
        persistMessages();
        
        System.out.println(  msg);
    }

    // ========== MENSAJES DE VOZ ==========
    
    //Guarda un mensaje de voz, almacenando su archivo de audio en disco.
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
                
           
                String prefix = isGroup ? "[GRUPO: " + recipient + "]" : "[PRIVADO]";
                System.out.println(  prefix + " [VOZ] " + 
                                 sender + " → " + recipient + 
                                 " (" + audioData.length + " bytes)");
            }
        } catch (Exception e) {
            System.err.println(" Error guardando mensaje de voz: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    // Recupera el audio de un mensaje de voz guardado

    public byte[] getAudioFromMessage(ChatMessage msg) {
        if (msg.type.equals("VOICE") && msg.content.startsWith("[AUDIO_FILE:")) {
            String filename = msg.content.replaceAll("\\[AUDIO_FILE:|\\]", "");
            return audioManager.loadAudio(filename);
        }
        return null;
    }

    // ========== HISTORIAL GENERAL ==========
    
    //Obtiene la conversación entre dos usuarios.
    public List<ChatMessage> getConversationHistory(String user1, String user2) {
        return messages.stream()
                .filter(msg -> !msg.isGroup && (
                    (msg.sender.equals(user1) && msg.recipient.equals(user2)) ||
                    (msg.sender.equals(user2) && msg.recipient.equals(user1))
                ))
                .collect(Collectors.toList());
    }

    //Obtiene el historial de mensajes de un grupo.
    public List<ChatMessage> getGroupHistory(String groupName) {
        return messages.stream()
                .filter(msg -> msg.isGroup && msg.recipient.equals(groupName))
                .collect(Collectors.toList());
    }

    //Devuelve todos los mensajes registrados.
    public List<ChatMessage> getAllMessages() {
        return new ArrayList<>(messages);
    }
    
    //Devuelve todos los mensajes enviados o recibidos por un usuario.
    public List<ChatMessage> getUserMessages(String username) {
        return messages.stream()
                .filter(msg -> msg.sender.equals(username) || msg.recipient.equals(username))
                .collect(Collectors.toList());
    }
    
    //Devuelve todos los mensajes de tipo voz.
    public List<ChatMessage> getVoiceMessages() {
        return messages.stream()
                .filter(msg -> msg.type.equals("VOICE"))
                .collect(Collectors.toList());
    }

    // ======================================================================
    // PERSISTENCIA
    // ======================================================================

    //Guarda el historial actual de mensajes en disco.
    private void persistMessages() {
        try (Writer writer = new FileWriter(HISTORY_FILE)) {
            gson.toJson(messages, writer);
        } catch (IOException e) {
            System.err.println(" Error guardando mensajes: " + e.getMessage());
        }
    }

    //Carga el historial desde el archivo JSON.
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
            System.err.println("  Error cargando historial: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    // ======================================================================
    // GESTIÓN DE GRUPOS
    // ======================================================================
    
    //Crea un nuevo grupo.
    public boolean createGroup(String groupName, String creator) {
        if (groups.containsKey(groupName)) {
            return false;
        }
        
        Group group = new Group(groupName, creator);
        groups.put(groupName, group);
        persistGroups();
        System.out.println(" Grupo creado: " + groupName + " por " + creator);
        return true;
    }

    //Agrega un usuario a un grupo existente.
    public boolean addUserToGroup(String groupName, String username) {
        Group group = groups.get(groupName);
        if (group == null) {
            return false;
        }
        
        if (!group.members.contains(username)) {
            group.members.add(username);
            persistGroups();
            System.out.println( username + " añadido a " + groupName);
        }
        return true;
    }

    //Elimina un usuario de un grupo.
    public boolean removeUserFromGroup(String groupName, String username) {
        Group group = groups.get(groupName);
        if (group == null) {
            return false;
        }
        
        boolean removed = group.members.remove(username);
        if (removed) {
            persistGroups();
            System.out.println("[📁] " + username + " removido de " + groupName);
        }
        return removed;
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

    //Guarda los datos de grupos en disco.
    private void persistGroups() {
        try (Writer writer = new FileWriter(GROUPS_FILE)) {
            gson.toJson(groups, writer);
        } catch (IOException e) {
            System.err.println(" Error guardando grupos: " + e.getMessage());
        }
    }

    //Carga los grupos desde el archivo JSON. 
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
            System.err.println("  Error cargando grupos: " + e.getMessage());
            return new HashMap<>();
        }
    }


    public AudioFileManager getAudioManager() {
    return audioManager;
    }

    // ======================================================================
    // CLASES INTERNAS
    // ======================================================================
    
    //Representa un mensaje individual (texto o voz). 
    public static class ChatMessage {
        public String sender;
        public String recipient;
        public String type; 
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
         String prefix = isGroup ? "[GRUPO: " + recipient + "]" : "[PRIVADO]";
        String msgContent;

        if (type.equals("VOICE")) {
            // Mostrar nombre de archivo si existe
            if (content != null && content.startsWith("[AUDIO_FILE:")) {
                String filename = content.replace("[AUDIO_FILE:", "").replace("]", "");
                msgContent = " [NOTA DE VOZ] (" + filename + ")";
            } else {
                msgContent = " [NOTA DE VOZ]";
            }
        } else {
            msgContent = content;
        }

        return String.format("%s %s [%s] %s → %s: %s",
          prefix, timestamp, sender, recipient, msgContent);
        }

    }

    //Representa un grupo de chat con miembros y creador.
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



    // ======================================================================
    // ELIMINAR HISTORIAL DE USUARIO
    // ======================================================================

    /**
    * Elimina todo el historial de un usuario (mensajes y archivos de audio)
    * @param username Usuario cuyo historial se eliminará
    * @return Cantidad de mensajes eliminados
    */
    public int deleteUserHistory(String username) {
        int deletedCount = 0;
        List<ChatMessage> toDelete = new ArrayList<>();
    
        // Encontrar mensajes del usuario
        for (ChatMessage msg : messages) {
            if (msg.sender.equals(username) || msg.recipient.equals(username)) {
                toDelete.add(msg);
            
                // Si es nota de voz, eliminar archivo de audio
                if (msg.type.equals("VOICE") && msg.content.startsWith("[AUDIO_FILE:")) {
                    String filename = msg.content.replaceAll("\\[AUDIO_FILE:|\\]", "");
                    boolean deleted = audioManager.deleteAudio(filename);
                    if (deleted) {
                        System.out.println(" Archivo eliminado: " + filename);
                    }
                }
                deletedCount++;
            }
        }
    
    // Eliminar mensajes de la lista
    messages.removeAll(toDelete);
    
    // Persistir cambios
    persistMessages();
    
    System.out.println(" Historial de " + username + " eliminado: " + deletedCount + " mensajes");
    return deletedCount;
    }
}
