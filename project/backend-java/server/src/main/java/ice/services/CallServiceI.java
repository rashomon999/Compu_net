package ice.services;

import ChatSystem.*;
import com.zeroc.Ice.Current;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class CallServiceI implements CallService {
    
    private final Map<String, CallCallbackPrx> subscribers = new ConcurrentHashMap<>();
    private final Map<String, CallOffer> activeCalls = new ConcurrentHashMap<>();
    private final Map<String, String[]> callParticipants = new ConcurrentHashMap<>();
    
    // Queue de llamadas pendientes por usuario (para polling)
    private final Map<String, List<CallOffer>> pendingCalls = new ConcurrentHashMap<>();
    private final Map<String, List<CallAnswer>> pendingAnswers = new ConcurrentHashMap<>();
    private final Map<String, List<RtcCandidate>> pendingCandidates = new ConcurrentHashMap<>();

    @Override
    public String initiateCall(String caller, String callee, CallType type, String sdp, Current current) {
        System.out.println("[CALL] 📞 Nueva llamada: " + caller + " → " + callee + " (" + type + ")");
        
        String callId = UUID.randomUUID().toString();
        
        CallOffer offer = new CallOffer();
        offer.callId = callId;
        offer.caller = caller;
        offer.callee = callee;
        offer.callType = type;
        offer.sdp = sdp;
        offer.timestamp = System.currentTimeMillis();
        
        activeCalls.put(callId, offer);
        
        // MÉTODO 1: Intentar callback (si está soportado)
        CallCallbackPrx calleeCallback = subscribers.get(callee);
        if (calleeCallback != null) {
            try {
                System.out.println("   📤 Intentando callback directo a " + callee + "...");
                calleeCallback.ice_oneway().onIncomingCallAsync(offer).whenComplete((result, ex) -> {
                    if (ex != null) {
                        System.err.println("   ❌ Callback falló: " + ex.getMessage());
                        addPendingCall(callee, offer);
                    } else {
                        System.out.println("   ✅ Callback exitoso");
                    }
                });
            } catch (Exception e) {
                System.err.println("   ❌ Excepción en callback: " + e.getMessage());
                addPendingCall(callee, offer);
            }
        } else {
            System.out.println("   ⚠️ Usuario no suscrito, usando polling");
            addPendingCall(callee, offer);
        }
        
        return "SUCCESS:" + callId;
    }

    @Override
    public String answerCall(String callId, String callee, CallStatus status, String sdp, Current current) {
        System.out.println("[CALL] 📞 Respuesta de llamada:");
        System.out.println("   callId: " + callId);
        System.out.println("   callee: " + callee);
        System.out.println("   status: " + status);
        System.out.println("   status value: " + status.value());
        
        CallOffer offer = activeCalls.get(callId);
        if (offer == null) {
            System.out.println("   ❌ Llamada no encontrada: " + callId);
            return "ERROR: Llamada no encontrada";
        }
        
        if (!offer.callee.equals(callee)) {
            System.out.println("   ❌ No autorizado: " + callee);
            return "ERROR: No autorizado";
        }
        
        // Crear respuesta con el status REAL que envió el cliente
        CallAnswer answer = new CallAnswer();
        answer.callId = callId;
        answer.sdp = sdp;
        answer.status = status;
        
        System.out.println("   📝 Creando respuesta con status: " + status);
        
        // ✅ CRÍTICO: Si es ACCEPTED, registrar participantes para enrutamiento de audio
        if (status == CallStatus.Accepted) {
            callParticipants.put(callId, new String[]{offer.caller, offer.callee});
            System.out.println("   ✅ Llamada ACTIVA registrada: " + offer.caller + " ↔ " + offer.callee);
        }
        
        // Enviar al caller (quien inició la llamada)
        CallCallbackPrx callerCallback = subscribers.get(offer.caller);
        if (callerCallback != null) {
            try {
                System.out.println("   📤 Intentando callback a " + offer.caller + "...");
                callerCallback.ice_oneway().onCallAnswerAsync(answer).whenComplete((result, ex) -> {
                    if (ex != null) {
                        System.err.println("   ❌ Callback falló");
                        addPendingAnswer(offer.caller, answer);
                    } else {
                        System.out.println("   ✅ Callback exitoso - Respuesta enviada");
                    }
                });
            } catch (Exception e) {
                System.err.println("   ❌ Excepción en callback");
                addPendingAnswer(offer.caller, answer);
            }
        } else {
            System.out.println("   ⚠️ Caller no suscrito, usando polling");
            addPendingAnswer(offer.caller, answer);
        }
        
        if (status == CallStatus.Rejected || status == CallStatus.NoAnswer) {
            activeCalls.remove(callId);
            callParticipants.remove(callId);
        }
        
        return "SUCCESS";
    }

    @Override
    public void endCall(String callId, String username, Current current) {
        System.out.println("[CALL] 📞 Finalizando llamada: " + callId + " por " + username);
        
        String[] participants = callParticipants.get(callId);
        if (participants == null) {
            return;
        }
        
        String otherUser = participants[0].equals(username) ? participants[1] : participants[0];
        
        CallCallbackPrx callback = subscribers.get(otherUser);
        if (callback != null) {
            try {
                callback.ice_oneway().onCallEndedAsync(callId, "Usuario terminó la llamada");
            } catch (Exception e) {
                System.err.println("   ❌ Error notificando fin");
            }
        }
        
        activeCalls.remove(callId);
        callParticipants.remove(callId);
    }

    @Override
    public void sendRtcCandidate(String callId, String username, String candidate, 
                                  String sdpMid, int sdpMLineIndex, Current current) {
        System.out.println("[CALL] 🧊 RTC candidate de " + username);
        
        String[] participants = callParticipants.get(callId);
        if (participants == null) {
            return;
        }
        
        String otherUser = participants[0].equals(username) ? participants[1] : participants[0];
        
        RtcCandidate rtcCandidate = new RtcCandidate();
        rtcCandidate.callId = callId;
        rtcCandidate.candidate = candidate;
        rtcCandidate.sdpMid = sdpMid;
        rtcCandidate.sdpMLineIndex = sdpMLineIndex;
        
        CallCallbackPrx callback = subscribers.get(otherUser);
        if (callback != null) {
            try {
                callback.ice_oneway().onRtcCandidateAsync(rtcCandidate);
            } catch (Exception e) {
                addPendingCandidate(otherUser, rtcCandidate);
            }
        } else {
            addPendingCandidate(otherUser, rtcCandidate);
        }
    }

    // ========================================================================
    // ✅ CRÍTICO: ENVÍO DE AUDIO EN TIEMPO REAL
    // ========================================================================
    
    @Override
    public void sendAudioChunk(String username, byte[] data, Current current) {
        // PASO 1: Buscar con quién está hablando el usuario
        String target = null;
        String callId = null;
        
        // Buscar en callParticipants
        for (Map.Entry<String, String[]> entry : callParticipants.entrySet()) {
            String[] participants = entry.getValue();
            if (participants[0].equals(username)) {
                target = participants[1];
                callId = entry.getKey();
                break;
            } else if (participants[1].equals(username)) {
                target = participants[0];
                callId = entry.getKey();
                break;
            }
        }
        
        if (target == null) {
            // Solo log cada 100 chunks para no saturar
            if (Math.random() < 0.01) {
                System.out.println("[CALL] ⚠️ " + username + " no tiene llamada activa");
            }
            return;
        }
        
        // PASO 2: Validar que haya datos
        if (data == null || data.length == 0) {
            System.out.println("[CALL] ⚠️ Audio vacío de " + username);
            return;
        }
        
        // PASO 3: Obtener el callback del destinatario
        CallCallbackPrx callback = subscribers.get(target);
        
        if (callback == null) {
            if (Math.random() < 0.01) {
                System.out.println("[CALL] ⚠️ Callback no encontrado para " + target);
            }
            return;
        }
        
        // PASO 4: Crear AudioChunk
        AudioChunk chunk = new AudioChunk();
        chunk.data = data;
        chunk.timestamp = System.currentTimeMillis();
        
        // ✅ SOLUCIÓN: Hacer target final para usarlo en el lambda
        final String finalTarget = target;
        
        // PASO 5: Enviar al destinatario de forma asíncrona
        try {
            callback.ice_oneway().onAudioChunkAsync(chunk).whenComplete((result, ex) -> {
                if (ex != null) {
                    System.err.println("[CALL] ❌ Error enviando audio a " + finalTarget + ": " + ex.getMessage());
                }
            });
        } catch (Exception e) {
            System.err.println("[CALL] ❌ Excepción enviando audio: " + e.getMessage());
        }

        System.out.println("[DEBUG] sendAudioChunk recibido:");
        System.out.println("   username: " + username);
        System.out.println("   data length: " + data.length);
        System.out.println("   callParticipants: " + callParticipants);
    }

    @Override
    public void subscribe(String username, CallCallbackPrx callback, Current current) {
        subscribers.put(username, callback);
        System.out.println("[CALL] 📞 Usuario suscrito: " + username);
        System.out.println("   📋 Total suscritos: " + subscribers.size());
    }

    @Override
    public void unsubscribe(String username, Current current) {
        subscribers.remove(username);
        System.out.println("[CALL] 📞 Usuario desuscrito: " + username);
        
        activeCalls.entrySet().removeIf(entry -> {
            CallOffer offer = entry.getValue();
            if (offer.caller.equals(username) || offer.callee.equals(username)) {
                callParticipants.remove(entry.getKey());
                return true;
            }
            return false;
        });
    }

    // ========================================================================
    // MÉTODOS PARA POLLING
    // ========================================================================

    @Override
    public CallOffer[] getPendingIncomingCalls(String username, Current current) {
        List<CallOffer> calls = pendingCalls.remove(username);
        if (calls == null || calls.isEmpty()) {
            return new CallOffer[0];
        }
        System.out.println("[CALL] 📬 Entregando " + calls.size() + " llamadas pendientes a " + username);
        return calls.toArray(new CallOffer[0]);
    }

    @Override
    public CallAnswer[] getPendingCallAnswers(String username, Current current) {
        List<CallAnswer> answers = pendingAnswers.remove(username);
        if (answers == null || answers.isEmpty()) {
            return new CallAnswer[0];
        }
        System.out.println("[CALL] 📬 Entregando " + answers.size() + " respuestas pendientes a " + username);
        return answers.toArray(new CallAnswer[0]);
    }

    @Override
    public RtcCandidate[] getPendingRtcCandidates(String username, Current current) {
        List<RtcCandidate> candidates = pendingCandidates.remove(username);
        if (candidates == null || candidates.isEmpty()) {
            return new RtcCandidate[0];
        }
        return candidates.toArray(new RtcCandidate[0]);
    }

    // ========================================================================
    // MÉTODOS AUXILIARES
    // ========================================================================

    private void addPendingCall(String username, CallOffer offer) {
        pendingCalls.computeIfAbsent(username, k -> new ArrayList<>()).add(offer);
        System.out.println("   📥 Llamada agregada a queue de " + username);
    }

    private void addPendingAnswer(String username, CallAnswer answer) {
        pendingAnswers.computeIfAbsent(username, k -> new ArrayList<>()).add(answer);
        System.out.println("   📥 Respuesta agregada a queue de " + username + " con status: " + answer.status);
    }

    private void addPendingCandidate(String username, RtcCandidate candidate) {
        pendingCandidates.computeIfAbsent(username, k -> new ArrayList<>()).add(candidate);
    }
}