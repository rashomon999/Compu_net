// ============================================
// AudioSubject.ice - Definición ICE con Polling
// ============================================

module AudioSystem
{
    // Tipo de datos para audio (PCM16 raw)
    sequence<byte> AudioData;
    sequence<string> StringSeq;
    
    // ============================================
    // OBSERVER (Cliente)
    // ============================================
    
    interface AudioObserver
    {
        // Callbacks bidireccionales (intentar primero)
        void receiveAudio(AudioData data);
        void incomingCall(string fromUser);
        void callAccepted(string fromUser);
        void callRejected(string fromUser);
        void callEnded(string fromUser);
    };
    
    // ============================================
    // SUBJECT (Servidor)
    // ============================================
    
    interface AudioSubject
    {
        // Gestión de conexiones
        void attach(string userId, AudioObserver* obs);
        void detach(string userId);
        
        // Enrutamiento de audio en tiempo real
        void sendAudio(string fromUser, AudioData data);
        
        // Gestión de llamadas
        void startCall(string fromUser, string toUser);
        void acceptCall(string fromUser, string toUser);
        void rejectCall(string fromUser, string toUser);
        void hangup(string fromUser, string toUser);
        
        // ✅ NUEVO: Métodos de polling (fallback para WebSocket)
        StringSeq getPendingIncomingCalls(string userId);
        StringSeq getPendingAcceptedCalls(string userId);
        StringSeq getPendingRejectedCalls(string userId);
        StringSeq getPendingEndedCalls(string userId);
        
        // Utilidades
        StringSeq getConnectedUsers();
    };
};