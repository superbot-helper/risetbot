#!/usr/bin/env node

import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendDir, "..");

dotenv.config({ path: path.resolve(projectRoot, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
const BACKUP_DIR = path.resolve(
  projectRoot,
  process.env.DB_BACKUP_DIR || "reports/db-backups",
);
const RETENTION_COUNT = Math.max(
  1,
  Number.parseInt(process.env.DB_BACKUP_RETENTION || "10", 10) || 10,
);
const FILE_PREFIX = process.env.DB_BACKUP_PREFIX || "risetbot_backup";

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "_UTC");
}

function log(message) {
  process.stdout.write(`[backup-db] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[backup-db] ${message}\n`);
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function listBackupFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
}

async function cleanupOldBackups(dirPath, retentionCount) {
  const files = await listBackupFiles(dirPath);

  if (files.length <= retentionCount) {
    return { removed: [] };
  }

  const toRemove = files.slice(0, files.length - retentionCount);

  for (const file of toRemove) {
    await fs.unlink(path.join(dirPath, file));
  }

  return { removed: toRemove };
}

function runPgDump(outputFile) {
  return new Promise((resolve, reject) => {
    const args = [
      `--dbname=${DATABASE_URL}`,
      "--format=plain",
      "--no-owner",
      "--no-privileges",
      `--file=${outputFile}`,
    ];

    const child = spawn("pg_dump", args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
      },
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `Gagal menjalankan pg_dump. Pastikan PostgreSQL client tools terpasang dan tersedia di PATH. Detail: ${error.message}`,
        ),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(new Error(`pg_dump exited with code ${code}`));
    });
  });
}

async function main() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL belum dikonfigurasi di .env");
  }

  await ensureDirectory(BACKUP_DIR);

  const fileName = `${FILE_PREFIX}_${timestamp()}.sql`;
  const outputFile = path.join(BACKUP_DIR, fileName);

  log(`Starting backup to ${outputFile}`);
  await runPgDump(outputFile);

  const stat = await fs.stat(outputFile);
  log(`Backup created successfully (${Math.round(stat.size / 1024)} KB)`);

  const cleanup = await cleanupOldBackups(BACKUP_DIR, RETENTION_COUNT);
  if (cleanup.removed.length > 0) {
    log(
      `Removed ${cleanup.removed.length} old backup(s): ${cleanup.removed.join(", ")}`,
    );
  } else {
    log(`No old backups removed. Retention count: ${RETENTION_COUNT}`);
  }

  log("Backup process completed");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
