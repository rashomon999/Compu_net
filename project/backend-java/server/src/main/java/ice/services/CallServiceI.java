package ice.services;

import ChatSystem.*;
import com.zeroc.Ice.Current;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class CallServiceI implements CallService {
    
    private final Map<String, CallCallbackPrx> subscribers = new ConcurrentHashMap<>();
    private final Map<String, CallOffer> activeCalls = new ConcurrentHashMap<>();
    private final Map<String, String[]> callParticipants = new ConcurrentHashMap<>();

    @Override
    public String initiateCall(String caller, String callee, CallType type, String sdp, Current current) {
        System.out.println("[CALL] 📞 Nueva llamada: " + caller + " → " + callee + " (" + type + ")");
        
        CallCallbackPrx calleeCallback = subscribers.get(callee);
        if (calleeCallback == null) {
            System.out.println("   ⚠️  Usuario no disponible: " + callee);
            return "ERROR: Usuario no disponible";
        }
        
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
        
        try {
            calleeCallback.onIncomingCallAsync(offer).whenComplete((result, ex) -> {
                if (ex != null) {
                    System.err.println("[ERROR] No se pudo notificar llamada a " + callee);
                    activeCalls.remove(callId);
                    callParticipants.remove(callId);
                } else {
                    System.out.println("   ✅ Notificación enviada a " + callee);
                }
            });
            
            return "SUCCESS:" + callId;
            
        } catch (Exception e) {
            System.err.println("[ERROR] Error iniciando llamada: " + e.getMessage());
            activeCalls.remove(callId);
            callParticipants.remove(callId);
            return "ERROR: No se pudo iniciar llamada";
        }
    }

    @Override
    public String answerCall(String callId, String callee, CallStatus status, String sdp, Current current) {
        System.out.println("[CALL] 📞 Respuesta de llamada: " + callId + " - " + status);
        
        CallOffer offer = activeCalls.get(callId);
        if (offer == null) {
            return "ERROR: Llamada no encontrada";
        }
        
        if (!offer.callee.equals(callee)) {
            return "ERROR: No autorizado";
        }
        
        CallAnswer answer = new CallAnswer();
        answer.callId = callId;
        answer.sdp = sdp;
        answer.status = status;
        
        CallCallbackPrx callerCallback = subscribers.get(offer.caller);
        if (callerCallback != null) {
            try {
                callerCallback.onCallAnswerAsync(answer).whenComplete((result, ex) -> {
                    if (ex != null) {
                        System.err.println("[ERROR] No se pudo notificar respuesta");
                    } else {
                        System.out.println("   ✅ Respuesta enviada a " + offer.caller);
                    }
                });
            } catch (Exception e) {
                System.err.println("[ERROR] Error enviando respuesta: " + e.getMessage());
            }
        }
        
        // ✅ CORREGIDO: usar valores sin guiones bajos
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
                callback.onCallEndedAsync(callId, "Usuario terminó la llamada");
            } catch (Exception e) {
                System.err.println("[ERROR] Error notificando fin de llamada: " + e.getMessage());
            }
        }
        
        activeCalls.remove(callId);
        callParticipants.remove(callId);
    }

    @Override
    public void sendRtcCandidate(String callId, String username, String candidate, 
                                  String sdpMid, int sdpMLineIndex, Current current) {
        System.out.println("[CALL] 🧊 RTC candidate de " + username + " para llamada " + callId);
        
        String[] participants = callParticipants.get(callId);
        if (participants == null) {
            return;
        }
        
        String otherUser = participants[0].equals(username) ? participants[1] : participants[0];
        CallCallbackPrx callback = subscribers.get(otherUser);
        
        if (callback != null) {
            // ✅ CORREGIDO: usar RtcCandidate en lugar de IceCandidate
            RtcCandidate rtcCandidate = new RtcCandidate();
            rtcCandidate.callId = callId;
            rtcCandidate.candidate = candidate;
            rtcCandidate.sdpMid = sdpMid;
            rtcCandidate.sdpMLineIndex = sdpMLineIndex;
            
            try {
                callback.onRtcCandidateAsync(rtcCandidate);
            } catch (Exception e) {
                System.err.println("[ERROR] Error enviando RTC candidate: " + e.getMessage());
            }
        }
    }

    @Override
    public void subscribe(String username, CallCallbackPrx callback, Current current) {
        subscribers.put(username, callback);
        System.out.println("[CALL] 📞 Usuario suscrito a llamadas: " + username);
    }

    @Override
    public void unsubscribe(String username, Current current) {
        subscribers.remove(username);
        System.out.println("[CALL] 📞 Usuario desuscrito de llamadas: " + username);
        
        activeCalls.entrySet().removeIf(entry -> {
            CallOffer offer = entry.getValue();
            if (offer.caller.equals(username) || offer.callee.equals(username)) {
                endCall(entry.getKey(), username, current);
                return true;
            }
            return false;
        });
    }
}