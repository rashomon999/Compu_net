// ============================================
// js/generated/ChatSystem.js - Sistema Profesor (CON LLAMADAS)
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

// ========================================================================
// ⚡ LLAMADAS (SISTEMA PROFESOR)
// ========================================================================

const iceC_ChatSystem_CallCallback_ids = [
  "::ChatSystem::CallCallback",
  "::Ice::Object"
];

ChatSystem.CallCallback = class extends Ice.Object {};
ChatSystem.CallCallbackPrx = class extends Ice.ObjectPrx {};

Slice.defineOperations(ChatSystem.CallCallback, ChatSystem.CallCallbackPrx, iceC_ChatSystem_CallCallback_ids, 0, {
  "receiveAudio": [, , , , , [["Ice.ByteSeqHelper"]], , , ,],
  "incomingCall": [, , , , , [[7]], , , ,],
  "callAccepted": [, , , , , [[7]], , , ,],
  "callRejected": [, , , , , [[7]], , , ,],
  "callColgada": [, , , , , [[7]], , , ,]
});

const iceC_ChatSystem_CallService_ids = [
  "::ChatSystem::CallService",
  "::Ice::Object"
];

ChatSystem.CallService = class extends Ice.Object {};
ChatSystem.CallServicePrx = class extends Ice.ObjectPrx {};

Slice.defineOperations(ChatSystem.CallService, ChatSystem.CallServicePrx, iceC_ChatSystem_CallService_ids, 0, {
  "sendAudio": [, , , , , [[7], ["Ice.ByteSeqHelper"]], , , ,],
  "startCall": [, , , , , [[7], [7]], , , ,],
  "acceptCall": [, , , , , [[7], [7]], , , ,],
  "rejectCall": [, , , , , [[7], [7]], , , ,],
  "colgar": [, , , , , [[7], [7]], , , ,],
  "subscribe": [, , , , , [[7], ["ChatSystem.CallCallbackPrx"]], , , ,],
  "unsubscribe": [, , , , , [[7]], , , ,],
  "getConnectedUsers": [, , , , ["ChatSystem.StringSeqHelper"], , , , ,]
});

window.Ice.ChatSystem = ChatSystem;

console.log('✅ ChatSystem.js cargado (Sistema Profesor con Llamadas)');
console.log('📋 Servicios disponibles:', Object.keys(ChatSystem).filter(k => k.includes('Service')));
}

if (typeof window !== 'undefined') {
  window._initializeChatSystem = initializeChatSystem;
}