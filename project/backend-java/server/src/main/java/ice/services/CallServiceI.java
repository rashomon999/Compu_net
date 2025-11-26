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
    
    // ✅ Queue de llamadas pendientes por usuario (para polling)
    private final Map<String, List<CallOffer>> pendingCalls = new ConcurrentHashMap<>();
    private final Map<String, List<CallAnswer>> pendingAnswers = new ConcurrentHashMap<>();
    private final Map<String, List<RtcCandidate>> pendingCandidates = new ConcurrentHashMap<>();

    // ⚡ NUEVO: Para streaming de audio directo
    private final Map<String, String> activeAudioStreams = new ConcurrentHashMap<>(); // username -> otherUser
    
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
        callParticipants.put(callId, new String[]{caller, callee});
        
        // Intentar callback directo
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
        System.out.println("[CALL] 📞 Respuesta de llamada: " + callId + " - " + status);
        
        CallOffer offer = activeCalls.get(callId);
        if (offer == null) {
            System.out.println("   ❌ Llamada no encontrada: " + callId);
            return "ERROR: Llamada no encontrada";
        }
        
        if (!offer.callee.equals(callee)) {
            System.out.println("   ❌ No autorizado: " + callee);
            return "ERROR: No autorizado";
        }
        
        CallAnswer answer = new CallAnswer();
        answer.callId = callId;
        answer.sdp = sdp;
        answer.status = status;
        
        System.out.println("   📝 Creando respuesta con status: " + status);
        
        // Enviar al caller
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
        
        // ⚡ NUEVO: Si acepta, habilitar streaming de audio
        if (status == CallStatus.Accepted) {
            activeAudioStreams.put(offer.caller, callee);
            activeAudioStreams.put(callee, offer.caller);
            System.out.println("   🎵 Audio streaming habilitado: " + offer.caller + " ↔ " + callee);
        } else if (status == CallStatus.Rejected || status == CallStatus.NoAnswer) {
            activeCalls.remove(callId);
            callParticipants.remove(callId);
        }
        
        return "SUCCESS";
    }

    // ⚡ NUEVO: Streaming de audio directo (sin WebRTC)
    public void sendAudioChunk(String username, byte[] audioData, Current current) {
        String targetUser = activeAudioStreams.get(username);
        
        if (targetUser == null) {
            // No hay llamada activa
            return;
        }
        
        CallCallbackPrx targetCallback = subscribers.get(targetUser);
        if (targetCallback != null) {
            try {
                // Crear estructura de audio chunk usando la clase generada
                ChatSystem.AudioChunk chunk = new ChatSystem.AudioChunk(
                    audioData,                    // data
                    System.currentTimeMillis()    // timestamp
                );
                
                // Enviar de forma asíncrona
                targetCallback.ice_oneway().onAudioChunkAsync(chunk);
            } catch (Exception e) {
                System.err.println("   ❌ Error enviando audio chunk: " + e.getMessage());
            }
        }
    }

    @Override
    public void endCall(String callId, String username, Current current) {
        System.out.println("[CALL] 📞 Finalizando llamada: " + callId + " por " + username);
        
        String[] participants = callParticipants.get(callId);
        if (participants == null) {
            return;
        }
        
        String otherUser = participants[0].equals(username) ? participants[1] : participants[0];
        
        // ⚡ NUEVO: Limpiar streaming de audio
        activeAudioStreams.remove(username);
        activeAudioStreams.remove(otherUser);
        System.out.println("   🔇 Audio streaming deshabilitado");
        
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
        // Mantener para compatibilidad pero ya no se usa
        System.out.println("[CALL] ⚠️ sendRtcCandidate llamado pero no necesario con streaming directo");
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
        activeAudioStreams.remove(username);
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
    // MÉTODOS PARA POLLING (mantener los existentes)
    // ========================================================================

    public CallOffer[] getPendingIncomingCalls(String username, Current current) {
        List<CallOffer> calls = pendingCalls.remove(username);
        if (calls == null || calls.isEmpty()) {
            return new CallOffer[0];
        }
        System.out.println("[CALL] 📬 Entregando " + calls.size() + " llamadas pendientes a " + username);
        return calls.toArray(new CallOffer[0]);
    }

    public CallAnswer[] getPendingCallAnswers(String username, Current current) {
        List<CallAnswer> answers = pendingAnswers.remove(username);
        if (answers == null || answers.isEmpty()) {
            return new CallAnswer[0];
        }
        System.out.println("[CALL] 📬 Entregando " + answers.size() + " respuestas pendientes a " + username);
        return answers.toArray(new CallAnswer[0]);
    }

    public RtcCandidate[] getPendingRtcCandidates(String username, Current current) {
        List<RtcCandidate> candidates = pendingCandidates.remove(username);
        if (candidates == null || candidates.isEmpty()) {
            return new RtcCandidate[0];
        }
        return candidates.toArray(new RtcCandidate[0]);
    }

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