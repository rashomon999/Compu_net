// AudioSubject.ice
module AudioSystem {
    
    // Secuencia de bytes para audio
    sequence<byte> AudioData;
    
    // Secuencia de strings
    sequence<string> StringSeq;
    
    // ============================================
    // OBSERVER (Cliente - Recibe notificaciones)
    // ============================================
    interface AudioObserver {
        // Recibe audio en tiempo real
        void receiveAudio(AudioData data);
        
        // Notificaciones de llamadas
        void incomingCall(string fromUser);
        void callAccepted(string fromUser);
        void callRejected(string fromUser);
        void callEnded(string fromUser);
    }
    
    // ============================================
    // SUBJECT (Servidor - Gestiona llamadas)
    // ============================================
    interface AudioSubject {
        // Gestión de conexiones
        void attach(string userId, AudioObserver* obs);
        void detach(string userId);
        
        // Envío de audio
        void sendAudio(string fromUser, AudioData data);
        
        // Gestión de llamadas
        void startCall(string fromUser, string toUser);
        void acceptCall(string fromUser, string toUser);
        void rejectCall(string fromUser, string toUser);
        void hangup(string fromUser, string toUser);
        
        // Utilidades
        StringSeq getConnectedUsers();
        
        // Polling (fallback cuando callbacks no funcionan)
        StringSeq getPendingIncomingCalls(string userId);
        StringSeq getPendingAcceptedCalls(string userId);
        StringSeq getPendingRejectedCalls(string userId);
        StringSeq getPendingEndedCalls(string userId);
    }
}