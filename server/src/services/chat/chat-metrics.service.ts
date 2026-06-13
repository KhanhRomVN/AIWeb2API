/**
 * Chat Metrics Service
 *
 * Re-exports `recordChatMetrics` from the central metrics service so that
 * chat-specific code can import it from within the chat service folder.
 */
export { recordChatMetrics } from '../metrics.service';
