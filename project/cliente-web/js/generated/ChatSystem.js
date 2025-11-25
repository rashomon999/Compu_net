// ============================================
// js/generated/ChatSystem.js - ENUMS CORREGIDOS
// ============================================

const Ice = typeof window !== 'undefined' && window.Ice ? window.Ice : null;

if (!Ice) {
  console.error('❌ Ice.js no está disponible. Esperando carga...');
  if (typeof window !== 'undefined') {
    window._chatSystemPending = true;
  }
} else {
  console.log('✅ Ice.js disponible para ChatSystem');
  initializeChatSystem(Ice);
}

function initializeChatSystem(Ice) {

  const _ModuleRegistry = Ice._ModuleRegistry;
  const Slice = Ice.Slice;

  let ChatSystem = _ModuleRegistry.module("ChatSystem");

// ========================================================================
// ESTRUCTURAS BÁSICAS
// ========================================================================

ChatSystem.Message = class {
  constructor(sender = "", recipient = "", content = "", type = "", timestamp = "", isGroup = false) {
    this.sender = sender;
    this.recipient = recipient;
    this.content = content;
    this.type = type;
    this.timestamp = timestamp;
    this.isGroup = isGroup;
  }

  _write(ostr) {
    ostr.writeString(this.sender);
    ostr.writeString(this.recipient);
    ostr.writeString(this.content);
    ostr.writeString(this.type);
    ostr.writeString(this.timestamp);
    ostr.writeBool(this.isGroup);
  }

  _read(istr) {
    this.sender = istr.readString();
    this.recipient = istr.readString();
    this.content = istr.readString();
    this.type = istr.readString();
    this.timestamp = istr.readString();
    this.isGroup = istr.readBool();
  }

  static get minWireSize() {
    return 6;
  }
};

Slice.defineStruct(ChatSystem.Message, true, true);
Slice.defineSequence(ChatSystem, "MessageSeqHelper", "ChatSystem.Message", false);
Slice.defineSequence(ChatSystem, "StringSeqHelper", "Ice.StringHelper", false);

ChatSystem.GroupInfo = class {
  constructor(name = "", creator = "", members = null, memberCount = 0, createdAt = "") {
    this.name = name;
    this.creator = creator;
    this.members = members;
    this.memberCount = memberCount;
    this.createdAt = createdAt;
  }

  _write(ostr) {
    ostr.writeString(this.name);
    ostr.writeString(this.creator);
    ChatSystem.StringSeqHelper.write(ostr, this.members);
    ostr.writeInt(this.memberCount);
    ostr.writeString(this.createdAt);
  }

  _read(istr) {
    this.name = istr.readString();
    this.creator = istr.readString();
    this.members = ChatSystem.StringSeqHelper.read(istr);
    this.memberCount = istr.readInt();
    this.createdAt = istr.readString();
  }

  static get minWireSize() {
    return 8;
  }
};

Slice.defineStruct(ChatSystem.GroupInfo, true, true);
Slice.defineSequence(ChatSystem, "GroupSeqHelper", "ChatSystem.GroupInfo", false);

ChatSystem.VoiceNote = class {
  constructor(id = "", sender = "", target = "", audioFileRef = "", isGroup = false, timestamp = "", durationSeconds = 0) {
    this.id = id;
    this.sender = sender;
    this.target = target;
    this.audioFileRef = audioFileRef;
    this.isGroup = isGroup;
    this.timestamp = timestamp;
    this.durationSeconds = durationSeconds;
  }

  _write(ostr) {
    ostr.writeString(this.id);
    ostr.writeString(this.sender);
    ostr.writeString(this.target);
    ostr.writeString(this.audioFileRef);
    ostr.writeBool(this.isGroup);
    ostr.writeString(this.timestamp);
    ostr.writeInt(this.durationSeconds);
  }

  _read(istr) {
    this.id = istr.readString();
    this.sender = istr.readString();
    this.target = istr.readString();
    this.audioFileRef = istr.readString();
    this.isGroup = istr.readBool();
    this.timestamp = istr.readString();
    this.durationSeconds = istr.readInt();
  }

  static get minWireSize() {
    return 10;
  }
};

Slice.defineStruct(ChatSystem.VoiceNote, true, true);
Slice.defineSequence(ChatSystem, "VoiceNoteSeqHelper", "ChatSystem.VoiceNote", false);

// ========================================================================
// ✅ ENUMS CORREGIDOS PARA LLAMADAS
// ========================================================================

/**
 * Tipos de llamada
 */
ChatSystem.CallType = Slice.defineEnum([
  ['AudioOnly', 0], 
  ['Video', 1]
]);

/**
 * ✅ CRÍTICO: Estados de llamada con nombres STRING
 * Esto permite comparación correcta en JavaScript
 */
ChatSystem.CallStatus = Slice.defineEnum([
  ['Ringing', 0],
  ['Accepted', 1],
  ['Rejected', 2],
  ['Ended', 3],
  ['Busy', 4],
  ['NoAnswer', 5]
]);

// ✅ Agregar constantes de ayuda para comparación fácil
ChatSystem.CallStatus.RINGING = 'Ringing';
ChatSystem.CallStatus.ACCEPTED = 'Accepted';
ChatSystem.CallStatus.REJECTED = 'Rejected';
ChatSystem.CallStatus.ENDED = 'Ended';
ChatSystem.CallStatus.BUSY = 'Busy';
ChatSystem.CallStatus.NO_ANSWER = 'NoAnswer';

// ========================================================================
// ESTRUCTURAS PARA LLAMADAS
// ========================================================================

ChatSystem.CallOffer = class {
  constructor(callId = "", caller = "", callee = "", callType = ChatSystem.CallType.AudioOnly, sdp = "", timestamp = new Ice.Long(0, 0)) {
    this.callId = callId;
    this.caller = caller;
    this.callee = callee;
    this.callType = callType;
    this.sdp = sdp;
    this.timestamp = timestamp;
  }

  _write(ostr) {
    ostr.writeString(this.callId);
    ostr.writeString(this.caller);
    ostr.writeString(this.callee);
    ChatSystem.CallType._write(ostr, this.callType);
    ostr.writeString(this.sdp);
    ostr.writeLong(this.timestamp);
  }

  _read(istr) {
    this.callId = istr.readString();
    this.caller = istr.readString();
    this.callee = istr.readString();
    this.callType = ChatSystem.CallType._read(istr);
    this.sdp = istr.readString();
    this.timestamp = istr.readLong();
  }

  static get minWireSize() {
    return 13;
  }
};

Slice.defineStruct(ChatSystem.CallOffer, true, true);

ChatSystem.CallAnswer = class {
  constructor(callId = "", sdp = "", status = ChatSystem.CallStatus.Ringing) {
    this.callId = callId;
    this.sdp = sdp;
    this.status = status;
  }

  _write(ostr) {
    ostr.writeString(this.callId);
    ostr.writeString(this.sdp);
    ChatSystem.CallStatus._write(ostr, this.status);
  }

  _read(istr) {
    this.callId = istr.readString();
    this.sdp = istr.readString();
    this.status = ChatSystem.CallStatus._read(istr);
  }

  static get minWireSize() {
    return 3;
  }
};

Slice.defineStruct(ChatSystem.CallAnswer, true, true);

ChatSystem.RtcCandidate = class {
  constructor(callId = "", candidate = "", sdpMid = "", sdpMLineIndex = 0) {
    this.callId = callId;
    this.candidate = candidate;
    this.sdpMid = sdpMid;
    this.sdpMLineIndex = sdpMLineIndex;
  }

  _write(ostr) {
    ostr.writeString(this.callId);
    ostr.writeString(this.candidate);
    ostr.writeString(this.sdpMid);
    ostr.writeInt(this.sdpMLineIndex);
  }

  _read(istr) {
    this.callId = istr.readString();
    this.candidate = istr.readString();
    this.sdpMid = istr.readString();
    this.sdpMLineIndex = istr.readInt();
  }

  static get minWireSize() {
    return 7;
  }
};

Slice.defineStruct(ChatSystem.RtcCandidate, true, true);

Slice.defineSequence(ChatSystem, "CallOfferSeqHelper", "ChatSystem.CallOffer", false);
Slice.defineSequence(ChatSystem, "CallAnswerSeqHelper", "ChatSystem.CallAnswer", false);
Slice.defineSequence(ChatSystem, "RtcCandidateSeqHelper", "ChatSystem.RtcCandidate", false);

// ========================================================================
// SERVICIOS
// ========================================================================

const iceC_ChatSystem_ChatService_ids = [
  "::ChatSystem::ChatService",
  "::Ice::Object"
];

ChatSystem.ChatService = class extends Ice.Object {};
ChatSystem.ChatServicePrx = class extends Ice.ObjectPrx {};

Slice.defineOperations(ChatSystem.ChatService, ChatSystem.ChatServicePrx, iceC_ChatSystem_ChatService_ids, 0, {
  "sendPrivateMessage": [, , , , [7], [[7], [7], [7]], , , ,],
  "sendGroupMessage": [, , , , [7], [[7], [7], [7]], , , ,],
  "getConversationHistory": [, , , , [7], [[7], [7]], , , ,],
  "getGroupHistory": [, , , , [7], [[7], [7]], , , ,],
  "getRecentConversations": [, , , , ["ChatSystem.StringSeqHelper"], [[7]], , , ,]
});

const iceC_ChatSystem_GroupService_ids = [
  "::ChatSystem::GroupService",
  "::Ice::Object"
];

ChatSystem.GroupService = class extends Ice.Object {};
ChatSystem.GroupServicePrx = class extends Ice.ObjectPrx {};

Slice.defineOperations(ChatSystem.GroupService, ChatSystem.GroupServicePrx, iceC_ChatSystem_GroupService_ids, 0, {
  "createGroup": [, , , , [7], [[7], [7]], , , ,],
  "joinGroup": [, , , , [7], [[7], [7]], , , ,],
  "leaveGroup": [, , , , [7], [[7], [7]], , , ,],
  "listUserGroups": [, , , , ["ChatSystem.GroupSeqHelper"], [[7]], , , ,],
  "getGroupMembers": [, , , , ["ChatSystem.StringSeqHelper"], [[7]], , , ,]
});

const iceC_ChatSystem_NotificationCallback_ids = [
  "::ChatSystem::NotificationCallback",
  "::Ice::Object"
];

ChatSystem.NotificationCallback = class extends Ice.Object {};
ChatSystem.NotificationCallbackPrx = class extends Ice.ObjectPrx {};

Slice.defineOperations(ChatSystem.NotificationCallback, ChatSystem.NotificationCallbackPrx, iceC_ChatSystem_NotificationCallback_ids, 0, {
  "onNewMessage": [, , , , , [[ChatSystem.Message]], , , ,],
  "onGroupCreated": [, , , , , [[7], [7]], , , ,],
  "onUserJoinedGroup": [, , , , , [[7], [7]], , , ,]
});

const iceC_ChatSystem_NotificationService_ids = [
  "::ChatSystem::NotificationService",
  "::Ice::Object"
];

ChatSystem.NotificationService = class extends Ice.Object {};
ChatSystem.NotificationServicePrx = class extends Ice.ObjectPrx {};

Slice.defineOperations(ChatSystem.NotificationService, ChatSystem.NotificationServicePrx, iceC_ChatSystem_NotificationService_ids, 0, {
  "subscribe": [, , , , , [[7], ["ChatSystem.NotificationCallbackPrx"]], , , ,],
  "unsubscribe": [, , , , , [[7]], , , ,],
  "getNewMessages": [, , , , ["ChatSystem.MessageSeqHelper"], [[7]], , , ,],
  "markAsRead": [, , , , , [[7]], , , ,]
});

const iceC_ChatSystem_VoiceService_ids = [
  "::ChatSystem::VoiceService",
  "::Ice::Object"
];

ChatSystem.VoiceService = class extends Ice.Object {};
ChatSystem.VoiceServicePrx = class extends Ice.ObjectPrx {};

Slice.defineOperations(ChatSystem.VoiceService, ChatSystem.VoiceServicePrx, iceC_ChatSystem_VoiceService_ids, 0, {
  "saveVoiceNote": [, , , , [7], [[7], [7], [7], [1]], , , ,],
  "getVoiceNote": [, , , , [7], [[7]], , , ,],
  "getVoiceNotesHistory": [, , , , ["ChatSystem.VoiceNoteSeqHelper"], [[7], [7]], , , ,],
  "getGroupVoiceNotes": [, , , , ["ChatSystem.VoiceNoteSeqHelper"], [[7]], , , ,]
});

const iceC_ChatSystem_CallCallback_ids = [
  "::ChatSystem::CallCallback",
  "::Ice::Object"
];

ChatSystem.CallCallback = class extends Ice.Object {};
ChatSystem.CallCallbackPrx = class extends Ice.ObjectPrx {};

Slice.defineOperations(ChatSystem.CallCallback, ChatSystem.CallCallbackPrx, iceC_ChatSystem_CallCallback_ids, 0, {
  "onIncomingCall": [, , , , , [[ChatSystem.CallOffer]], , , ,],
  "onCallAnswer": [, , , , , [[ChatSystem.CallAnswer]], , , ,],
  "onRtcCandidate": [, , , , , [[ChatSystem.RtcCandidate]], , , ,],
  "onCallEnded": [, , , , , [[7], [7]], , , ,]
});

const iceC_ChatSystem_CallService_ids = [
  "::ChatSystem::CallService",
  "::Ice::Object"
];

ChatSystem.CallService = class extends Ice.Object {};
ChatSystem.CallServicePrx = class extends Ice.ObjectPrx {};

Slice.defineOperations(ChatSystem.CallService, ChatSystem.CallServicePrx, iceC_ChatSystem_CallService_ids, 0, {
  "initiateCall": [, , , , [7], [[7], [7], [ChatSystem.CallType._helper], [7]], , , ,],
  "answerCall": [, , , , [7], [[7], [7], [ChatSystem.CallStatus._helper], [7]], , , ,],
  "endCall": [, , , , , [[7], [7]], , , ,],
  "sendRtcCandidate": [, , , , , [[7], [7], [7], [7], [3]], , , ,],
  "subscribe": [, , , , , [[7], ["ChatSystem.CallCallbackPrx"]], , , ,],
  "unsubscribe": [, , , , , [[7]], , , ,],
  "getPendingIncomingCalls": [, , , , ["ChatSystem.CallOfferSeqHelper"], [[7]], , , ,],
  "getPendingCallAnswers": [, , , , ["ChatSystem.CallAnswerSeqHelper"], [[7]], , , ,],
  "getPendingRtcCandidates": [, , , , ["ChatSystem.RtcCandidateSeqHelper"], [[7]], , , ,]
});

window.Ice.ChatSystem = ChatSystem;

console.log('✅ ChatSystem.js cargado (enums corregidos)');
console.log('📋 CallStatus valores:', {
  RINGING: ChatSystem.CallStatus.RINGING,
  ACCEPTED: ChatSystem.CallStatus.ACCEPTED,
  REJECTED: ChatSystem.CallStatus.REJECTED
});
}

if (typeof window !== 'undefined') {
  window._initializeChatSystem = initializeChatSystem;
}