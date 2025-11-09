package websocket;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Scanner;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

/**
 * Cliente WebSocket para conectar con el servidor
 */
public class WebSocketClient extends WebSocketClient {
    private final Gson gson = new Gson();
    private final BlockingQueue<String> messageQueue = new LinkedBlockingQueue<>();
    private String username;
    private boolean connected = false;

    public WebSocketClient(URI serverUri) {
        super(serverUri);
    }

    public static void main(String[] args) throws URISyntaxException {
        Scanner sc = new Scanner(System.in);

        System.out.print("IP del servidor (Enter para localhost): ");
        String hostInput = sc.nextLine().trim();
        String host = hostInput.isEmpty() ? "localhost" : hostInput;
        
        URI uri = new URI("ws://" + host + ":8080");
        WebSocketClient client = new WebSocketClient(uri);

        try {
            System.out.println("Conectando a " + uri + "...");
            client.connect();
            
            // Esperar a conectar (máximo 5 segundos)
            int attempts = 0;
            while (!client.isOpen() && attempts < 50) {
                Thread.sleep(100);
                attempts++;
            }

            if (!client.isOpen()) {
                System.err.println("No se pudo conectar al servidor WebSocket");
                sc.close();
                return;
            }

            System.out.println("Conectado al servidor WebSocket");

            // Registrar usuario
            System.out.print("\nTu nombre de usuario: ");
            String username = sc.nextLine();

            JsonObject registerCmd = new JsonObject();
            registerCmd.addProperty("command", "REGISTER");
            registerCmd.addProperty("username", username);
            client.send(gson.toJson(registerCmd));

            // Hilo para leer respuestas del servidor
            new Thread(() -> {
                try {
                    while (client.isOpen()) {
                        String msg = client.messageQueue.poll();
                        if (msg != null) {
                            System.out.println(msg);
                        }
                        Thread.sleep(50);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }).start();

            // Menú principal
            boolean running = true;
            while (running && client.isOpen()) {
                showMenu();
                String option = sc.nextLine().trim();

                switch (option) {
                    case "1" -> sendPrivateMessage(client, sc, username);
                    case "2" -> sendGroupMessage(client, sc, username);
                    case "3" -> createGroup(client, sc);
                    case "4" -> joinGroup(client, sc);
                    case "5" -> listUsers(client);
                    case "6" -> listGroups(client);
                    case "7" -> viewHistory(client, sc, username);
                    case "0" -> {
                        System.out.println("Desconectando...");
                        running = false;
                        client.close();
                    }
                    default -> System.out.println("Opción inválida");
                }

                Thread.sleep(100);
            }

            sc.close();

        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public void onOpen(ServerHandshake handshakedata) {
        connected = true;
        System.out.println("[WS] Conectado al servidor");
    }

    @Override
    public void onMessage(String message) {
        messageQueue.add(message);
        try {
            JsonObject response = JsonParser.parseString(message).getAsJsonObject();
            if (response.has("data")) {
                System.out.println("Servidor: " + response.get("message").getAsString());
            }
        } catch (Exception e) {
            System.out.println("Servidor: " + message);
        }
    }

    @Override
    public void onClose(int code, String reason, boolean remote) {
        connected = false;
        System.out.println("[WS] Desconectado del servidor");
    }

    @Override
    public void onError(Exception ex) {
        System.err.println("[WS ERROR] " + ex.getMessage());
    }

    // ========== HANDLERS DE MENÚ ==========

    private static void showMenu() {
        System.out.println("\n╔════════════════════════════════════════╗");
        System.out.println("║      COMPUNET - WEBSOCKET MENU       ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("1. Enviar mensaje privado");
        System.out.println("2. Enviar mensaje a grupo");
        System.out.println("3. Crear grupo");
        System.out.println("4. Unirse a grupo");
        System.out.println("5. Listar usuarios");
        System.out.println("6. Listar grupos");
        System.out.println("7. Ver historial");
        System.out.println("0. Salir");
        System.out.print("> Opción: ");
    }

    private static void sendPrivateMessage(WebSocketClient client, Scanner sc, String username) {
        System.out.print("Destinatario: ");
        String recipient = sc.nextLine().trim();
        System.out.print("Mensaje: ");
        String message = sc.nextLine().trim();

        JsonObject cmd = new JsonObject();
        cmd.addProperty("command", "MSG_USER");
        cmd.addProperty("recipient", recipient);
        cmd.addProperty("message", message);

        client.send(client.gson.toJson(cmd));
    }

    private static void sendGroupMessage(WebSocketClient client, Scanner sc, String username) {
        System.out.print("Grupo: ");
        String group = sc.nextLine().trim();
        System.out.print("Mensaje: ");
        String message = sc.nextLine().trim();

        JsonObject cmd = new JsonObject();
        cmd.addProperty("command", "MSG_GROUP");
        cmd.addProperty("groupName", group);
        cmd.addProperty("message", message);

        client.send(client.gson.toJson(cmd));
    }

    private static void createGroup(WebSocketClient client, Scanner sc) {
        System.out.print("Nombre del grupo: ");
        String groupName = sc.nextLine().trim();

        JsonObject cmd = new JsonObject();
        cmd.addProperty("command", "CREATE_GROUP");
        cmd.addProperty("groupName", groupName);

        client.send(client.gson.toJson(cmd));
    }

    private static void joinGroup(WebSocketClient client, Scanner sc) {
        System.out.print("Nombre del grupo: ");
        String groupName = sc.nextLine().trim();

        JsonObject cmd = new JsonObject();
        cmd.addProperty("command", "JOIN_GROUP");
        cmd.addProperty("groupName", groupName);

        client.send(client.gson.toJson(cmd));
    }

    private static void listUsers(WebSocketClient client) {
        JsonObject cmd = new JsonObject();
        cmd.addProperty("command", "LIST_USERS");
        client.send(client.gson.toJson(cmd));
    }

    private static void listGroups(WebSocketClient client) {
        JsonObject cmd = new JsonObject();
        cmd.addProperty("command", "LIST_GROUPS");
        client.send(client.gson.toJson(cmd));
    }

    private static void viewHistory(WebSocketClient client, Scanner sc, String username) {
        System.out.print("Usuario: ");
        String otherUser = sc.nextLine().trim();

        JsonObject cmd = new JsonObject();
        cmd.addProperty("command", "VIEW_HISTORY");
        cmd.addProperty("otherUser", otherUser);

        client.send(client.gson.toJson(cmd));
    }
}
