// ChatSystem.ice - Definición completa con audio streaming

module ChatSystem {
    
    // ============================================
    // TIPOS BASICOS
    // ============================================
    
    sequence<byte> Bytes;
    sequence<string> StringSeq;
    
    // ============================================
    // MENSAJERÍA
    // ============================================
    
    struct Message {
        string sender;
        string recipient;
        string content;
        string type;
        string timestamp;
        bool isGroup;
    };
    sequence<Message> MessageSeq;
    
    // ============================================
    // GRUPOS
    // ============================================
    
    struct GroupInfo {
        string name;
        string creator;
        StringSeq members;
        int memberCount;
        string createdAt;
    };
    sequence<GroupInfo> GroupSeq;
    
    // ============================================
    // NOTAS DE VOZ
    // ============================================
    
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
    
    // ============================================
    // LLAMADAS
    // ============================================
    
    enum CallType {
        AudioOnly,
        Video
    };
    
    enum CallStatus {
        Ringing,
        Accepted,
        Rejected,
        Ended,
        Busy,
        NoAnswer
    };
    
    struct CallOffer {
        string callId;
        string caller;
        string callee;
        CallType callType;
        string sdp;
        long timestamp;
    };
    sequence<CallOffer> CallOfferSeq;
    
    struct CallAnswer {
        string callId;
        string sdp;
        CallStatus status;
    };
    sequence<CallAnswer> CallAnswerSeq;
    
    struct RtcCandidate {
        string callId;
        string candidate;
        string sdpMid;
        int sdpMLineIndex;
    };
    sequence<RtcCandidate> RtcCandidateSeq;
    
    //  NUEVO: Estructura para chunks de audio en tiempo real
    struct AudioChunk {
        Bytes data;
        long timestamp;
    };
    
    // ============================================
    // CALLBACKS
    // ============================================
    
    interface NotificationCallback {
        void onNewMessage(Message msg);
        void onGroupCreated(string groupName, string creator);
        void onUserJoinedGroup(string groupName, string username);
    };
    
    interface CallCallback {
        void onIncomingCall(CallOffer offer);
        void onCallAnswer(CallAnswer answer);
        void onRtcCandidate(RtcCandidate candidate);
        void onCallEnded(string callId, string reason);
        
        //  NUEVO: Callback para recibir audio en tiempo real
        void onAudioChunk(AudioChunk chunk);
    };
    
    // ============================================
    // SERVICIOS
    // ============================================
    
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
    
    interface NotificationService {
        void subscribe(string username, NotificationCallback* callback);
        void unsubscribe(string username);
        MessageSeq getNewMessages(string username);
        void markAsRead(string username);
    };
    
    interface VoiceService {
        string saveVoiceNote(string sender, string target, string audioDataBase64, bool isGroup);
        string getVoiceNote(string audioFileRef);
        VoiceNoteSeq getVoiceNotesHistory(string user1, string user2);
        VoiceNoteSeq getGroupVoiceNotes(string groupName);
    };
    
    interface CallService {
        // Señalización (mantener)
        string initiateCall(string caller, string callee, CallType type, string sdp);
        string answerCall(string callId, string callee, CallStatus status, string sdp);
        void endCall(string callId, string username);
        void sendRtcCandidate(string callId, string username, string candidate, string sdpMid, int sdpMLineIndex);
        
        // Suscripción
        void subscribe(string username, CallCallback* callback);
        void unsubscribe(string username);
        
        // Polling
        CallOfferSeq getPendingIncomingCalls(string username);
        CallAnswerSeq getPendingCallAnswers(string username);
        RtcCandidateSeq getPendingRtcCandidates(string username);
        
        //  NUEVO: Streaming de audio directo
        void sendAudioChunk(string username, Bytes audioData);
    };
};