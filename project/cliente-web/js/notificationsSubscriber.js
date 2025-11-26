// ============================================================================
// notificationsSubscriber.js
// Implementación de NotificationCallback para NotificationService
// ============================================================================

export default class NotificationSubscriber {
    constructor() {
        console.log("🔔 NotificationSubscriber cargado");
    }

    // -----------------------------
    // Nuevo mensaje
    // -----------------------------
    onNewMessage(message, current) {
        console.log("📩 Notificación: Nuevo mensaje:", message);

        // Callback global opcional
        if (window.handleIncomingMessage) {
            window.handleIncomingMessage(message);
        }
    }

    // -----------------------------
    // Grupo creado
    // -----------------------------
    onGroupCreated(groupName, creator, current) {
        console.log(`👥 Notificación: Grupo creado (${groupName}) por ${creator}`);

        if (window.handleGroupCreated) {
            window.handleGroupCreated(groupName, creator);
        }
    }

    // -----------------------------
    // Usuario se une a grupo
    // -----------------------------
    onUserJoinedGroup(groupName, username, current) {
        console.log(`🙋 Notificación: ${username} se unió a ${groupName}`);

        if (window.handleUserJoinedGroup) {
            window.handleUserJoinedGroup(groupName, username);
        }
    }
}
