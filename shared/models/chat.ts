import { pgTable, serial, integer, text, timestamp, varchar, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Legacy AI conversation tables (kept for compatibility)
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// ============================================
// Discord-style Crew Chat Tables
// ============================================

// Chat channels (like Discord channels)
export const chatChannels = pgTable("chat_channels", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id"),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default('general'), // 'general', 'job', 'announcement'
  jobId: varchar("job_id"), // Link to job if it's a job-specific channel
  icon: text("icon"), // emoji or icon name
  isArchived: boolean("is_archived").notNull().default(false),
  createdBy: varchar("created_by"), // crew member id
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("chat_channels_organization_id_idx").on(table.organizationId),
]);

export const insertChatChannelSchema = createInsertSchema(chatChannels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertChatChannel = z.infer<typeof insertChatChannelSchema>;
export type ChatChannel = typeof chatChannels.$inferSelect;

// Chat messages in channels
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey(),
  channelId: varchar("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull(), // crew member id
  senderName: text("sender_name").notNull(), // denormalized for performance
  senderColor: text("sender_color"), // crew color for avatar
  content: text("content").notNull(),
  imageUrls: text("image_urls").array(), // uploaded photos
  isPinned: boolean("is_pinned").notNull().default(false),
  isEdited: boolean("is_edited").notNull().default(false),
  replyToId: varchar("reply_to_id"), // for threaded replies
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("chat_messages_channel_id_idx").on(table.channelId),
  index("chat_messages_created_at_idx").on(table.createdAt),
]);

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Direct messages between crew members
export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id"),
  senderId: varchar("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderColor: text("sender_color"),
  recipientId: varchar("recipient_id").notNull(),
  content: text("content").notNull(),
  imageUrls: text("image_urls").array(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("direct_messages_organization_id_idx").on(table.organizationId),
  index("direct_messages_sender_recipient_idx").on(table.senderId, table.recipientId),
]);

export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;

// Track last read message per channel per user (for unread counts)
export const channelReadStatus = pgTable("channel_read_status", {
  id: varchar("id").primaryKey(),
  channelId: varchar("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
  crewMemberId: varchar("crew_member_id").notNull(),
  lastReadAt: timestamp("last_read_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("channel_read_status_channel_crew_idx").on(table.channelId, table.crewMemberId),
]);

export const insertChannelReadStatusSchema = createInsertSchema(channelReadStatus).omit({
  id: true,
});
export type InsertChannelReadStatus = z.infer<typeof insertChannelReadStatusSchema>;
export type ChannelReadStatus = typeof channelReadStatus.$inferSelect;
