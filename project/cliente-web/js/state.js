export const state = {
  currentUsername: null,
  currentChat: null,
  isGroup: false,
  recentChats: [],
  myGroups: [],
  pollingInterval: null,
  notificationInterval: null // 
};

export function resetState() {
  state.currentUsername = null;
  state.currentChat = null;
  state.isGroup = false;
  state.recentChats = [];
  state.myGroups = [];
  state.pollingInterval = null;
  state.notificationInterval = null; // 
}
