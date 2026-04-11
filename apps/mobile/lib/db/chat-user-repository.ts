import type { SQLiteDatabase } from 'expo-sqlite';

export interface LocalChatUser {
  id: string;
  email: string;
  role: string;
  name: string;
  phone?: string | null;
  avatar_url?: string | null;
}

export async function upsertChatUsers(
  db: SQLiteDatabase,
  users: LocalChatUser[]
): Promise<void> {
  for (const user of users) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT OR REPLACE INTO users (
        id, email, role, name, phone, avatar_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM users WHERE id = ?), ?), ?)`,
      user.id,
      user.email,
      user.role,
      user.name,
      user.phone ?? '',
      user.avatar_url ?? null,
      user.id,
      now,
      now
    );
  }
}
