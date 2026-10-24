import { SQLiteDatabase } from 'expo-sqlite';

// Expo's asynchronous transactions share a connection. Serialize application writes
// so a checkout and a delivery cannot accidentally join each other's transaction.
let pending: Promise<void> = Promise.resolve();
export function withInventoryTransaction<T>(db: SQLiteDatabase, operation: () => Promise<T>): Promise<T> {
  const task = pending.then(async () => {
    let result: T;
    await db.withTransactionAsync(async () => { result = await operation(); });
    return result!;
  });
  pending = task.then(() => undefined, () => undefined);
  return task;
}
