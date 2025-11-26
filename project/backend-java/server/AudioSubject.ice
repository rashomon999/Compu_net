// ============================================
// AudioSubject.ice - Sistema de Llamadas P2P
// Filosofía del Profesor: Subject/Observer directo
// ============================================

module AudioSystem {
    // Secuencia de bytes para audio PCM16
    sequence<byte> AudioData;
    
    // Secuencia de strings para lista de usuarios
    sequence<string> StringSeq;
    
    // ========================================
    // OBSERVER: Implementado por cada CLIENTE
    // ========================================
    interface AudioObserver {
        // Recibe audio en tiempo real durante llamada
        void receiveAudio(AudioData data);
        
        // Notificación de llamada entrante
        void incomingCall(string fromUser);
        
        // Notificación de que la llamada fue aceptada
        void callAccepted(string fromUser);
        
        // Notificación de que la llamada fue rechazada
        void callRejected(string fromUser);
        
        // Notificación de que la llamada fue colgada
        void callEnded(string fromUser);
    };
    
    // ========================================
    // SUBJECT: Implementado por el SERVIDOR
    // ========================================
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
        
        // Cuelga una llamada activa
        void hangup(string fromUser, string toUser);
    };
};