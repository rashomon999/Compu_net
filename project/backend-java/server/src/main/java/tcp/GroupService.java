package tcp;

import java.util.List;
import java.util.Set;
import utils.HistoryManager;

/**
 * Servicio responsable SOLO de la gestión de grupos
 */
public class GroupService {
    private final HistoryManager history;

    public GroupService(HistoryManager history) {
        this.history = history;
    }

    /**
     * Crea un nuevo grupo
     */
    public String createGroup(String groupName, String creator) {
        if (history.createGroup(groupName, creator)) {
            System.out.println("[GROUP] Creado: " + groupName + " por " + creator);
            return "SUCCESS: Grupo '" + groupName + "' creado";
        } else {
            return "ERROR: El grupo ya existe";
        }
    }

    /**
     * Une a un usuario a un grupo existente
     */
    public String joinGroup(String groupName, String username) {
        if (!history.groupExists(groupName)) {
            return "ERROR: El grupo no existe";
        }

        if (history.addUserToGroup(groupName, username)) {
            System.out.println("[GROUP] " + username + " se unió a " + groupName);
            return "SUCCESS: Te has unido al grupo '" + groupName + "'";
        } else {
            return "ERROR: Error al unirse al grupo";
        }
    }

    /**
     * Lista todos los grupos disponibles
     */
    public String listAllGroups() {
        Set<String> groups = history.getAllGroups();
        
        if (groups.isEmpty()) {
            return "No hay grupos creados";
        }
        
        StringBuilder sb = new StringBuilder("Grupos disponibles:\n");
        for (String group : groups) {
            List<String> members = history.getGroupMembers(group);
            sb.append("- ").append(group)
              .append(" (").append(members.size()).append(" miembros)\n");
        }
        
        return sb.toString().trim();
    }

    /**
     * Verifica si un grupo existe
     */
    public boolean groupExists(String groupName) {
        return history.groupExists(groupName);
    }
}