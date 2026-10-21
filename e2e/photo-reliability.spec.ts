import { randomBytes, randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

type Fixture = {
  photoOrderId: string
  photoProperty: string
  foreignOrderId: string
  users: Record<string, { email: string; password: string }>
}
const fixture = JSON.parse(Buffer.from(process.env.E2E_FIXTURE_B64!, 'base64url').toString()) as Fixture
const baseURL = process.env.E2E_BASE_URL!

async function login(page: Page, role: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(fixture.users[role].email)
  await page.getByLabel('Password').fill(fixture.users[role].password)
  await page.getByRole('button', { name: 'Accedi', exact: true }).click()
  await expect(page).toHaveURL(/\/service-orders$/)
}

async function photos(role = 'admin') {
  const client = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const auth = await client.auth.signInWithPassword(fixture.users[role])
  expect(auth.error).toBeNull()
  const result = await client.from('service_order_photos')
    .select('id, phase, status, width, height').eq('service_order_id', fixture.photoOrderId)
  expect(result.error).toBeNull()
  return result.data!
}

async function deniedAction(page: Page, action: string, args: unknown[]) {
  expect(action.length).toBeGreaterThan(0)
  const response = await page.request.post('/service-orders', {
    headers: { Origin: baseURL, 'Next-Action': action, 'Content-Type': 'text/plain;charset=UTF-8' },
    data: JSON.stringify(args),
  })
  // A streamed Server Action can return HTTP 200 with a Flight error record.
  expect([200, 500]).toContain(response.status())
  expect(/(?:^|\n)[0-9a-f]+:E\{/.test(await response.text())).toBe(true)
}

test('real photo lifecycle: decoder, retry, eight-photo limit, gallery, role denials and removal', async ({ browser }) => {
  test.setTimeout(240_000)
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  // The buffer is synthetic noise, never a photograph or a production fixture.
  const jpeg = await sharp(randomBytes(2400 * 1800 * 3), { raw: { width: 2400, height: 1800, channels: 3 } })
    .jpeg({ quality: 90 }).withMetadata({ orientation: 6 }).toBuffer()
  expect(jpeg.length).toBeGreaterThan(2 * 1024 * 1024)
  expect(jpeg.length).toBeLessThan(8 * 1024 * 1024)
  const png = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#336699' } }).png().toBuffer()
  let reserveAction = ''
  let deleteAction = ''
  let capturingDeletion = false
  let interrupted = false
  let displayUploads = 0
  let thumbnailUploads = 0
  page.on('request', request => {
    const action = request.headers()['next-action']
    if (!action) return
    if (capturingDeletion) { deleteAction = action; return }
    try {
      const args = JSON.parse(request.postData() ?? 'null')
      if (Array.isArray(args) && args[0] === fixture.photoOrderId && args.length === 4) reserveAction = action
    } catch { /* Only simple photo action arguments are relevant. */ }
  })
  page.on('dialog', dialog => { void dialog.accept() })
  await page.route('**/storage/v1/object/upload/sign/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.includes('/display.')) displayUploads++
    if (path.includes('/thumb.')) {
      thumbnailUploads++
      if (!interrupted) { interrupted = true; await route.abort('connectionfailed'); return }
    }
    await route.continue()
  })

  try {
    await login(page, 'limpeza')
    const row = () => page.getByRole('row').filter({ hasText: fixture.photoProperty })
    await row().getByRole('button', { name: /^Avvia/ }).click()
    const galleryInput = () => page.locator('input[type="file"]:not([capture])')
    // A malformed JPEG must give feedback without reserving any server slot.
    await galleryInput().setInputFiles({ name: 'invalid.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('invalid synthetic bytes') })
    await expect(page.getByText(/Foto 1: La foto non può essere letta/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Conferma', exact: true })).toBeDisabled()
    expect(await photos()).toHaveLength(0)
    await page.getByRole('button', { name: 'Rimuovi foto' }).click()

    await galleryInput().setInputFiles([
      { name: 'portrait.jpg', mimeType: 'image/jpeg', buffer: jpeg },
      { name: 'landscape.png', mimeType: 'image/png', buffer: png },
    ])
    await expect(page.locator('img[alt="Anteprima foto pulizia"]')).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Conferma', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Conferma', exact: true }).click()
    await expect(row().getByRole('button', { name: /^Completa/ })).toBeVisible()
    expect(interrupted).toBe(true)
    expect(displayUploads).toBe(3)
    expect(thumbnailUploads).toBe(3)
    const before = await photos()
    expect(before).toHaveLength(2)
    expect(before.every(photo => photo.status === 'ready' && photo.phase === 'before')).toBe(true)
    expect(before.some(photo => photo.height === 1920 && photo.width === 1440)).toBe(true)

    // Bypass the UI deliberately: assignment and role checks must remain server-side.
    await deniedAction(page, reserveAction, [fixture.foreignOrderId, 'before', randomUUID(), 'image/webp'])
    for (const role of ['consegna', 'cliente']) {
      const deniedContext = await browser.newContext({ baseURL })
      const deniedPage = await deniedContext.newPage()
      await login(deniedPage, role)
      await deniedAction(deniedPage, reserveAction, [fixture.photoOrderId, 'after', randomUUID(), 'image/webp'])
      await deniedContext.close()
    }
    expect(await photos()).toHaveLength(2)

    await row().getByRole('button', { name: /^Completa/ }).click()
    // Exercise the actual HTMLImageElement fallback with valid image bytes.
    await page.evaluate(() => { window.createImageBitmap = async () => { throw new Error('Synthetic bitmap unavailability') } })
    await galleryInput().setInputFiles(Array.from({ length: 9 }, (_, index) => ({
      name: `after-${index}.png`, mimeType: 'image/png', buffer: png,
    })))
    await expect(page.getByText('Puoi aggiungere al massimo 8 foto.')).toBeVisible()
    await expect(page.locator('img[alt="Anteprima foto pulizia"]')).toHaveCount(8)
    await expect(page.getByRole('button', { name: 'Conferma', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Conferma', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Completa Pulizia', exact: true })).toHaveCount(0)
    await expect.poll(async () => (await photos()).length).toBe(10)
    expect((await photos()).filter(photo => photo.phase === 'after')).toHaveLength(8)
    expect((await photos()).every(photo => photo.status === 'ready')).toBe(true)

    await page.goto(`/service-orders/${fixture.photoOrderId}`)
    const gallery = page.locator('#foto-pulizia')
    await expect(gallery.locator('img')).toHaveCount(10)
    await expect(gallery.getByRole('button', { name: 'Elimina foto' })).toHaveCount(0)
    await gallery.locator('img').first().click()
    const dialog = page.getByRole('dialog', { name: 'Foto della pulizia' })
    await expect(dialog).toBeVisible()
    await expect.poll(() => dialog.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
    await dialog.getByRole('button', { name: 'Chiudi' }).click()

    for (const role of ['consegna', 'cliente']) {
      const viewerContext = await browser.newContext({ baseURL })
      const viewerPage = await viewerContext.newPage()
      await login(viewerPage, role)
      await viewerPage.goto(`/service-orders/${fixture.photoOrderId}`)
      await expect(viewerPage.locator('#foto-pulizia img')).toHaveCount(10)
      await expect(viewerPage.getByRole('button', { name: 'Elimina foto' })).toHaveCount(0)
      await viewerContext.close()
    }

    const adminContext = await browser.newContext({ baseURL })
    const adminPage = await adminContext.newPage()
    await login(adminPage, 'admin')
    await adminPage.goto(`/service-orders/${fixture.photoOrderId}`)
    adminPage.on('dialog', dialog => { void dialog.accept() })
    adminPage.on('request', request => {
      if (capturingDeletion && request.headers()['next-action']) deleteAction = request.headers()['next-action']
    })
    capturingDeletion = true
    await adminPage.getByRole('button', { name: 'Elimina foto' }).first().click()
    await expect(adminPage.locator('#foto-pulizia img')).toHaveCount(9)
    capturingDeletion = false
    const remaining = await photos()
    expect(remaining).toHaveLength(9)
    // A worker cannot invoke the administrative action even with a valid photo ID.
    await deniedAction(page, deleteAction, [remaining[0].id])
    expect(await photos()).toHaveLength(9)
    await adminContext.close()
  } finally {
    await context.close()
  }
})
