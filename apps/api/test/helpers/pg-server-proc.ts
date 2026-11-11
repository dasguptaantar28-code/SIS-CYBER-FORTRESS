import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

async function run() {
  const port = Number(process.argv[2] || 55436);
  const db = new PGlite();
  await db.waitReady;

  const migrationPath = resolve(
    __dirname,
    '../../prisma/migrations/20261111000000_init/migration.sql',
  );
  await db.exec(readFileSync(migrationPath, 'utf8'));

  const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port });
  await server.start();
  process.stdout.write(`READY:${port}\n`);

  const shutdown = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
