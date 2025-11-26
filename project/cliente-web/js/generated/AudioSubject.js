// ============================================
// AudioSubject.js - Compatible con Webpack + Polling
// ============================================

/* eslint-disable */
/* jshint ignore: start */

const initAudioSystem = () => {
    const Ice = window.Ice;
    
    if (!Ice) {
        console.error('❌ Ice.js no está disponible en AudioSubject.js');
        return null;
    }

    const _ModuleRegistry = Ice._ModuleRegistry;
    const Slice = Ice.Slice;

    let AudioSystem = _ModuleRegistry.module("AudioSystem");

// ✅ Verificar si ya está inicializado (evitar redefiniciones en hot reload)
if (AudioSystem.AudioObserver) {
    console.log('⚠️ AudioSystem ya estaba inicializado, reutilizando...');
    window.Ice.AudioSystem = AudioSystem;
    return AudioSystem;
}

    // ✅ Verificar si ya está inicializado (evitar redefiniciones en hot reload)
    if (AudioSystem.AudioObserver) {
        console.log('⚠️ AudioSystem ya estaba inicializado, reutilizando...');
        window.Ice.AudioSystem = AudioSystem;
        return AudioSystem;
    }

    // Definir AudioData (sequence<byte>)
    if (!AudioSystem.AudioDataHelper) {
        Slice.defineSequence(AudioSystem, "AudioDataHelper", "Ice.ByteHelper", true);
    }

    // Definir StringSeq (sequence<string>)
    if (!AudioSystem.StringSeqHelper) {
        Slice.defineSequence(AudioSystem, "StringSeqHelper", "Ice.StringHelper", false);
    }

    // ========================================
    // AUDIO OBSERVER (Cliente)
    // ========================================

    const iceC_AudioSystem_AudioObserver_ids = [
        "::AudioSystem::AudioObserver",
        "::Ice::Object"
    ];

    AudioSystem.AudioObserver = class extends Ice.Object {};
    AudioSystem.AudioObserverPrx = class extends Ice.ObjectPrx {};

    Slice.defineOperations(AudioSystem.AudioObserver, AudioSystem.AudioObserverPrx, iceC_AudioSystem_AudioObserver_ids, 0, {
        "receiveAudio": [, , , , , [["AudioSystem.AudioDataHelper"]], , , ,],
        "incomingCall": [, , , , , [[7]], , , ,],
        "callAccepted": [, , , , , [[7]], , , ,],
        "callRejected": [, , , , , [[7]], , , ,],
        "callEnded": [, , , , , [[7]], , , ,]
    });

    // ========================================
    // AUDIO SUBJECT (Servidor)
    // ========================================

    const iceC_AudioSystem_AudioSubject_ids = [
        "::AudioSystem::AudioSubject",
        "::Ice::Object"
    ];

    AudioSystem.AudioSubject = class extends Ice.Object {};
    AudioSystem.AudioSubjectPrx = class extends Ice.ObjectPrx {};

    Slice.defineOperations(AudioSystem.AudioSubject, AudioSystem.AudioSubjectPrx, iceC_AudioSystem_AudioSubject_ids, 0, {
        "attach": [, , , , , [[7], ["AudioSystem.AudioObserverPrx"]], , , ,],
        "detach": [, , , , , [[7]], , , ,],
        "sendAudio": [, , , , , [[7], ["AudioSystem.AudioDataHelper"]], , , ,],
        "getConnectedUsers": [, , , , ["AudioSystem.StringSeqHelper"], , , , ,],
        "startCall": [, , , , , [[7], [7]], , , ,],
        "acceptCall": [, , , , , [[7], [7]], , , ,],
        "rejectCall": [, , , , , [[7], [7]], , , ,],
        "hangup": [, , , , , [[7], [7]], , , ,],
        // ✅ NUEVO: Métodos de polling
        "getPendingIncomingCalls": [, , , , ["AudioSystem.StringSeqHelper"], [[7]], , , ,],
        "getPendingAcceptedCalls": [, , , , ["AudioSystem.StringSeqHelper"], [[7]], , , ,],
        "getPendingRejectedCalls": [, , , , ["AudioSystem.StringSeqHelper"], [[7]], , , ,],
        "getPendingEndedCalls": [, , , , ["AudioSystem.StringSeqHelper"], [[7]], , , ,]
    });

    // Exportar a window.Ice
    window.Ice.AudioSystem = AudioSystem;
    
    console.log('✅ AudioSystem cargado y exportado correctamente');
    
    return AudioSystem;
};

// ✅ CRÍTICO: Exportar como default
export default initAudioSystem;

// NO auto-inicializar, dejamos que main.js lo haga
console.log('📦 AudioSubject.js módulo cargado, esperando inicialización...');