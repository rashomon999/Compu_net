package websocket;

import org.java_websocket.WebSocket;
import com.google.gson.JsonObject;

/**
 * Adapter para compatibilidad entre WebSocket y servicios existentes
 */
public class WebSocketClientAdapter {
    private final WebSocket websocket;
    private String username;

    public WebSocketClientAdapter(WebSocket websocket) {
        this.websocket = websocket;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getUsername() {
        return username;
    }

    public WebSocket getWebSocket() {
        return websocket;
    }

    public boolean isConnected() {
        return websocket != null && websocket.isOpen();
    }

    public void send(String message) {
        if (isConnected()) {
            websocket.send(message);
        }
    }

    public void sendJson(JsonObject json) {
        send(json.toString());
    }
}
