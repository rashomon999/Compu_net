package ice.services;
// Ubicación: backend-java/server/src/main/java/ice/services/GroupServiceI.java

import ChatSystem.*;
import com.zeroc.Ice.Current;
import utils.HistoryManager;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Implementación ICE del servicio de grupos
 * Reutiliza HistoryManager para la gestión de grupos
 */
public class GroupServiceI implements ChatSystem.GroupService {
    private final tcp.GroupService groupService;
    private final HistoryManager historyManager;

    public GroupServiceI(tcp.GroupService groupService, HistoryManager historyManager) {
        this.groupService = groupService;
        this.historyManager = historyManager;
    }

    @Override
    public String createGroup(String groupName, String creator, Current current) {
        System.out.println("[ICE] 📁 Creando grupo: " + groupName + " (creador: " + creator + ")");
        return groupService.createGroup(groupName, creator);
    }

    @Override
    public String joinGroup(String groupName, String username, Current current) {
        System.out.println("[ICE] ➕ Usuario uniéndose: " + username + " → " + groupName);
        return groupService.joinGroup(groupName, username);
    }

    @Override
    public String leaveGroup(String groupName, String username, Current current) {
        System.out.println("[ICE] ➖ Usuario saliendo: " + username + " ← " + groupName);
        
        if (!historyManager.groupExists(groupName)) {
            return "ERROR: El grupo no existe";
        }
        
        boolean removed = historyManager.removeUserFromGroup(groupName, username);
        
        if (removed) {
            return "SUCCESS: Has salido del grupo '" + groupName + "'";
        } else {
            return "ERROR: No eres miembro del grupo";
        }
    }

    @Override
    public GroupInfo[] listUserGroups(String username, Current current) {
        System.out.println("[ICE] 📋 Listando grupos de: " + username);
        
        Set<String> allGroups = historyManager.getAllGroups();
        
        // Filtrar solo grupos donde el usuario es miembro
        List<GroupInfo> userGroups = allGroups.stream()
            .filter(groupName -> {
                List<String> members = historyManager.getGroupMembers(groupName);
                return members.contains(username);
            })
            .map(groupName -> {
                List<String> members = historyManager.getGroupMembers(groupName);
                
                GroupInfo info = new GroupInfo();
                info.name = groupName;
                info.creator = members.isEmpty() ? "Unknown" : members.get(0); // Primer miembro = creador
                info.members = members.toArray(new String[0]);
                info.memberCount = members.size();
                info.createdAt = ""; // Podría agregarse al HistoryManager si es necesario
                
                return info;
            })
            .collect(Collectors.toList());
        
        System.out.println("   → " + userGroups.size() + " grupos encontrados");
        return userGroups.toArray(new GroupInfo[0]);
    }

    @Override
    public String[] getGroupMembers(String groupName, Current current) {
        System.out.println("[ICE] 👥 Obteniendo miembros de: " + groupName);
        
        if (!historyManager.groupExists(groupName)) {
            System.out.println("   ⚠️  Grupo no existe");
            return new String[0];
        }
        
        List<String> members = historyManager.getGroupMembers(groupName);
        System.out.println("   → " + members.size() + " miembros");
        
        return members.toArray(new String[0]);
    }
}