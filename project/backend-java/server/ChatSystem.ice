// ============================================================================
// ChatSystem.ice - Definición de interfaces para sistema de chat
// Ubicación: backend-java/server/ChatSystem.ice
// ============================================================================

module ChatSystem {
    
    // ========================================================================
    // ESTRUCTURAS DE DATOS
    // ========================================================================
    
    /**
     * Mensaje de chat (texto o voz)
     */
    struct Message {
        string sender;
        string recipient;
        string content;
        string type;        // "TEXT" o "VOICE"
        string timestamp;
        bool isGroup;
    };
    
    sequence<Message> MessageSeq;
    sequence<string> StringSeq;
    
    /**
     * Información detallada de un grupo
     */
    struct GroupInfo {
        string name;
        string creator;
        StringSeq members;
        int memberCount;
        string createdAt;
    };
    
    sequence<GroupInfo> GroupSeq;
    
    /**
     * Nota de voz con metadata
     */
    struct VoiceNote {
        string id;
        string sender;
        string target;
        string audioFileRef;    // Referencia al archivo en servidor
        bool isGroup;
        string timestamp;
        int durationSeconds;
    };
    
    sequence<VoiceNote> VoiceNoteSeq;
    
    // ========================================================================
    // SERVICIO PRINCIPAL DE CHAT
    // ========================================================================
    
    interface ChatService {
        /**
         * Envía un mensaje privado a otro usuario
         * @param sender Usuario que envía
         * @param recipient Usuario que recibe
         * @param message Contenido del mensaje
         * @return Resultado de la operación
         */
        string sendPrivateMessage(string sender, string recipient, string message);
        
        /**
         * Envía un mensaje a un grupo
         * @param sender Usuario que envía
         * @param groupName Nombre del grupo
         * @param message Contenido del mensaje
         * @return Resultado de la operación
         */
        string sendGroupMessage(string sender, string groupName, string message);
        
        /**
         * Obtiene el historial de conversación entre dos usuarios
         * @param user1 Primer usuario
         * @param user2 Segundo usuario
         * @return Historial formateado
         */
        string getConversationHistory(string user1, string user2);
        
        /**
         * Obtiene el historial de un grupo
         * @param groupName Nombre del grupo
         * @param username Usuario que solicita (debe ser miembro)
         * @return Historial formateado
         */
        string getGroupHistory(string groupName, string username);
        
        /**
         * Obtiene la lista de conversaciones recientes de un usuario
         * @param username Usuario
         * @return Lista de usuarios con los que ha conversado
         */
        StringSeq getRecentConversations(string username);
    };
    
    // ========================================================================
    // SERVICIO DE GESTIÓN DE GRUPOS
    // ========================================================================
    
    interface GroupService {
        /**
         * Crea un nuevo grupo de chat
         * @param groupName Nombre del grupo
         * @param creator Usuario creador
         * @return Resultado de la operación
         */
        string createGroup(string groupName, string creator);
        
        /**
         * Une un usuario a un grupo existente
         * @param groupName Nombre del grupo
         * @param username Usuario a unir
         * @return Resultado de la operación
         */
        string joinGroup(string groupName, string username);
        
        /**
         * Remueve un usuario de un grupo
         * @param groupName Nombre del grupo
         * @param username Usuario a remover
         * @return Resultado de la operación
         */
        string leaveGroup(string groupName, string username);
        
        /**
         * Lista todos los grupos donde el usuario es miembro
         * @param username Usuario
         * @return Array de información de grupos
         */
        GroupSeq listUserGroups(string username);
        
        /**
         * Obtiene los miembros de un grupo
         * @param groupName Nombre del grupo
         * @return Lista de usernames
         */
        StringSeq getGroupMembers(string groupName);
    };
    
    // ========================================================================
    // SERVICIO DE NOTIFICACIONES (PATRÓN OBSERVER)
    // ========================================================================
    
    /**
     * Callback para recibir notificaciones en tiempo real
     * Implementado por el cliente
     */
    interface NotificationCallback {
        /**
         * Notifica cuando llega un mensaje nuevo
         */
        void onNewMessage(Message msg);
        
        /**
         * Notifica cuando se crea un grupo nuevo
         */
        void onGroupCreated(string groupName, string creator);
        
        /**
         * Notifica cuando alguien se une a un grupo
         */
        void onUserJoinedGroup(string groupName, string username);
    };
    
    /**
     * Servicio de notificaciones push (Subject del patrón Observer)
     */
    interface NotificationService {
        /**
         * Suscribe un cliente para recibir notificaciones
         * @param username Usuario que se suscribe
         * @param callback Objeto callback del cliente
         */
        void subscribe(string username, NotificationCallback* callback);
        
        /**
         * Desuscribe un cliente
         * @param username Usuario que se desuscribe
         */
        void unsubscribe(string username);
        
        /**
         * Obtiene mensajes nuevos desde la última consulta
         * @param username Usuario
         * @return Array de mensajes nuevos
         */
        MessageSeq getNewMessages(string username);
        
        /**
         * Marca mensajes como leídos
         * @param username Usuario
         */
        void markAsRead(string username);
    };
    
    // ========================================================================
    // SERVICIO DE NOTAS DE VOZ
    // ========================================================================
    
    interface VoiceService {
        /**
         * Guarda una nota de voz
         * @param sender Usuario que envía
         * @param target Usuario o grupo receptor
         * @param audioDataBase64 Audio codificado en Base64
         * @param isGroup Si es para un grupo
         * @return ID de la nota de voz o mensaje de error
         */
        string saveVoiceNote(string sender, string target, string audioDataBase64, bool isGroup);
        
        /**
         * Obtiene el audio de una nota de voz
         * @param audioFileRef Referencia al archivo
         * @return Audio codificado en Base64
         */
        string getVoiceNote(string audioFileRef);
        
        /**
         * Obtiene el historial de notas de voz entre dos usuarios
         * @param user1 Primer usuario
         * @param user2 Segundo usuario
         * @return Array de notas de voz
         */
        VoiceNoteSeq getVoiceNotesHistory(string user1, string user2);
        
        /**
         * Obtiene las notas de voz de un grupo
         * @param groupName Nombre del grupo
         * @return Array de notas de voz
         */
        VoiceNoteSeq getGroupVoiceNotes(string groupName);
    };
    
    // ========================================================================
    // SERVICIO DE LLAMADAS (WEBRTC)
    // ========================================================================
    
    /**
     * Tipos de llamada
     */
    enum CallType {
        AudioOnly,
        Video
    };
    
    /**
     * Estados de una llamada
     */
    enum CallStatus {
        Ringing,
        Accepted,
        Rejected,
        Ended,
        Busy,
        NoAnswer
    };
    
    /**
     * Oferta de llamada (SDP)
     */
    struct CallOffer {
        string callId;
        string caller;
        string callee;
        CallType callType;
        string sdp;
        long timestamp;
    };
    
    /**
     * Respuesta a una llamada
     */
    struct CallAnswer {
        string callId;
        string sdp;
        CallStatus status;
    };
    
    /**
     * Candidato ICE de WebRTC
     */
    struct RtcCandidate {
        string callId;
        string candidate;
        string sdpMid;
        int sdpMLineIndex;
    };
    
    // Secuencias para polling
    sequence<CallOffer> CallOfferSeq;
    sequence<CallAnswer> CallAnswerSeq;
    sequence<RtcCandidate> RtcCandidateSeq;
    
    /**
     * Callback para eventos de llamadas
     * Implementado por el cliente
     */
    interface CallCallback {
        /**
         * Notifica cuando llega una llamada entrante
         */
        void onIncomingCall(CallOffer offer);
        
        /**
         * Notifica la respuesta a una llamada
         */
        void onCallAnswer(CallAnswer answer);
        
        /**
         * Notifica un candidato ICE
         */
        void onRtcCandidate(RtcCandidate candidate);
        
        /**
         * Notifica que la llamada terminó
         */
        void onCallEnded(string callId, string reason);
    };
    
    /**
     * Servicio de gestión de llamadas
     */
    interface CallService {
        /**
         * Inicia una llamada a otro usuario
         * @param caller Usuario que llama
         * @param callee Usuario que recibe
         * @param callType Tipo de llamada (audio/video)
         * @param sdp Session Description Protocol
         * @return ID de la llamada o mensaje de error
         */
        string initiateCall(string caller, string callee, CallType callType, string sdp);
        
        /**
         * Responde a una llamada entrante
         * @param callId ID de la llamada
         * @param callee Usuario que responde
         * @param status Estado de respuesta
         * @param sdp Session Description Protocol
         * @return Resultado de la operación
         */
        string answerCall(string callId, string callee, CallStatus status, string sdp);
        
        /**
         * Finaliza una llamada activa
         * @param callId ID de la llamada
         * @param username Usuario que finaliza
         */
        void endCall(string callId, string username);
        
        /**
         * Envía un candidato ICE para establecer conexión
         * @param callId ID de la llamada
         * @param username Usuario que envía
         * @param candidate Candidato ICE
         * @param sdpMid Media stream ID
         * @param sdpMLineIndex Índice de línea SDP
         */
        void sendRtcCandidate(string callId, string username, string candidate, string sdpMid, int sdpMLineIndex);
        
        /**
         * Suscribe un cliente para recibir eventos de llamadas
         * @param username Usuario que se suscribe
         * @param callback Objeto callback del cliente
         */
        void subscribe(string username, CallCallback* callback);
        
        /**
         * Desuscribe un cliente de eventos de llamadas
         * @param username Usuario que se desuscribe
         */
        void unsubscribe(string username);
        
        // ============================================================
        // MÉTODOS DE POLLING (fallback para JavaScript)
        // ============================================================
        
        /**
         * Obtiene llamadas entrantes pendientes
         * @param username Usuario que consulta
         * @return Array de ofertas pendientes
         */
        CallOfferSeq getPendingIncomingCalls(string username);
        
        /**
         * Obtiene respuestas de llamadas pendientes
         * @param username Usuario que consulta
         * @return Array de respuestas pendientes
         */
        CallAnswerSeq getPendingCallAnswers(string username);
        
        /**
         * Obtiene candidatos ICE pendientes
         * @param username Usuario que consulta
         * @return Array de candidatos pendientes
         */
        RtcCandidateSeq getPendingRtcCandidates(string username);
    };
};