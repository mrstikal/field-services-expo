import { describe, expect, it } from 'vitest';
import {
  CreateConversationInputSchema,
  SendMessageInputSchema,
} from '../index';

describe('messaging input schemas', () => {
  it('validates CreateConversationInputSchema', () => {
    expect(
      CreateConversationInputSchema.safeParse({
        user1_id: 'user-a',
        user2_id: 'user-b',
      }).success
    ).toBe(true);

    expect(
      CreateConversationInputSchema.safeParse({
        user1_id: 'user-a',
        user2_id: '',
      }).success
    ).toBe(false);
  });

  it('validates SendMessageInputSchema', () => {
    expect(
      SendMessageInputSchema.safeParse({
        conversation_id: 'conv-1',
        content: 'Hello there',
      }).success
    ).toBe(true);

    expect(
      SendMessageInputSchema.safeParse({
        conversation_id: 'conv-1',
        content: '   ',
      }).success
    ).toBe(false);
  });
});
