// ============================================
// ChatSystem.ice - Sistema de Chat con Llamadas (Profesor)
// Ubicación: backend-java/server/slice/ChatSystem.ice
// ============================================

module ChatSystem {
    
    // ========================================================================
    // ESTRUCTURAS BÁSICAS
    // ========================================================================
    
    struct Message {
        string sender;
        string recipient;
        string content;
        string type;           // "TEXT", "VOICE"
        string timestamp;
        bool isGroup;
    };
    
    sequence<Message> MessageSeq;
    sequence<string> StringSeq;
    sequence<byte> ByteSeq;  
    
    struct GroupInfo {
        string name;
        string creator;
        StringSeq members;
        int memberCount;
        string createdAt;
    };
    
    sequence<GroupInfo> GroupSeq;
    
    struct VoiceNote {
        string id;
        string sender;
        string target;
        string audioFileRef;
        bool isGroup;
        string timestamp;
        int durationSeconds;
    };
    
    sequence<VoiceNote> VoiceNoteSeq;
    
    // ========================================================================
    // SERVICIOS PRINCIPALES
    // ========================================================================
    
    interface ChatService {
        string sendPrivateMessage(string sender, string recipient, string message);
        string sendGroupMessage(string sender, string groupName, string message);
        string getConversationHistory(string user1, string user2);
        string getGroupHistory(string groupName, string username);
        StringSeq getRecentConversations(string username);
    };
    
    interface GroupService {
        string createGroup(string groupName, string creator);
        string joinGroup(string groupName, string username);
        string leaveGroup(string groupName, string username);
        GroupSeq listUserGroups(string username);
        StringSeq getGroupMembers(string groupName);
    };
    
    // ========================================================================
    // NOTIFICACIONES (Observer Pattern)
    // ========================================================================
    
    interface NotificationCallback {
        void onNewMessage(Message msg);
        void onGroupCreated(string groupName, string creator);
        void onUserJoinedGroup(string groupName, string username);
    };
    
    interface NotificationService {
        void subscribe(string username, NotificationCallback* callback);
        void unsubscribe(string username);
        MessageSeq getNewMessages(string username);
        void markAsRead(string username);
    };
    
    // ========================================================================
    // NOTAS DE VOZ
    // ========================================================================
    
    interface VoiceService {
        string saveVoiceNote(string sender, string target, string audioDataBase64, bool isGroup);
        string getVoiceNote(string audioFileRef);
        VoiceNoteSeq getVoiceNotesHistory(string user1, string user2);
        VoiceNoteSeq getGroupVoiceNotes(string groupName);
    };
    
    // ========================================================================
    // ⚡ LLAMADAS (SISTEMA PROFESOR - SIN WEBRTC)
    // Audio fluye DIRECTO por el servidor
    // ========================================================================
    
    interface CallCallback {
        // Audio streaming
        void receiveAudio(["cpp:array"] ByteSeq data);
        
        // Señalización simple
        void incomingCall(string fromUser);
        void callAccepted(string fromUser);
        void callRejected(string fromUser);
        void callColgada(string fromUser);
    };
    
    interface CallService {
        // Envío de audio en tiempo real
        void sendAudio(string fromUser, ["cpp:array"] ByteSeq data);
        
        // Control de llamadas
        void startCall(string fromUser, string toUser);
        void acceptCall(string fromUser, string toUser);
        void rejectCall(string fromUser, string toUser);
        void colgar(string fromUser, string toUser);
        
        // Suscripción a eventos
        void subscribe(string username, CallCallback* callback);
        void unsubscribe(string username);
        
        // Utilidades
        StringSeq getConnectedUsers();
    };
    
};