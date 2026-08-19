import { randomBytes } from 'node:crypto'
import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const repositoryRoot = resolve(import.meta.dirname, '..')
const sourceSupabaseDir = join(repositoryRoot, 'supabase')
const temporaryPrefix = join(tmpdir(), 'veda-bene-sensitive-smoke-')
const supabaseEntrypoint = join(repositoryRoot, 'node_modules', 'supabase', 'dist', 'supabase.js')
const nextEntrypoint = join(repositoryRoot, 'node_modules', 'next', 'dist', 'bin', 'next')
const appPort = 3103
const appOrigin = `http://127.0.0.1:${appPort}`
const sensitiveMarkers = {
  avgHours: '6.75',
  basePrice: '731.25',
  employeeRate: '41.25',
  orderTotal: '812.5',
  propertyName: 'Sensitive Smoke Property',
}
const roleNames = ['admin', 'secretaria', 'limpeza', 'consegna', 'cliente']

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

function assertLoopback(value, label) {
  const url = new URL(value)
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error(`${label} must use loopback.`)
  }
}

function executeCli(label, argumentsList, { allowFailure = false } = {}) {
  if (argumentsList.includes('--linked')) throw new Error('Remote Supabase targets are forbidden.')
  process.stdout.write(`\n[Sensitive smoke] ${label}\n`)

  const result = spawnSync(process.execPath, [supabaseEntrypoint, ...argumentsList], {
    cwd: repositoryRoot,
    env: childEnvironment,
    encoding: 'utf8',
    windowsHide: true,
  })
  const output = redact(`${result.stdout ?? ''}${result.stderr ?? ''}`).trim()
  if (result.status !== 0 && !allowFailure) {
    if (output) process.stderr.write(`${output}\n`)
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`)
  }
  return result
}

async function prepareDisposableProject() {
  const temporaryRoot = await mkdtemp(temporaryPrefix)
  const temporarySupabaseDir = join(temporaryRoot, 'supabase')
  await cp(sourceSupabaseDir, temporarySupabaseDir, {
    recursive: true,
    filter: source => basename(source) !== '.temp',
  })

  const configPath = join(temporarySupabaseDir, 'config.toml')
  const config = await readFile(configPath, 'utf8')
  const projectId = `veda-bene-sensitive-smoke-${process.pid}-${Date.now()}`
  const isolatedConfig = config.replace(
    /^project_id\s*=\s*"[^"]+"/m,
    `project_id = "${projectId}"`,
  )
  if (isolatedConfig === config) throw new Error('Could not isolate local Supabase project_id.')
  await writeFile(configPath, isolatedConfig, 'utf8')
  return { projectId, temporaryRoot }
}

async function removeDisposableProject(temporaryRoot) {
  const resolvedRoot = resolve(temporaryRoot)
  if (
    dirname(resolvedRoot) !== resolve(tmpdir())
    || !basename(resolvedRoot).startsWith('veda-bene-sensitive-smoke-')
  ) {
    throw new Error('Refusing to remove an unexpected temporary directory.')
  }
  await rm(resolvedRoot, { recursive: true, force: true })
}

function readLocalStatus(workdir) {
  const result = executeCli('Read isolated stack status with output suppressed', [
    '--workdir', workdir, 'status', '--output', 'json',
  ])
  const normalizedOutput = (result.stdout ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .trim()
  const jsonStart = normalizedOutput.indexOf('{')
  const jsonEnd = normalizedOutput.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    throw new Error('Supabase local status did not return JSON.')
  }
  let values
  try {
    values = JSON.parse(normalizedOutput.slice(jsonStart, jsonEnd + 1))
  } catch (error) {
    throw new Error('Supabase local status returned invalid JSON.', { cause: error })
  }
  const apiUrl = values.API_URL
  const publishableKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY
  const secretKey = values.SECRET_KEY ?? values.SERVICE_ROLE_KEY
  if (!apiUrl || !publishableKey || !secretKey) {
    throw new Error('Supabase local status omitted a required endpoint or key.')
  }
  assertLoopback(apiUrl, 'Supabase API URL')
  return { apiUrl, publishableKey, secretKey }
}

function requireSuccess(error, label) {
  if (error) throw new Error(`${label}: ${error.message}`)
}

function romeDateOnly(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

async function createSyntheticFixtures({ apiUrl, secretKey }) {
  process.stdout.write('[Sensitive smoke] Create five synthetic Auth users\n')
  const adminClient = createClient(apiUrl, secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
  const password = `Local-${randomBytes(18).toString('base64url')}!9aA`
  const users = new Map()

  for (const role of roleNames) {
    const email = `${role}.${process.pid}@sensitive-smoke.example.invalid`
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Sensitive Smoke ${role}` },
    })
    requireSuccess(error, `Create synthetic ${role}`)
    users.set(role, { email, id: data.user.id, password })
    process.stdout.write(`[Sensitive smoke] Synthetic ${role} created\n`)
  }

  process.stdout.write('[Sensitive smoke] Assign trusted profile roles\n')
  for (const role of roleNames) {
    const user = users.get(role)
    const compensation = role === 'limpeza'
      ? { hourly_rate: 41.25, monthly_salary: 1640.75, overtime_rate: 52.5 }
      : {}
    const { error } = await adminClient
      .from('profiles')
      .update({ role, ...compensation })
      .eq('id', user.id)
    requireSuccess(error, `Assign synthetic ${role}`)
  }

  process.stdout.write('[Sensitive smoke] Create scoped synthetic business fixtures\n')
  const client = users.get('cliente')
  const cleaning = users.get('limpeza')
  const delivery = users.get('consegna')
  const today = romeDateOnly()
  // Keep this inside the reporting implementation's current inclusive DATE
  // boundary. Correcting that TIMESTAMPTZ boundary belongs to Sprint 06.
  const completedAt = new Date(`${today}T00:00:00.000Z`)
  const startedAt = new Date(completedAt.getTime() - 45 * 60 * 1000)
  const checkoutAt = new Date(completedAt.getTime() - 6 * 60 * 60 * 1000)
  const ownerId = '61000000-0000-0000-0000-000000000001'
  const propertyId = '62000000-0000-0000-0000-000000000001'
  const orderId = '63000000-0000-0000-0000-000000000001'

  let result = await adminClient.from('owners').insert({
    id: ownerId,
    name: 'Sensitive Smoke Owner',
    email: client.email,
  })
  requireSuccess(result.error, 'Create synthetic owner')

  result = await adminClient.from('properties').insert({
    id: propertyId,
    name: sensitiveMarkers.propertyName,
    client_type: 'particular',
    owner_id: ownerId,
    zone: 'Other areas',
    address: 'Synthetic local-only address',
    min_guests: 1,
    max_guests: 4,
    double_beds: 1,
    single_beds: 1,
    sofa_beds: 0,
    armchair_beds: 0,
    bathrooms: 1,
    bidets: 1,
    cribs: 0,
    base_price: 731.25,
    extra_per_person: 19.75,
    avg_cleaning_hours: 6.75,
  })
  requireSuccess(result.error, 'Create synthetic property')

  result = await adminClient.from('service_orders').insert({
    id: orderId,
    property_id: propertyId,
    cleaning_staff_id: cleaning.id,
    consegna_staff_id: delivery.id,
    cleaning_date: today,
    checkout_at: checkoutAt.toISOString(),
    checkin_at: completedAt.toISOString(),
    status: 'done',
    real_guests: 2,
    double_beds: 1,
    single_beds: 1,
    sofa_beds: 0,
    armchair_beds: 0,
    bathrooms: 1,
    bidets: 1,
    cribs: 0,
    total_price: 812.5,
    pricing_mode: 'standard',
    extra_services_description: 'Synthetic local-only extra',
    extra_services_price: 63.25,
    consegna_fee: 10,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
  })
  requireSuccess(result.error, 'Create synthetic service order')

  result = await adminClient.from('service_order_cleaning_staff').insert({
    service_order_id: orderId,
    profile_id: cleaning.id,
  })
  requireSuccess(result.error, 'Assign synthetic cleaning staff')

  process.stdout.write('[Sensitive smoke] Synthetic fixtures ready\n')
  return { orderId, propertyId, today, users }
}

function requirePermissionDenied(error, label) {
  if (!error || error.code !== '42501') {
    throw new Error(`${label}: expected PostgreSQL 42501.`)
  }
}

async function verifyDirectDataApiColumnBarrier(localStatus, fixture) {
  process.stdout.write('[Sensitive smoke] Verify direct Data API column barrier for five roles\n')

  for (const role of roleNames) {
    const user = fixture.users.get(role)
    const client = createClient(localStatus.apiUrl, localStatus.publishableKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    })
    const { error: signInError } = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    })
    requireSuccess(signInError, `Direct Data API sign-in for ${role}`)

    let result = await client
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('id', user.id)
      .single()
    requireSuccess(result.error, `${role} safe profile columns`)

    result = await client
      .from('properties')
      .select('id, name, client_type, address')
      .eq('id', fixture.propertyId)
      .single()
    requireSuccess(result.error, `${role} safe property columns`)

    result = await client
      .from('service_orders')
      .select('id, status, pricing_mode, property:properties(id, name)')
      .eq('id', fixture.orderId)
      .single()
    requireSuccess(result.error, `${role} safe relational service-order columns`)

    result = await client
      .from('profiles')
      .select('email, phone, birth_date, nationality, address, hourly_rate, monthly_salary, overtime_rate')
      .eq('id', user.id)
    requirePermissionDenied(result.error, `${role} restricted profile columns`)

    result = await client
      .from('properties')
      .select('base_price, extra_per_person, avg_cleaning_hours')
      .eq('id', fixture.propertyId)
    requirePermissionDenied(result.error, `${role} restricted property columns`)

    result = await client
      .from('service_orders')
      .select('total_price, extra_services_description, extra_services_price, consegna_fee')
      .eq('id', fixture.orderId)
    requirePermissionDenied(result.error, `${role} restricted service-order columns`)

    result = await client.from('service_orders').select('*').eq('id', fixture.orderId)
    requirePermissionDenied(result.error, `${role} wildcard service-order read`)

    if (role === 'admin') {
      result = await client
        .from('profiles')
        .update({ hourly_rate: 0 })
        .eq('id', user.id)
      requireSuccess(result.error, 'Admin restricted profile update remains allowed')

      result = await client
        .from('properties')
        .update({ base_price: 731.25, extra_per_person: 19.75, avg_cleaning_hours: 6.75 })
        .eq('id', fixture.propertyId)
      requireSuccess(result.error, 'Admin restricted property update remains allowed')
    }

    if (role === 'admin' || role === 'secretaria') {
      result = await client
        .from('service_orders')
        .update({
          total_price: 812.5,
          extra_services_description: 'Synthetic local-only extra',
          extra_services_price: 63.25,
          consegna_fee: 10,
        })
        .eq('id', fixture.orderId)
      requireSuccess(result.error, `${role} restricted service-order update remains allowed`)
    }

    await client.auth.signOut({ scope: 'local' })
    process.stdout.write(`[Sensitive smoke] ${role} direct Data API barrier: PASS\n`)
  }

  const privilegedClient = createClient(localStatus.apiUrl, localStatus.secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
  const [profiles, properties, orders] = await Promise.all([
    privilegedClient.from('profiles').select('email, hourly_rate').limit(1),
    privilegedClient.from('properties').select('base_price, avg_cleaning_hours').eq('id', fixture.propertyId),
    privilegedClient.from('service_orders').select('total_price, extra_services_price, consegna_fee').eq('id', fixture.orderId),
  ])
  requireSuccess(profiles.error, 'Privileged profile adapter source')
  requireSuccess(properties.error, 'Privileged property adapter source')
  requireSuccess(orders.error, 'Privileged service-order adapter source')
  process.stdout.write('[Sensitive smoke] Privileged adapter sources: PASS\n')
}

async function verifyLocalAuthPrerequisites(localStatus, fixture) {
  process.stdout.write('[Sensitive smoke] Verify direct local Auth and lockout storage\n')
  const publicClient = createClient(localStatus.apiUrl, localStatus.publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
  const adminUser = fixture.users.get('admin')
  const { data: sessionData, error: signInError } = await publicClient.auth.signInWithPassword({
    email: adminUser.email,
    password: adminUser.password,
  })
  requireSuccess(signInError, 'Direct synthetic sign-in')
  if (!sessionData.user) throw new Error('Direct synthetic sign-in returned no user.')
  const { data: profile, error: profileError } = await publicClient
    .from('profiles')
    .select('role')
    .eq('id', sessionData.user.id)
    .single()
  requireSuccess(profileError, 'Read trusted synthetic profile')
  if (profile.role !== 'admin') throw new Error('Direct synthetic sign-in returned the wrong role.')
  await publicClient.auth.signOut({ scope: 'local' })

  const privilegedClient = createClient(localStatus.apiUrl, localStatus.secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
  const { error: lockoutError } = await privilegedClient
    .from('auth_login_attempts')
    .select('email_key')
    .eq('email_key', '0'.repeat(64))
    .limit(1)
  requireSuccess(lockoutError, 'Read local login lockout store')
  process.stdout.write('[Sensitive smoke] Local Auth prerequisites: PASS\n')
}

async function waitForApp(processHandle) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error('Next.js smoke server exited before becoming ready.')
    try {
      const response = await fetch(`${appOrigin}/login`, { redirect: 'manual' })
      if (response.status === 200) return
    } catch {
      // Server is still starting.
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 500))
  }
  throw new Error('Next.js smoke server did not become ready in time.')
}

function startApp(localStatus) {
  const appEnvironment = {
    ...childEnvironment,
    HOSTNAME: '127.0.0.1',
    PORT: String(appPort),
    NEXT_PUBLIC_SUPABASE_URL: localStatus.apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: localStatus.publishableKey,
    SUPABASE_SECRET_KEY: localStatus.secretKey,
    SUPABASE_SERVICE_ROLE_KEY: localStatus.secretKey,
    LOGIN_LOCKOUT_SECRET: randomBytes(32).toString('base64url'),
    SENSITIVE_DATA_SMOKE: '1',
    SENTRY_DSN: '',
    NEXT_PUBLIC_SENTRY_DSN: '',
    SENTRY_ENVIRONMENT: 'local-sensitive-smoke',
  }
  const processHandle = spawn(process.execPath, [nextEntrypoint, 'dev', '-p', String(appPort)], {
    cwd: repositoryRoot,
    env: appEnvironment,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let bufferedOutput = ''
  const collect = chunk => {
    bufferedOutput = `${bufferedOutput}${chunk}`.slice(-20_000)
  }
  processHandle.stdout.on('data', collect)
  processHandle.stderr.on('data', collect)
  processHandle.safeOutput = () => redact(bufferedOutput)
  return processHandle
}

function updateCookieJar(cookieJar, response) {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';', 1)
    const separator = pair.indexOf('=')
    if (separator > 0) cookieJar.set(pair.slice(0, separator), pair.slice(separator + 1))
  }
}

function cookieHeader(cookieJar) {
  return [...cookieJar].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function login(user) {
  const cookieJar = new Map()
  const response = await fetch(`${appOrigin}/api/auth/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      Origin: appOrigin,
    },
    body: JSON.stringify({ email: user.email, password: user.password }),
  })
  updateCookieJar(cookieJar, response)
  const payload = await response.json().catch(() => null)
  if (response.status !== 200) {
    const reason = payload && typeof payload.error === 'string' ? ` (${payload.error})` : ''
    throw new Error(`Synthetic login failed with HTTP ${response.status}${reason}.`)
  }
  if (payload.success !== true) throw new Error('Synthetic login did not report success.')
  return cookieJar
}

async function requestWithSession(cookieJar, path) {
  const response = await fetch(`${appOrigin}${path}`, {
    redirect: 'manual',
    headers: { Cookie: cookieHeader(cookieJar) },
  })
  updateCookieJar(cookieJar, response)
  return { body: await response.text(), response }
}

function assertStatus(result, expected, label) {
  if (result.response.status !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, received ${result.response.status}.`)
  }
}

function assertContains(body, marker, label) {
  if (!body.includes(marker)) throw new Error(`${label}: expected marker was absent.`)
}

function assertNotContains(body, marker, label) {
  if (body.includes(marker)) throw new Error(`${label}: sensitive marker was exposed.`)
}

function assertRedirect(result, expectedPath, label) {
  if (![303, 307, 308].includes(result.response.status)) {
    throw new Error(`${label}: expected redirect, received HTTP ${result.response.status}.`)
  }
  const location = result.response.headers.get('location')
  if (!location || new URL(location, appOrigin).pathname !== expectedPath) {
    throw new Error(`${label}: redirected to an unexpected path.`)
  }
}

async function smokeRole(role, user, today) {
  const session = await login(user)
  const serviceOrders = await requestWithSession(session, '/service-orders')
  assertStatus(serviceOrders, 200, `${role} service-orders`)
  assertContains(serviceOrders.body, sensitiveMarkers.propertyName, `${role} visible order`)
  assertContains(serviceOrders.body, sensitiveMarkers.avgHours, `${role} authorized operational estimate`)

  const properties = await requestWithSession(session, '/properties')
  assertStatus(properties, 200, `${role} properties`)
  assertContains(properties.body, sensitiveMarkers.propertyName, `${role} visible property`)

  if (role === 'admin') {
    assertContains(properties.body, sensitiveMarkers.basePrice, 'admin property price')
    const employees = await requestWithSession(session, '/employees')
    assertStatus(employees, 200, 'admin employees')
    assertContains(employees.body, sensitiveMarkers.employeeRate, 'admin employee compensation')

    const newOrder = await requestWithSession(session, '/service-orders/new')
    assertStatus(newOrder, 200, 'admin new order')
    assertContains(newOrder.body, sensitiveMarkers.avgHours, 'admin order estimate')
    assertContains(newOrder.body, sensitiveMarkers.basePrice, 'admin order base price')

    const dashboard = await requestWithSession(session, '/dashboard')
    assertStatus(dashboard, 200, 'admin dashboard')

    const payable = await requestWithSession(session, '/statements/payable')
    assertStatus(payable, 200, 'admin payable screen')
    const receivable = await requestWithSession(session, '/statements/receivable')
    assertStatus(receivable, 200, 'admin receivable screen')

    const payableCsv = await requestWithSession(
      session,
      `/api/export/payable?start=${today}&end=${today}`,
    )
    assertStatus(payableCsv, 200, 'admin payable CSV')
    assertContains(payableCsv.body, sensitiveMarkers.propertyName, 'admin payable CSV property')
    const receivableCsv = await requestWithSession(
      session,
      `/api/export/receivable?start=${today}&end=${today}`,
    )
    assertStatus(receivableCsv, 200, 'admin receivable CSV')
    assertContains(receivableCsv.body, sensitiveMarkers.propertyName, 'admin receivable CSV property')
    assertContains(receivableCsv.body, sensitiveMarkers.orderTotal, 'admin receivable CSV total')
  } else {
    assertNotContains(properties.body, sensitiveMarkers.basePrice, `${role} property price`)
    assertNotContains(serviceOrders.body, sensitiveMarkers.orderTotal, `${role} order total`)
    assertNotContains(serviceOrders.body, sensitiveMarkers.employeeRate, `${role} employee compensation`)

    const employees = await requestWithSession(session, '/employees')
    assertRedirect(employees, '/service-orders', `${role} employees guard`)
    const dashboard = await requestWithSession(session, '/dashboard')
    assertRedirect(dashboard, '/service-orders', `${role} dashboard guard`)

    const payableCsv = await requestWithSession(
      session,
      `/api/export/payable?start=${today}&end=${today}`,
    )
    assertStatus(payableCsv, 403, `${role} payable CSV guard`)
    const receivableCsv = await requestWithSession(
      session,
      `/api/export/receivable?start=${today}&end=${today}`,
    )
    assertStatus(receivableCsv, 403, `${role} receivable CSV guard`)

    const newOrder = await requestWithSession(session, '/service-orders/new')
    if (role === 'secretaria') {
      assertStatus(newOrder, 200, 'secretaria new order')
      assertContains(newOrder.body, sensitiveMarkers.avgHours, 'secretaria order estimate')
      assertNotContains(newOrder.body, sensitiveMarkers.basePrice, 'secretaria order base price')
    } else {
      assertRedirect(newOrder, '/service-orders', `${role} new order guard`)
    }
  }

  process.stdout.write(`[Sensitive smoke] ${role}: PASS\n`)
}

async function main() {
  await stat(join(repositoryRoot, '.next', 'BUILD_ID'))
  const { projectId, temporaryRoot: workdir } = await prepareDisposableProject()
  let stackStarted = false
  let appProcess = null

  try {
    executeCli('Start isolated local stack', [
      '--workdir', workdir,
      'start',
      '--exclude', 'studio,mailpit,realtime,imgproxy,edge-runtime,logflare,vector,supavisor',
    ])
    stackStarted = true
    executeCli('Rebuild disposable database from migration baseline', [
      '--workdir', workdir, 'db', 'reset', '--local', '--no-seed',
    ])
    const migrationList = executeCli('Verify local migration history', [
      '--workdir', workdir, 'migration', 'list', '--local',
    ])
    const migrationOutput = `${migrationList.stdout ?? ''}${migrationList.stderr ?? ''}`
    for (const expectedVersion of ['20260818031745', '20260819030134']) {
      if (!migrationOutput.includes(expectedVersion)) {
        throw new Error(`Local migration history omitted ${expectedVersion}.`)
      }
    }

    const localStatus = readLocalStatus(workdir)
    const fixture = await createSyntheticFixtures(localStatus)
    await verifyLocalAuthPrerequisites(localStatus, fixture)
    await verifyDirectDataApiColumnBarrier(localStatus, fixture)
    appProcess = startApp(localStatus)
    await waitForApp(appProcess)

    for (const role of roleNames) {
      await smokeRole(role, fixture.users.get(role), fixture.today)
    }
    process.stdout.write('\nSensitive-data authenticated smoke passed for all five roles.\n')
  } catch (error) {
    if (appProcess?.safeOutput) process.stderr.write(`${appProcess.safeOutput()}\n`)
    throw error
  } finally {
    if (appProcess && appProcess.exitCode === null) {
      appProcess.kill('SIGTERM')
      await new Promise(resolvePromise => appProcess.once('exit', resolvePromise))
    }
    if (stackStarted) {
      executeCli('Stop and delete only the isolated local stack', [
        '--workdir', workdir, 'stop', '--no-backup',
      ], { allowFailure: true })
    }
    await removeDisposableProject(workdir)
    process.stdout.write(`[Sensitive smoke] Isolated project ${projectId.replace(/\d+/g, '#')} removed.\n`)
  }
}

main().catch(error => {
  const safeError = redact(error instanceof Error ? `${error.name}: ${error.message}` : String(error))
  process.stderr.write(`[Sensitive smoke] ERROR ${JSON.stringify(safeError)}\n`)
  process.exitCode = 1
})
