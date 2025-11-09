package tcp;

import java.io.PrintWriter;
import java.util.Map;

/**
 * Servicio responsable SOLO de gestionar usuarios conectados
 */
public class UserService {
    private final Map<String, PrintWriter> clients;

    public UserService(Map<String, PrintWriter> clients) {
        this.clients = clients;
    }

    /**
     * Lista todos los usuarios conectados (excepto el actual)
     */
    public String listConnectedUsers(String currentUser) {
        StringBuilder sb = new StringBuilder("Usuarios conectados:\n");
        
        for (String user : clients.keySet()) {
            if (!user.equals(currentUser)) {
                sb.append("- ").append(user).append("\n");
            }
        }
        
        return sb.toString().trim();
    }

    /**
     * Verifica si un usuario está conectado
     */
    public boolean isUserConnected(String username) {
        return clients.containsKey(username);
    }

    /**
     * Obtiene el número total de usuarios conectados
     */
    public int getConnectedUsersCount() {
        return clients.size();
    }
}
