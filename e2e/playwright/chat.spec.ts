import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';
import process from 'node:process';
import type { Page } from '@playwright/test';

dotenv.config({ path: path.join(process.cwd(), 'env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const serviceSupabase =
  supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

async function signInAsDispatcher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('dispatcher2@demo.cz');
  await page.getByLabel('Password').fill('demo123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function openChatPage(page: Page) {
  await page.getByRole('link', { name: 'Chat' }).click();
  await expect(page).toHaveURL(/\/dashboard\/chat/);
  await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible();
}

async function openOrCreateConversation(page: Page) {
  await openChatPage(page);

  const emptyState = page.getByText('No conversations yet');
  if (await emptyState.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'New Message' }).click();
    await expect(page.getByRole('heading', { name: 'New Message' })).toBeVisible();

    const firstUser = page.locator('div.divide-y button').first();
    await expect(firstUser).toBeVisible();
    await firstUser.click();
  } else {
    await page.locator('div.divide-y button').first().click();
  }

  await expect(page).toHaveURL(/\/dashboard\/chat\/[^/]+$/);
  const conversationId = page.url().split('/').pop() ?? '';
  return conversationId;
}

test.describe('Web Chat E2E', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsDispatcher(page);
  });

  test('zobrazeni seznamu konverzaci', async ({ page }) => {
    await openChatPage(page);
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unread' })).toBeVisible();
  });

  test('filtrovani All/Unread', async ({ page }) => {
    await openChatPage(page);

    await page.getByRole('button', { name: 'Unread' }).click();
    await expect(page.getByRole('button', { name: 'Unread' })).toBeVisible();

    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
  });

  test('vytvoreni nove konverzace', async ({ page }) => {
    await openChatPage(page);

    await page.getByRole('button', { name: 'New Message' }).click();
    await expect(page.getByRole('heading', { name: 'New Message' })).toBeVisible();

    const firstUser = page.locator('div.divide-y button').first();
    await expect(firstUser).toBeVisible();
    await firstUser.click();

    await expect(page).toHaveURL(/\/dashboard\/chat\/[^/]+$/);
  });

  test('odeslani zpravy', async ({ page }) => {
    await openOrCreateConversation(page);

    const content = `[E2E] Chat message ${Date.now()}`;
    const input = page.getByPlaceholder('Type a message...');
    await input.fill(content);
    await input.press('Enter');

    await expect(page.getByText(content)).toBeVisible();
  });

  test('oznaceni jako prectene', async ({ page }) => {
    test.skip(!serviceSupabase, 'SUPABASE_URL/SUPABASE_SERVICE_KEY are required for deterministic unread setup');

    const conversationId = await openOrCreateConversation(page);
    const currentUserId = await page.evaluate(() => {
      const raw = localStorage.getItem('supabase.auth.token');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.user?.id ?? parsed?.currentSession?.user?.id ?? null;
    });

    test.skip(!currentUserId, 'Cannot determine current user id from session');

    const { data: conv, error: convError } = await serviceSupabase!
      .from('conversations')
      .select('user1_id, user2_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conv) {
      test.skip(true, 'Conversation lookup failed');
      return;
    }

    const senderId = conv.user1_id === currentUserId ? conv.user2_id : conv.user1_id;
    const unreadContent = `Unread ${Date.now()}`;

    const { error: msgError } = await serviceSupabase!.from('messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: unreadContent,
    });

    if (msgError) {
      test.skip(true, 'Failed to seed unread message');
      return;
    }

    await serviceSupabase!
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    await page.goto('/dashboard/chat');
    await page.getByRole('button', { name: 'Unread' }).click();

    const targetConversation = page.locator('button', { hasText: unreadContent }).first();
    await expect(targetConversation).toBeVisible();
    await targetConversation.click();

    await expect(page.getByText(unreadContent)).toBeVisible();

    await page.goto('/dashboard/chat');
    await page.getByRole('button', { name: 'Unread' }).click();
    await expect(page.getByText(unreadContent)).not.toBeVisible();
  });
});
