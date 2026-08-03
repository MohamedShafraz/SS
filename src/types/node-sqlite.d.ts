declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }

  export class StatementSync {
    all(params?: Record<string, unknown>): Record<string, unknown>[];
    get(params?: Record<string, unknown>): Record<string, unknown> | undefined;
    run(params?: Record<string, unknown>): { changes: number; lastInsertRowid: number | bigint };
  }
}
