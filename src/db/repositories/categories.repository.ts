import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database';
import { Category, EntityStatus } from '../../types';
import { getCurrentIsoTimestamp } from '../../utils/dates';

export class CategoriesRepository {
  async getAll(includeArchived = false): Promise<Category[]> {
    const db = await getDatabase();
    const query = includeArchived
      ? 'SELECT * FROM categories ORDER BY name ASC;'
      : "SELECT * FROM categories WHERE status = 'ACTIVE' ORDER BY name ASC;";
    return await db.getAllAsync<Category>(query);
  }

  async getById(id: string): Promise<Category | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<Category>(
      'SELECT * FROM categories WHERE id = ?;',
      [id]
    );
  }

  async create(name: string, parentId: string | null = null): Promise<Category> {
    const db = await getDatabase();
    const now = getCurrentIsoTimestamp();
    const category: Category = {
      id: Crypto.randomUUID(),
      name: name.trim(),
      parent_id: parentId,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    };

    await db.runAsync(
      `INSERT INTO categories (id, name, parent_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        category.id,
        category.name,
        category.parent_id,
        category.status,
        category.created_at,
        category.updated_at,
      ]
    );

    return category;
  }

  async update(id: string, name: string, parentId: string | null = null): Promise<void> {
    const db = await getDatabase();
    const now = getCurrentIsoTimestamp();
    await db.runAsync(
      `UPDATE categories 
       SET name = ?, parent_id = ?, updated_at = ?
       WHERE id = ?;`,
      [name.trim(), parentId, now, id]
    );
  }

  async setStatus(id: string, status: EntityStatus): Promise<void> {
    const db = await getDatabase();
    const now = getCurrentIsoTimestamp();
    await db.runAsync(
      `UPDATE categories 
       SET status = ?, updated_at = ?
       WHERE id = ?;`,
      [status, now, id]
    );
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    // Foreign keys with SET NULL will preserve products
    await db.runAsync('DELETE FROM categories WHERE id = ?;', [id]);
  }
}

export const categoriesRepository = new CategoriesRepository();
