/// <reference types="node" />
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { createInterface } from 'readline';
import path from 'path';

/** In-memory SQLite, no native Node addons and no database files. */
export class TestSqlite {
  private process: ChildProcessWithoutNullStreams;
  private next = 0;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  constructor() {
    this.process = spawn(process.env.PYTHON || 'python', [path.join(__dirname, 'sqlite_bridge.py')]);
    createInterface({ input: this.process.stdout }).on('line', line => {
      const response = JSON.parse(line);
      const call = this.pending.get(response.id);
      this.pending.delete(response.id);
      if (response.error) call?.reject(new Error(response.error)); else call?.resolve(response.result);
    });
    this.process.on('error', error => { for (const call of this.pending.values()) call.reject(error); });
  }
  private send(kind: string, sql: string, args: any[]) {
    const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
    const id = this.next++;
    return new Promise<any>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.process.stdin.write(JSON.stringify({ id, kind, sql, params }) + '\n');
    });
  }
  execAsync(sql: string) { return this.send('exec', sql, []); }
  runAsync(sql: string, ...args: any[]) { return this.send('run', sql, args); }
  getAllAsync<T = any>(sql: string, ...args: any[]): Promise<T[]> { return this.send('all', sql, args); }
  async getFirstAsync<T = any>(sql: string, ...args: any[]): Promise<T | null> { return (await this.getAllAsync<T>(sql, ...args))[0] ?? null; }
  async withTransactionAsync(operation: () => Promise<void>) {
    await this.execAsync('BEGIN;');
    try { await operation(); await this.execAsync('COMMIT;'); }
    catch (error) { await this.execAsync('ROLLBACK;'); throw error; }
  }
  close() { this.process.stdin.end(); }
}
