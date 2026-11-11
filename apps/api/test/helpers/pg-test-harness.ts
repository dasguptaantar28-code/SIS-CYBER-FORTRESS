import { PrismaClient } from '@prisma/client';
import { ChildProcess, spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { runSeed } from '../../prisma/seed';

export interface LocalPgContext {
  prisma: PrismaClient;
  databaseUrl: string;
  cleanup: () => Promise<void>;
}

export async function startLocalPostgresHarness(port = 55436): Promise<LocalPgContext> {
  const apiDir = resolve(__dirname, '../..');
  const scriptPath = resolve(__dirname, './pg-server-proc.ts');
  const tsxCli = resolve(apiDir, '../../node_modules/tsx/dist/cli.mjs');

  const proc: ChildProcess = spawn(process.execPath, [tsxCli, scriptPath, String(port)], {
    cwd: apiDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise<void>((resolveReady, rejectReady) => {
    let stderrBuf = '';
    const timer = setTimeout(
      () => rejectReady(new Error(`Local PG harness timed out. stderr: ${stderrBuf}`)),
      20000,
    );
    proc.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString('utf8').includes(`READY:${port}`)) {
        clearTimeout(timer);
        resolveReady();
      }
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString('utf8');
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        rejectReady(new Error(`Local PG process exited with code ${code}: ${stderrBuf}`));
      }
    });
  });

  const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?schema=public&sslmode=disable&connection_limit=1`;
  process.env.DATABASE_URL = databaseUrl;

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await prisma.$connect();

  process.env.ENABLE_DEMO_SEED = 'true';
  await runSeed(prisma);
  // Release single-connection PGlite socket before NestJS PrismaService connects
  await prisma.$disconnect();

  return {
    prisma,
    databaseUrl,
    cleanup: async () => {
      await prisma.$disconnect().catch(() => undefined);
      proc.kill();
    },
  };
}
