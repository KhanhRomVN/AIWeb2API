/**
 * Chat Persistence Service
 *
 * NOTE: Local message/conversation persistence has been removed from this backend.
 * The tables `local_conversations` and `local_messages` were dropped as part of a
 * schema cleanup. These functions are kept as no-ops so that any callers referencing
 * them continue to compile and run without errors.
 */

/**
 * No-op stub. Message persistence is handled client-side.
 */
export async function saveMessage(
  _conversationId: string,
  _role: string,
  _content: string,
  _accountId?: string,
): Promise<void> {
  // Intentionally empty — backend does not persist messages
}

/**
 * No-op stub. Conversation ID migration is no longer needed.
 */
export async function migrateConversationId(
  _oldId: string,
  _newId: string,
): Promise<void> {
  // Intentionally empty — backend does not persist conversations
}
