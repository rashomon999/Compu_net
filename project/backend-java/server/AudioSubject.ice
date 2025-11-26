// AudioSubject.ice - Sistema de llamadas VoIP
// Exactamente como el profesor lo hizo

module AudioSystem {
    // Secuencia de bytes para audio
    sequence<byte> AudioData;
    
    // Secuencia de strings para lista de usuarios
    sequence<string> StringSeq;
    
    // ============================================
    // OBSERVER (Cliente)
    // ============================================
    interface AudioObserver {
        // Recibe audio en tiempo real durante una llamada
        void receiveAudio(AudioData data);
        
        // Notificación de llamada entrante
        void incomingCall(string fromUser);
        
        // Notificación de que la llamada fue aceptada
        void callAccepted(string fromUser);
        
        // Notificación de que la llamada fue rechazada
        void callRejected(string fromUser);
        
        // Notificación de que la llamada fue finalizada
        void callEnded(string fromUser);
    };
    
    // ============================================
    // SUBJECT (Servidor)
    // ============================================
    interface AudioSubject {
        // Registra un cliente con su Observer
        void attach(string userId, AudioObserver* obs);
        
        // Desregistra un cliente
        void detach(string userId);
        
        // Envía audio durante una llamada activa
        void sendAudio(string fromUser, AudioData data);
        
        // Obtiene lista de usuarios conectados
        StringSeq getConnectedUsers();
        
        // Inicia una llamada
        void startCall(string fromUser, string toUser);
        
        // Acepta una llamada entrante
        void acceptCall(string fromUser, string toUser);
        
        // Rechaza una llamada entrante
        void rejectCall(string fromUser, string toUser);
        
        // Finaliza una llamada activa
        void hangup(string fromUser, string toUser);
        
        // ============================================
        // MÉTODOS DE POLLING (fallback para callbacks)
        // ============================================
        StringSeq getPendingIncomingCalls(string userId);
        StringSeq getPendingAcceptedCalls(string userId);
        StringSeq getPendingRejectedCalls(string userId);
        StringSeq getPendingEndedCalls(string userId);
    };
};