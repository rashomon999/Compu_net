package ice;

import Chat.*;
import com.zeroc.Ice.Current;
import utils.HistoryManager;
import utils.HistoryManager.ChatMessage;
import utils.HistoryManager.Group;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class ChatServiceImpl implements ChatService {
    private final HistoryManager historyManager;
    private final Map<String, ChatObserverPrx> observers;
    
    public ChatServiceImpl(HistoryManager historyManager) {
        this.historyManager = historyManager;
        this.observers = new ConcurrentHashMap<>();
    }
    
    @Override
    public boolean registerUser(String username, ChatObserverPrx observer, Current current) {
        if (username == null || username.trim().isEmpty()) {
            return false;
        }
        
        try {
            // Fix observer to the current connection
            ChatObserverPrx fixedObserver = observer.ice_fixed(current.con);
            observers.put(username, fixedObserver);
            
            // Set up connection close callback
            if (current.con != null) {
                current.con.setCloseCallback(connection -> {
                    System.out.println("[ICE] Usuario desconectado: " + username);
                    observers.remove(username);
                });
            }
            
            System.out.println("[ICE] Usuario registrado: " + username);
            return true;
        } catch (Exception e) {
            System.err.println("[ICE] Error registrando usuario: " + e.getMessage());
            return false;
        }
    }
    
    @Override
    public void unregisterUser(String username, Current current) {
        observers.remove(username);
        System.out.println("[ICE] Usuario no registrado: " + username);
    }
    
    @Override
    public boolean sendMessage(String sender, String recipient, String message, boolean isGroup, Current current) {
        try {
            // Save to history
            historyManager.saveMessage(sender, recipient, "TEXT", message, isGroup);
            
            if (isGroup) {
                // Send to all group members
                List<String> members = historyManager.getGroupMembers(recipient);
                for (String member : members) {
                    if (!member.equals(sender)) {
                        ChatObserverPrx observer = observers.get(member);
                        if (observer != null) {
                            try {
                                observer.receiveMessageAsync(sender, message, true);
                            } catch (Exception e) {
                                System.err.println("[ICE] Error enviando mensaje a " + member);
                            }
                        }
                    }
                }
            } else {
                // Send to individual user
                ChatObserverPrx observer = observers.get(recipient);
                if (observer != null) {
                    try {
                        observer.receiveMessageAsync(sender, message, false);
                    } catch (Exception e) {
                        System.err.println("[ICE] Error enviando mensaje a " + recipient);
                    }
                }
            }
            
            System.out.println("[ICE] Mensaje enviado: " + sender + " -> " + recipient);
            return true;
        } catch (Exception e) {
            System.err.println("[ICE] Error en sendMessage: " + e.getMessage());
            return false;
        }
    }
    
    @Override
    public boolean sendVoiceMessage(String sender, String recipient, byte[] audioData, boolean isGroup, Current current) {
        try {
            // Save voice message to history
            historyManager.saveVoiceMessage(sender, recipient, audioData, isGroup);
            
            if (isGroup) {
                // Send to all group members
                List<String> members = historyManager.getGroupMembers(recipient);
                for (String member : members) {
                    if (!member.equals(sender)) {
                        ChatObserverPrx observer = observers.get(member);
                        if (observer != null) {
                            try {
                                observer.receiveVoiceDataAsync(sender, audioData, true);
                            } catch (Exception e) {
                                System.err.println("[ICE] Error enviando voz a " + member);
                            }
                        }
                    }
                }
            } else {
                // Send to individual user
                ChatObserverPrx observer = observers.get(recipient);
                if (observer != null) {
                    try {
                        observer.receiveVoiceDataAsync(sender, audioData, false);
                    } catch (Exception e) {
                        System.err.println("[ICE] Error enviando voz a " + recipient);
                    }
                }
            }
            
            System.out.println("[ICE] Mensaje de voz enviado: " + sender + " -> " + recipient + " (" + audioData.length + " bytes)");
            return true;
        } catch (Exception e) {
            System.err.println("[ICE] Error en sendVoiceMessage: " + e.getMessage());
            return false;
        }
    }
    
    @Override
    public boolean createGroup(String groupName, String creator, Current current) {
        boolean result = historyManager.createGroup(groupName, creator);
        if (result) {
            System.out.println("[ICE] Grupo creado: " + groupName + " por " + creator);
            
            // Notify creator
            ChatObserverPrx observer = observers.get(creator);
            if (observer != null) {
                try {
                    observer.notifyGroupUpdateAsync(groupName, "created");
                } catch (Exception e) {
                    System.err.println("[ICE] Error notificando creación de grupo");
                }
            }
        }
        return result;
    }
    
    @Override
    public boolean joinGroup(String groupName, String username, Current current) {
        if (!historyManager.groupExists(groupName)) {
            return false;
        }
        
        boolean result = historyManager.addUserToGroup(groupName, username);
        if (result) {
            System.out.println("[ICE] Usuario " + username + " se unió a " + groupName);
            
            // Notify all group members
            List<String> members = historyManager.getGroupMembers(groupName);
            for (String member : members) {
                ChatObserverPrx observer = observers.get(member);
                if (observer != null) {
                    try {
                        observer.notifyGroupUpdateAsync(groupName, "member_joined:" + username);
                    } catch (Exception e) {
                        System.err.println("[ICE] Error notificando unión al grupo");
                    }
                }
            }
        }
        return result;
    }
    
    @Override
    public String[] getGroupMembers(String groupName, Current current) {
        List<String> members = historyManager.getGroupMembers(groupName);
        return members.toArray(new String[0]);
    }
    
    @Override
    public GroupInfo[] getAllGroups(Current current) {
        Set<String> groupNames = historyManager.getAllGroups();
        List<GroupInfo> groupInfos = new ArrayList<>();
        
        for (String groupName : groupNames) {
            List<String> members = historyManager.getGroupMembers(groupName);
            GroupInfo info = new GroupInfo();
            info.name = groupName;
            info.creator = ""; // TODO: Get from history
            info.members = members.toArray(new String[0]);
            info.createdAt = "";
            groupInfos.add(info);
        }
        
        return groupInfos.toArray(new GroupInfo[0]);
    }
    
    @Override
    public Chat.ChatMessage[] getConversationHistory(String user1, String user2, Current current) {
        List<ChatMessage> messages = historyManager.getConversationHistory(user1, user2);
        return convertToIceMessages(messages);
    }
    
    @Override
    public Chat.ChatMessage[] getGroupHistory(String groupName, Current current) {
        List<ChatMessage> messages = historyManager.getGroupHistory(groupName);
        return convertToIceMessages(messages);
    }
    
    private Chat.ChatMessage[] convertToIceMessages(List<ChatMessage> messages) {
        List<Chat.ChatMessage> iceMessages = new ArrayList<>();
        
        for (ChatMessage msg : messages) {
            Chat.ChatMessage iceMsg = new Chat.ChatMessage();
            iceMsg.sender = msg.sender;
            iceMsg.recipient = msg.recipient;
            iceMsg.type = msg.type.equals("VOICE") ? MessageType.VOICE : MessageType.TEXT;
            iceMsg.content = msg.content;
            iceMsg.isGroup = msg.isGroup;
            iceMsg.timestamp = msg.timestamp;
            iceMessages.add(iceMsg);
        }
        
        return iceMessages.toArray(new Chat.ChatMessage[0]);
    }
}
