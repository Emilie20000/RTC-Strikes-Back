import { useAppStore, type User, type Channel } from "./store";

describe("store", () => {
  beforeEach(() => {
    useAppStore.setState({
      servers: [],
      activeServerId: null,
      channels: [],
      activeChannelId: null,
      activeVoiceChannelId: null,
      voiceStates: {},
      speakingUsers: {},
      messagesByChannel: {},
      currentUser: null,
      serverMembers: {},
    });
  });

  it("addMessage évite les doublons", () => {
    const channelId = "c1";
    useAppStore.getState().setMessagesForChannel(channelId, []);
    useAppStore.getState().addMessage({
      id: "m1",
      channelId,
      author: "a",
      content: "x",
      createdAt: 1,
    });
    useAppStore.getState().addMessage({
      id: "m1",
      channelId,
      author: "a",
      content: "y",
      createdAt: 2,
    });
    const msgs = useAppStore.getState().messagesByChannel[channelId];
    expect(msgs).toHaveLength(1);
  });

  it("updateGlobalUser met à jour membres, DM et currentUser", () => {
    const user: User = { id: "u1", username: "old", email: "e" };
    const channel: Channel = { id: "dm1", kind: "DM", recipientId: "u1", name: "old" };
    useAppStore.getState().setCurrentUser(user);
    useAppStore.getState().setChannels([channel]);
    useAppStore.getState().setServerMembers("s1", [
      { user_id: "u1", username: "old", role: "MEMBER", joined_at: "", status: "Online" },
    ]);
    useAppStore.getState().updateGlobalUser({ id: "u1", username: "new", email: "e", avatar_url: "a" });
    const members = useAppStore.getState().serverMembers["s1"];
    const updatedChannel = useAppStore.getState().channels.find((c) => c.id === "dm1");
    const current = useAppStore.getState().currentUser;
    expect(members![0].username).toBe("new");
    expect(updatedChannel!.name).toBe("new");
    expect(current!.username).toBe("new");
  });

  it("gère serveurs, salons, voice et statuts", () => {
    useAppStore.getState().setServers([{ id: "s1", name: "S" }]);
    useAppStore.getState().removeServer("s1");
    expect(useAppStore.getState().servers).toHaveLength(0);

    useAppStore.getState().setChannels([{ id: "c1", kind: "TEXT", name: "C" }]);
    useAppStore.getState().removeChannel("c1");
    expect(useAppStore.getState().channels).toHaveLength(0);

    useAppStore.getState().updateVoiceState({
      userId: "u1",
      username: "U",
      channelId: "vc",
      serverId: "s",
      muted: false,
      deafened: false,
    });
    useAppStore.getState().removeVoiceState("u1");
    expect(useAppStore.getState().voiceStates["u1"]).toBeUndefined();

    useAppStore.getState().setSpeakingUser("u2", true);
    useAppStore.getState().setSpeakingUser("u2", true);
    expect(useAppStore.getState().speakingUsers["u2"]).toBe(true);

    useAppStore.getState().setServerMembers("s1", [
      { user_id: "u1", username: "a", role: "MEMBER", joined_at: "", status: "Online" },
    ]);
    useAppStore.getState().updateMemberStatus("s1", "u1", "Away");
    expect(useAppStore.getState().serverMembers["s1"]![0].status).toBe("Away");
  });

  it("couvre les branches de updateMember / setActiveServerId", () => {
    useAppStore.getState().setActiveChannelId("c1");
    useAppStore.getState().setActiveServerId("s1");
    expect(useAppStore.getState().activeChannelId).toBeNull();

    useAppStore.getState().updateMember("missing", { id: "u1", username: "x", email: "e" });
    expect(useAppStore.getState().serverMembers["missing"]).toBeUndefined();

    useAppStore.getState().setServerMembers("s1", [
      { user_id: "u1", username: "old", role: "MEMBER", joined_at: "", status: "Online" },
    ]);
    useAppStore.getState().updateMember("s1", { id: "u1", username: "new", email: "e", avatar_url: "a" });
    expect(useAppStore.getState().serverMembers["s1"]![0].username).toBe("new");

    useAppStore.getState().setCurrentUser({ id: "u2", username: "me", email: "e" });
    useAppStore.getState().updateGlobalUser({ id: "u1", username: "other", email: "e" });
    expect(useAppStore.getState().currentUser!.username).toBe("me");
  });
});
