package utils;

/**
 * Define los tipos de mensajes y comandos del protocolo de comunicación
 */
public class MessageProtocol {
    
    // Comandos del cliente al servidor
    public static final String REGISTER = "REGISTER";
    public static final String MSG_USER = "MSG_USER";
    public static final String MSG_GROUP = "MSG_GROUP";
    public static final String CREATE_GROUP = "CREATE_GROUP";
    public static final String JOIN_GROUP = "JOIN_GROUP";
    public static final String LEAVE_GROUP = "LEAVE_GROUP";
    public static final String LIST_USERS = "LIST_USERS";
    public static final String LIST_GROUPS = "LIST_GROUPS";
    public static final String LIST_GROUP_MEMBERS = "LIST_GROUP_MEMBERS";
    public static final String VIEW_HISTORY = "VIEW_HISTORY";
    public static final String VIEW_GROUP_HISTORY = "VIEW_GROUP_HISTORY";
    
    // Respuestas del servidor
    public static final String SUCCESS = "SUCCESS";
    public static final String ERROR = "ERROR";
    public static final String INFO = "INFO";
    
    // Tipos de mensajes
    public static final String TYPE_TEXT = "TEXT";
    public static final String TYPE_VOICE = "VOICE";
    public static final String TYPE_CALL = "CALL";
    
    // Separador de comandos
    public static final String SEPARATOR = " ";
    
    /**
     * Construye un mensaje de respuesta del servidor
     */
    public static String buildResponse(String type, String message) {
        return type + ": " + message;
    }
    
    /**
     * Construye un mensaje de error
     */
    public static String buildError(String message) {
        return ERROR + ": " + message;
    }
    
    /**
     * Construye un mensaje de éxito
     */
    public static String buildSuccess(String message) {
        return SUCCESS + ": " + message;
    }
    
    /**
     * Construye un mensaje informativo
     */
    public static String buildInfo(String message) {
        return INFO + ": " + message;
    }
}
