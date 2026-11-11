import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runSeed } from '../../prisma/seed';

async function main() {
  const isSmoke = process.argv.includes('--smoke');
  const dataDir = isSmoke ? undefined : resolve(__dirname, '../../.pgdata');
  if (dataDir) mkdirSync(dataDir, { recursive: true });

  const db = new PGlite(dataDir);
  await db.waitReady;

  const existingTables = await db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User'",
  );
  const needsInit = Number(existingTables.rows[0]?.count || '0') === 0;

  if (needsInit || isSmoke || process.argv.includes('--migrate-and-seed')) {
    if (needsInit) {
      const migrationPath = resolve(
        __dirname,
        '../../prisma/migrations/20261111000000_init/migration.sql',
      );
      if (existsSync(migrationPath)) {
        console.log('[Local PG] Applying initial PostgreSQL migration DDL...');
        await db.exec(readFileSync(migrationPath, 'utf8'));
      }
    }
  }

  const port = Number(process.env.LOCAL_PG_PORT || (isSmoke ? 55435 : 5432));
  const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port });
  await server.start();

  const dbUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?schema=public&sslmode=disable&connection_limit=1&pgbouncer=true`;
  process.env.DATABASE_URL = dbUrl;
  console.log(`[Local PG] PostgreSQL wire server listening on 127.0.0.1:${port}`);

  if (isSmoke || process.argv.includes('--migrate-and-seed')) {
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    await prisma.$connect();
    process.env.ENABLE_DEMO_SEED = process.env.ENABLE_DEMO_SEED || 'true';
    await runSeed(prisma);
    const counts = {
      users: await prisma.user.count(),
      roles: await prisma.role.count(),
      permissions: await prisma.permission.count(),
      modules: await prisma.securityModule.count(),
      iocs: await prisma.threatIndicator.count(),
    };
    console.log('[Local PG] Seed verified:', JSON.stringify(counts));
    await prisma.$disconnect();

    if (isSmoke) {
      await server.stop();
      await db.close();
      return;
    }
  }

  process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
      return;
    }
    console.error('[Local PG] Uncaught error:', err);
  });
  process.on('unhandledRejection', (reason) => {
    const code = (reason as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ECONNRESET' || code === 'EPIPE') return;
    console.error('[Local PG] Unhandled rejection:', reason);
  });

  const shutdown = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
