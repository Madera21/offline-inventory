import { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATION_V1, MIGRATION_V2, MIGRATION_V3 } from './schema';
import { getCurrentIsoTimestamp } from '../utils/dates';

interface MigrationRecord {
  version: number;
  applied_at: string;
}

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Ensure foreign keys are enabled
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Ensure migration tracking table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = await db.getAllAsync<MigrationRecord>(
    'SELECT version, applied_at FROM schema_migrations ORDER BY version ASC;'
  );

  const appliedVersions = new Set(appliedRows.map((row) => row.version));

  if (!appliedVersions.has(1)) {
    console.log('[DB] Applying Migration V1...');
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATION_V1);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);',
        [1, getCurrentIsoTimestamp()]
      );

      // Seed default settings if not already present
      await db.runAsync(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('currency_code', 'PHP');"
      );
      await db.runAsync(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('currency_symbol', '₱');"
      );
      await db.runAsync(
        "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('allow_negative_stock', 'false');"
      );
    });
    console.log('[DB] Migration V1 applied successfully.');
  }

  if (!appliedVersions.has(2)) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATION_V2);
      await db.runAsync('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);', [2, getCurrentIsoTimestamp()]);
    });
  }
  if (!appliedVersions.has(3)) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATION_V3);
      await db.runAsync('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);', [3, getCurrentIsoTimestamp()]);
    });
  }
}
