import { runMigrations } from '../src/db/migrations';
import { MIGRATION_V1, MIGRATION_V2 } from '../src/db/schema';

describe('Photo framing migration', () => {
  const database = (versions: number[]) => ({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue(versions.map((version) => ({ version }))),
    withTransactionAsync: jest.fn(async (operation) => operation()),
  });

  test('upgrades an existing catalog without recreating its tables', async () => {
    const db = database([1]);
    await runMigrations(db as any);
    expect(db.execAsync).toHaveBeenCalledWith(MIGRATION_V2);
    expect(db.execAsync).not.toHaveBeenCalledWith(MIGRATION_V1);
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('schema_migrations'), [2, expect.any(String)]);
  });

  test('does not add the column again on subsequent launches', async () => {
    const db = database([1, 2]);
    await runMigrations(db as any);
    expect(db.execAsync).not.toHaveBeenCalledWith(MIGRATION_V2);
  });
});
