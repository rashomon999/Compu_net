## 🎯 Arquitectura de Llamadas VoIP

### Patrón de Diseño: Observer/Subject (basado en ejemplo del profesor)

Nuestra implementación sigue el patrón arquitectónico del proyecto de referencia:
```
Cliente 1 (Observer) ←→ Servidor (Subject) ←→ Cliente 2 (Observer)
```

**Componentes principales:**

1. **AudioSubject (Servidor)**
   - Mantiene mapa de `AudioObserverPrx` registrados
   - Enruta audio entre usuarios en llamada activa
   - Gestiona estado de llamadas con mapa bidireccional

2. **AudioObserver (Cliente)**
   - Recibe audio en tiempo real via `receiveAudio()`
   - Recibe notificaciones de llamadas (incoming/accepted/rejected/ended)
   - Implementado en `subscriber.js` (web) siguiendo el patrón del ejemplo

### Flujo de Llamada
```
Usuario A                    Servidor                    Usuario B
   │                            │                            │
   │──startCall("B")────────────►│                            │
   │                            │──incomingCall("A")────────►│
   │                            │                            │ (Usuario acepta)
   │                            │◄──acceptCall("A", "B")────│
   │◄──callAccepted("B")────────│                            │
   │                            │                            │
   │                    [Llamada Activa]                     │
   │──sendAudio(bytes)──────────►│──receiveAudio(bytes)──────►│
   │◄─────────────────sendAudio(bytes)◄──────────────────────│
   │                            │                            │
   │──hangup("B")────────────────►│──callEnded("A")──────────►│
```

### Enrutamiento de Audio (O(1))
```java
// Servidor mantiene mapa bidireccional
activeCalls.put("Alice", "Bob");   // Alice → Bob
activeCalls.put("Bob", "Alice");   // Bob → Alice

// Enrutamiento instantáneo
String target = activeCalls.get(fromUser);  // O(1)
AudioObserverPrx dest = observers.get(target);  // O(1)
dest.receiveAudioAsync(audioData);
```

### Diferencias con el Ejemplo Original

| Aspecto | Ejemplo Profesor | Nuestra Implementación |
|---------|------------------|------------------------|
| Cliente | Java Swing | JavaScript Web (HTML5 + Web Audio API) |
| Callbacks | JOptionPane | Modal HTML personalizado |
| Audio | javax.sound.sampled | Web Audio API (AudioContext) |
| Thread-safety | HashMap + synchronized | ConcurrentHashMap |
| Failsafe | Solo callbacks | Callbacks + polling (fallback) |
| Estadísticas | No | Contador de paquetes de audio |

### Mejoras Implementadas

1. **Sistema de Polling Fallback**: Si los callbacks de Ice fallan, el cliente puede consultar manualmente
2. **Estadísticas de Audio**: Tracking de paquetes enviados/recibidos para debugging
3. **Thread-Safety Mejorado**: Uso de `ConcurrentHashMap` para mejor concurrencia
4. **Limpieza Automática**: Desconexión detectada por `setCloseCallback()` limpia todos los recursos