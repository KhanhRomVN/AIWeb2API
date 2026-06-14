import { z } from 'zod';
import { MessageSchema } from './message.types';

export const ChatRequestSchema = z.object({
  accountId: z.string().optional(),
  providerId: z.string().optional(),
  modelId: z.string(),
  messages: z.array(MessageSchema),
  stream: z.boolean().optional(),
  conversation_id: z.string().optional(),
  conversationId: z.string().optional(),
  parent_message_id: z.string().optional(),
  search: z.boolean().optional(),
  ref_file_ids: z.array(z.string()).optional(),
  thinking: z.boolean().optional(),
  temperature: z.number().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const StreamResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  choices: z.array(
    z.object({
      delta: z.object({
        content: z.string().optional(),
        role: z.string().optional(),
        thinking: z.string().optional(),
      }),
      index: z.number(),
      finish_reason: z.string().optional(),
    }),
  ),
});

export type StreamResponse = z.infer<typeof StreamResponseSchema>;
