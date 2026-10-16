import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  authIssuance: defineTable({ key: v.string(), startedAt: v.number(), count: v.number() })
    .index("by_key", ["key"])
    .index("by_started", ["startedAt"]),
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    sessionId: v.id("authSessions"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    binding: v.string(),
  })
    .index("by_endpoint", ["endpoint"])
    .index("by_user", ["userId"]),
  profiles: defineTable({
    userId: v.id("users"),
    username: v.string(),
    name: v.string(),
    bio: v.string(),
    lastSeenAt: v.optional(v.number()),
    avatar: v.optional(v.id("_storage")),
    deleted: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_username", ["username"])
    .index("by_avatar", ["avatar"]),
  conversations: defineTable({
    kind: v.union(v.literal("dm"), v.literal("group")),
    title: v.string(),
    pair: v.optional(v.string()),
    updatedAt: v.number(),
    closed: v.optional(v.boolean()),
  }).index("by_pair", ["pair"]),
  members: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    readAt: v.number(),
    muted: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId", "updatedAt"])
    .index("by_conversation", ["conversationId"])
    .index("by_pair", ["conversationId", "userId"]),
  messages: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    body: v.string(),
    operationId: v.string(),
    replyId: v.optional(v.id("messages")),
    attachmentId: v.optional(v.id("attachments")),
    sendFingerprint: v.optional(v.string()),
    revision: v.optional(v.number()),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    kind: v.union(v.literal("text"), v.literal("system"), v.literal("call")),
    event: v.optional(
      v.object({
        action: v.union(
          v.literal("created"),
          v.literal("renamed"),
          v.literal("added"),
          v.literal("joined"),
          v.literal("left"),
          v.literal("removed"),
          v.literal("promoted"),
          v.literal("demoted"),
        ),
        actorName: v.string(),
        targetName: v.optional(v.string()),
        title: v.optional(v.string()),
      }),
    ),
    callData: v.optional(
      v.object({
        callId: v.id("calls"),
        kind: v.union(v.literal("audio"), v.literal("video")),
        outcome: v.union(
          v.literal("completed"),
          v.literal("missed"),
          v.literal("declined"),
          v.literal("canceled"),
          v.literal("interrupted"),
        ),
        durationSeconds: v.number(),
      }),
    ),
    pinned: v.boolean(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_author", ["userId"])
    .index("by_operation", ["userId", "operationId"])
    .index("by_pinned", ["conversationId", "pinned"])
    .searchIndex("search_body", { searchField: "body", filterFields: ["conversationId", "kind"] }),
  attachments: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    storageId: v.id("_storage"),
    name: v.string(),
    size: v.number(),
    messageId: v.optional(v.id("messages")),
    expiresAt: v.optional(v.number()),
  })
    .index("by_storage", ["storageId"])
    .index("by_expiry", ["expiresAt"])
    .index("by_user", ["userId"]),
  hidden: defineTable({ userId: v.id("users"), messageId: v.id("messages") })
    .index("by_message", ["messageId"])
    .index("by_pair", ["userId", "messageId"]),
  reactions: defineTable({ messageId: v.id("messages"), userId: v.id("users"), emoji: v.string() })
    .index("by_message", ["messageId"])
    .index("by_pair", ["messageId", "userId"]),
  invites: defineTable({
    conversationId: v.id("conversations"),
    code: v.string(),
    expiresAt: v.number(),
    revoked: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_conversation", ["conversationId"]),
  presence: defineTable({
    userId: v.id("users"),
    session: v.string(),
    expiresAt: v.number(),
    conversationId: v.optional(v.id("conversations")),
    typingUntil: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["userId", "session"])
    .index("by_expiry", ["expiresAt"]),
  quotas: defineTable({
    userId: v.id("users"),
    key: v.string(),
    at: v.number(),
    count: v.number(),
  }).index("by_pair", ["userId", "key"]),
  blocks: defineTable({ userId: v.id("users"), targetId: v.id("users") }).index("by_pair", [
    "userId",
    "targetId",
  ]),
  reports: defineTable({
    userId: v.id("users"),
    targetId: v.id("users"),
    reason: v.string(),
    status: v.union(v.literal("open"), v.literal("resolved")),
  }).index("by_status", ["status"]),
  calls: defineTable({
    conversationId: v.id("conversations"),
    callerId: v.id("users"),
    callerSession: v.string(),
    recipientId: v.id("users"),
    kind: v.union(v.literal("audio"), v.literal("video")),
    state: v.union(v.literal("ringing"), v.literal("active"), v.literal("ended")),
    expiresAt: v.number(),
    callerHeartbeat: v.number(),
    recipientHeartbeat: v.number(),
    acceptedSession: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    reason: v.optional(v.string()),
  })
    .index("by_caller", ["callerId", "state"])
    .index("by_recipient", ["recipientId", "state"]),
  signals: defineTable({ callId: v.id("calls"), senderId: v.id("users"), body: v.string() }).index(
    "by_call",
    ["callId"],
  ),
});
