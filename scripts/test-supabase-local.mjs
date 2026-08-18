import {
  cp,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repositoryRoot = resolve(import.meta.dirname, '..')
const sourceSupabaseDir = join(repositoryRoot, 'supabase')
const temporaryPrefix = join(tmpdir(), 'veda-bene-supabase-sprint-01-')
const supabaseEntrypoint = join(
  repositoryRoot,
  'node_modules',
  'supabase',
  'dist',
  'supabase.js',
)

const childEnvironment = { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' }
for (const variable of [
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_PROJECT_ID',
  'SUPABASE_PROJECT_REF',
]) {
  delete childEnvironment[variable]
}

function redact(value) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[local-db-url-redacted]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9._-]+/g, '[local-key-redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt-redacted]')
    .replace(/(SUPABASE_[A-Z0-9_]+)=([^\r\n]+)/g, '$1=[redacted]')
}

function assertLocalOnly(argumentsList) {
  if (argumentsList.includes('--linked')) {
    throw new Error('Remote Supabase targets are forbidden in Sprint 01.')
  }

  const dbUrlIndex = argumentsList.indexOf('--db-url')
  if (dbUrlIndex >= 0) {
    const databaseUrl = new URL(argumentsList[dbUrlIndex + 1])
    if (!['127.0.0.1', 'localhost', '::1'].includes(databaseUrl.hostname)) {
      throw new Error('Only loopback database URLs are allowed in Sprint 01.')
    }
  }
}

function executeCli(label, argumentsList, { showOutput = false, allowFailure = false } = {}) {
  assertLocalOnly(argumentsList)
  process.stdout.write(`\n[Supabase local] ${label}\n`)

  const result = spawnSync(process.execPath, [supabaseEntrypoint, ...argumentsList], {
    cwd: repositoryRoot,
    env: childEnvironment,
    encoding: 'utf8',
    windowsHide: true,
  })

  const combinedOutput = redact(`${result.stdout ?? ''}${result.stderr ?? ''}`).trim()
  if (showOutput && combinedOutput) {
    process.stdout.write(`${combinedOutput}\n`)
  }

  if (result.status !== 0 && !allowFailure) {
    if (result.error) {
      process.stderr.write(`${redact(result.error.message)}\n`)
    }
    if (!showOutput && combinedOutput) {
      process.stderr.write(`${combinedOutput}\n`)
    }
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`)
  }

  return { ...result, output: combinedOutput }
}

function localDatabaseUrlFromStatus(workdir) {
  const status = executeCli(
    'Read disposable stack status without printing credentials',
    ['--workdir', workdir, 'status', '--output', 'json'],
  )
  const values = JSON.parse(status.stdout)
  const candidate = Object.values(values).find(
    (value) => typeof value === 'string' && value.startsWith('postgresql://'),
  )

  if (!candidate) {
    throw new Error('The disposable local database URL was not reported by Supabase CLI.')
  }

  const databaseUrl = new URL(candidate)
  if (!['127.0.0.1', 'localhost', '::1'].includes(databaseUrl.hostname)) {
    throw new Error('Supabase CLI reported a non-loopback database URL.')
  }
  return databaseUrl
}

async function prepareDisposableProject() {
  const temporaryRoot = await mkdtemp(temporaryPrefix)
  const temporarySupabaseDir = join(temporaryRoot, 'supabase')

  await cp(sourceSupabaseDir, temporarySupabaseDir, {
    recursive: true,
    filter: (source) => basename(source) !== '.temp',
  })

  const configPath = join(temporarySupabaseDir, 'config.toml')
  const config = await readFile(configPath, 'utf8')
  const projectId = `veda-bene-sprint-01-${process.pid}-${Date.now()}`
  const isolatedConfig = config.replace(
    /^project_id\s*=\s*"[^"]+"/m,
    `project_id = "${projectId}"`,
  )

  if (isolatedConfig === config) {
    throw new Error('Could not isolate the disposable Supabase project_id.')
  }
  await writeFile(configPath, isolatedConfig, 'utf8')

  const migrationsDir = join(temporarySupabaseDir, 'migrations')
  const guardMigrationFile = '20260818031745_guard_service_order_updates.sql'
  const guardMigrationPath = join(migrationsDir, guardMigrationFile)
  const guardMigrationSql = await readFile(guardMigrationPath, 'utf8')

  // Start from the preceding baseline so the exact Sprint 04 migration can be
  // exercised between before/after fingerprints in one psql session.
  await rename(
    guardMigrationPath,
    join(temporaryRoot, `${guardMigrationFile}.pending`),
  )

  return {
    guardMigrationFile,
    guardMigrationSql,
    projectId,
    temporaryRoot,
  }
}

async function removeDisposableProject(temporaryRoot) {
  const resolvedTemporaryRoot = resolve(temporaryRoot)
  if (
    dirname(resolvedTemporaryRoot) !== resolve(tmpdir())
    || !basename(resolvedTemporaryRoot).startsWith('veda-bene-supabase-sprint-01-')
  ) {
    throw new Error('Refusing to remove an unexpected temporary directory.')
  }
  await rm(resolvedTemporaryRoot, { recursive: true, force: true })
}

function executeSqlTextInContainer(label, containerName, databaseName, sql) {
  process.stdout.write(`\n[Supabase local] ${label}\n`)
  const result = spawnSync('docker', [
    'exec', '-i', containerName,
    'psql',
    '--username', 'postgres',
    '--dbname', databaseName,
    '--set', 'ON_ERROR_STOP=1',
    '--file', '-',
  ], {
    cwd: repositoryRoot,
    env: childEnvironment,
    encoding: 'utf8',
    input: sql,
    windowsHide: true,
  })

  if (result.status !== 0) {
    const output = redact(`${result.stdout ?? ''}${result.stderr ?? ''}`).trim()
    if (result.error) {
      process.stderr.write(`${redact(result.error.message)}\n`)
    }
    if (output) {
      process.stderr.write(`${output}\n`)
    }
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`)
  }
}

async function executeSqlFileInContainer(label, containerName, databaseName, filePath) {
  const sql = await readFile(filePath, 'utf8')
  executeSqlTextInContainer(label, containerName, databaseName, sql)
}

function runServiceOrderGuardMigrationSmoke(
  workdir,
  projectId,
  guardMigrationFile,
  guardMigrationSql,
) {
  localDatabaseUrlFromStatus(workdir)
  const containerName = `supabase_db_${projectId}`
  const fixtureAndSnapshotSql = String.raw`
INSERT INTO auth.users (id, email)
VALUES ('65000000-0000-0000-0000-000000000001', 'guard-migration@local.invalid');

UPDATE public.profiles
SET full_name = 'Guard Migration Fixture', role = 'limpeza'
WHERE id = '65000000-0000-0000-0000-000000000001';

INSERT INTO public.owners (id, name, email)
VALUES (
  '65000000-0000-0000-0000-000000000002',
  'Guard Migration Owner',
  'guard-owner@local.invalid'
);

INSERT INTO public.properties (id, name, client_type, owner_id, zone)
VALUES (
  '65000000-0000-0000-0000-000000000003',
  'Guard Migration Property',
  'particular',
  '65000000-0000-0000-0000-000000000002',
  'Other areas'
);

INSERT INTO public.service_orders (
  id, property_id, cleaning_date, status, total_price, pricing_mode,
  cleaning_cycle
)
VALUES (
  '65000000-0000-0000-0000-000000000004',
  '65000000-0000-0000-0000-000000000003',
  (timezone('Europe/Rome', now()))::date,
  'open',
  321.45,
  'standard',
  1
);

INSERT INTO public.service_order_cleaning_staff (service_order_id, profile_id)
VALUES (
  '65000000-0000-0000-0000-000000000004',
  '65000000-0000-0000-0000-000000000001'
);

INSERT INTO public.service_order_photos (
  id, service_order_id, cycle_no, phase, status, content_type, display_path,
  thumbnail_path, uploaded_by, sort_order
)
VALUES (
  '65000000-0000-0000-0000-000000000005',
  '65000000-0000-0000-0000-000000000004',
  1,
  'before',
  'pending',
  'image/webp',
  'guard-migration/display.webp',
  'guard-migration/thumb.webp',
  '65000000-0000-0000-0000-000000000001',
  0
);

CREATE TEMP TABLE guard_migration_before AS
SELECT
  (SELECT count(*) FROM public.service_orders) AS order_count,
  (SELECT array_agg(id ORDER BY id) FROM public.service_orders) AS order_ids,
  (SELECT array_agg(order_number ORDER BY order_number) FROM public.service_orders) AS order_numbers,
  (SELECT md5(coalesce(string_agg(md5(to_jsonb(rows)::text), '' ORDER BY id), ''))
   FROM public.service_orders AS rows) AS order_digest,
  (SELECT md5(coalesce(string_agg(md5(to_jsonb(rows)::text), '' ORDER BY service_order_id, profile_id), ''))
   FROM public.service_order_cleaning_staff AS rows) AS assignment_digest,
  (SELECT md5(coalesce(string_agg(md5(to_jsonb(rows)::text), '' ORDER BY id), ''))
   FROM public.service_order_photos AS rows) AS photo_digest,
  (SELECT md5(coalesce(string_agg(md5(to_jsonb(rows)::text), '' ORDER BY id), ''))
   FROM storage.objects AS rows) AS storage_object_digest,
  (SELECT md5(coalesce(string_agg(grantee || ':' || privilege_type || ':' || is_grantable, ',' ORDER BY grantee, privilege_type), ''))
   FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name = 'service_orders'
     AND privilege_type = 'SELECT') AS select_grant_digest;
`
  const invariantSql = String.raw`
DO $guard_invariants$
DECLARE
  before_row pg_temp.guard_migration_before%ROWTYPE;
  after_row pg_temp.guard_migration_before%ROWTYPE;
BEGIN
  SELECT * INTO before_row FROM pg_temp.guard_migration_before;
  SELECT
    (SELECT count(*) FROM public.service_orders),
    (SELECT array_agg(id ORDER BY id) FROM public.service_orders),
    (SELECT array_agg(order_number ORDER BY order_number) FROM public.service_orders),
    (SELECT md5(coalesce(string_agg(md5(to_jsonb(rows)::text), '' ORDER BY id), '')) FROM public.service_orders AS rows),
    (SELECT md5(coalesce(string_agg(md5(to_jsonb(rows)::text), '' ORDER BY service_order_id, profile_id), '')) FROM public.service_order_cleaning_staff AS rows),
    (SELECT md5(coalesce(string_agg(md5(to_jsonb(rows)::text), '' ORDER BY id), '')) FROM public.service_order_photos AS rows),
    (SELECT md5(coalesce(string_agg(md5(to_jsonb(rows)::text), '' ORDER BY id), '')) FROM storage.objects AS rows),
    (SELECT md5(coalesce(string_agg(grantee || ':' || privilege_type || ':' || is_grantable, ',' ORDER BY grantee, privilege_type), ''))
     FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name = 'service_orders'
       AND privilege_type = 'SELECT')
  INTO after_row;

  IF before_row IS DISTINCT FROM after_row THEN
    RAISE EXCEPTION 'Sprint 04 migration changed protected data or SELECT grants';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.service_orders'::regclass
      AND tgname = 'guard_service_order_updates'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Sprint 04 trigger was not created';
  END IF;
END
$guard_invariants$;
`

  executeSqlTextInContainer(
    `Apply ${guardMigrationFile} and compare before/after fingerprints`,
    containerName,
    'postgres',
    `${fixtureAndSnapshotSql}\n${guardMigrationSql}\n${invariantSql}`,
  )
}

async function runPhotoMigrationSmoke(workdir, projectId) {
  const databaseName = `veda_bene_photo_smoke_${process.pid}_${Date.now()}`
  localDatabaseUrlFromStatus(workdir)
  const containerName = `supabase_db_${projectId}`
  let databaseCreated = false

  try {
    executeCli('Create isolated photo migration smoke database', [
      '--workdir', workdir,
      'db', 'query', '--local',
      `CREATE DATABASE "${databaseName}"`,
    ])
    databaseCreated = true

    for (const relativeFile of [
      'tests/service_order_photos_migration_bootstrap.sql',
      'migrations/20260722041920_add_service_order_cleaning_photos.sql',
      'migrations/20260730231155_allow_jpeg_cleaning_photos.sql',
      'tests/service_order_photo_formats_invariants.sql',
    ]) {
      await executeSqlFileInContainer(
        `Photo smoke: ${relativeFile}`,
        containerName,
        databaseName,
        join(workdir, 'supabase', relativeFile),
      )
    }
  } finally {
    if (databaseCreated) {
      executeCli('Remove isolated photo migration smoke database', [
        '--workdir', workdir,
        'db', 'query', '--local',
        `DROP DATABASE "${databaseName}" WITH (FORCE)`,
      ], { allowFailure: true })
    }
  }
}

async function main() {
  const {
    guardMigrationFile,
    guardMigrationSql,
    projectId,
    temporaryRoot: workdir,
  } = await prepareDisposableProject()
  let stackStarted = false

  try {
    executeCli('Start isolated stack from repository migrations', [
      '--workdir', workdir,
      'start',
      '--exclude', 'studio,mailpit,realtime,imgproxy,edge-runtime,logflare,vector,supavisor',
    ])
    stackStarted = true

    executeCli('Rebuild disposable database from migration baseline', [
      '--workdir', workdir,
      'db', 'reset', '--local', '--no-seed',
    ])

    runServiceOrderGuardMigrationSmoke(
      workdir,
      projectId,
      guardMigrationFile,
      guardMigrationSql,
    )

    executeCli('Run role × table × operation × column pgTAP matrix', [
      '--workdir', workdir,
      'test', 'db', '--local',
      join(workdir, 'supabase', 'tests', 'database'),
    ], { showOutput: true })

    for (const relativeFile of [
      'tests/operational_staff_visibility_invariants.sql',
      'tests/service_order_photo_formats_invariants.sql',
    ]) {
      executeCli(`Run existing invariant: ${relativeFile}`, [
        '--workdir', workdir,
        'db', 'query', '--local',
        '--file', join(workdir, 'supabase', relativeFile),
      ])
    }

    executeCli('Run local Supabase schema lint', [
      '--workdir', workdir,
      'db', 'lint', '--local',
      '--schema', 'public,private',
      '--level', 'warning',
      '--fail-on', 'error',
    ], { showOutput: true })

    await runPhotoMigrationSmoke(workdir, projectId)
    process.stdout.write('\nSupabase authorization and Sprint 04 migration tests passed without a remote target.\n')
  } finally {
    if (stackStarted) {
      executeCli('Stop and delete only the isolated local stack', [
        '--workdir', workdir,
        'stop', '--no-backup',
      ], { allowFailure: true })
    }
    await removeDisposableProject(workdir)
  }
}

main().catch((error) => {
  process.stderr.write(`${redact(error instanceof Error ? error.message : String(error))}\n`)
  process.exitCode = 1
})
