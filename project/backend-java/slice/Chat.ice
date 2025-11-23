module Chat {
    // Message types
    enum MessageType {
        TEXT,
        VOICE
    };
    
    // Chat message structure
    struct ChatMessage {
        string sender;
        string recipient;
        MessageType type;
        string content;
        bool isGroup;
        string timestamp;
    };
    
    // Group information
    struct GroupInfo {
        string name;
        string creator;
        sequence<string> members;
        string createdAt;
    };
    
    // Observer interface for real-time updates (client implements this)
    interface ChatObserver {
        // Receive text message
        void receiveMessage(string sender, string message, bool isGroup);
        
        // Receive voice data
        void receiveVoiceData(string sender, sequence<byte> audioData, bool isGroup);
        
        // Notification for group updates
        void notifyGroupUpdate(string groupName, string action);
    };
    
    // Main chat service interface
    interface ChatService {
        // User management
        bool registerUser(string username, ChatObserver* observer);
        void unregisterUser(string username);
        
        // Messaging
        bool sendMessage(string sender, string recipient, string message, bool isGroup);
        bool sendVoiceMessage(string sender, string recipient, sequence<byte> audioData, bool isGroup);
        
        // Groups
        bool createGroup(string groupName, string creator);
        bool joinGroup(string groupName, string username);
        sequence<string> getGroupMembers(string groupName);
        sequence<GroupInfo> getAllGroups();
        
        // History
        sequence<ChatMessage> getConversationHistory(string user1, string user2);
        sequence<ChatMessage> getGroupHistory(string groupName);
    };
    
    // Voice streaming interface
    interface VoiceService {
        // Attach observer for voice stream
        void attachObserver(ChatObserver* observer);
        
        // Send audio chunk
        void sendAudioChunk(string sender, string recipient, sequence<byte> audioData, bool isGroup);
    };
};
