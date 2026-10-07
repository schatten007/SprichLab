import { DatabaseSync } from 'node:sqlite';

/** D1-compatible adapter for local development and tests; never bundled into the Worker. */
export function sqliteD1(path = ':memory:') {
  const db = new DatabaseSync(path);
  return {
    exec(sql) { db.exec(sql); },
    prepare(sql) {
      const statement = db.prepare(sql);
      let values = [];
      const runSync = () => { const result = statement.run(...values); return { meta: { changes: Number(result.changes) }, success: true }; };
      const query = {
        bind(...input) { values = input; return query; },
        async first() { return statement.get(...values) ?? null; },
        async all() { return { results: statement.all(...values) }; },
        async run() { return runSync(); },
        runSync,
      };
      return query;
    },
    async batch(queries) {
      // Fully synchronous between BEGIN and COMMIT: awaiting here would let another
      // request's statements run inside this transaction and be lost on ROLLBACK.
      db.exec('BEGIN');
      try { const results = queries.map(query => query.runSync()); db.exec('COMMIT'); return results; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { db.close(); },
  };
}
