import { expect, test, type Browser, type Page } from '@playwright/test'

type SyntheticUser = { email: string; password: string }
type E2EFixture = {
  boundaryEndProperty: string
  boundaryOutsideProperty: string
  createNote: string
  editNote: string
  foreignOrderId: string
  orderId: string
  propertyId: string
  propertyName: string
  today: string
  unassignedOrderId: string
  users: Record<string, SyntheticUser>
}

const encodedFixture = process.env.E2E_FIXTURE_B64
if (!encodedFixture) throw new Error('E2E_FIXTURE_B64 is required.')
const fixture = JSON.parse(
  Buffer.from(encodedFixture, 'base64url').toString('utf8'),
) as E2EFixture

async function login(page: Page, user: SyntheticUser) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  const responsePromise = page.waitForResponse(response => (
    response.url().endsWith('/api/auth/login') && response.request().method() === 'POST'
  ))
  await page.getByRole('button', { name: 'Accedi' }).click()
  const response = await responsePromise
  expect(response.status()).toBe(200)
  await expect(page).toHaveURL(/\/service-orders$/)
}

async function newIsolatedPage(browser: Browser) {
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  return { context, page: await context.newPage() }
}

async function setDateRange(page: Page, value: string) {
  const dates = page.locator('input[type="date"]')
  await expect(dates).toHaveCount(2)
  await dates.nth(0).fill(value)
  await dates.nth(1).fill(value)
}

test.describe.serial('Sprint 12A critical flows', () => {
  test('enforces role access, route negatives, and object-level negatives', async ({ browser }) => {
    const expectations = {
      admin: { dashboard: true, employees: true, newOrder: true, exports: true },
      secretaria: { dashboard: false, employees: false, newOrder: true, exports: false },
      limpeza: { dashboard: false, employees: false, newOrder: false, exports: false },
      consegna: { dashboard: false, employees: false, newOrder: false, exports: false },
      cliente: { dashboard: false, employees: false, newOrder: false, exports: false },
    } as const

    for (const [role, expected] of Object.entries(expectations)) {
      const { context, page } = await newIsolatedPage(browser)
      await login(page, fixture.users[role])
      await expect(page.locator('body')).toContainText(fixture.propertyName)

      await page.goto('/employees')
      await expect(page).toHaveURL(expected.employees ? /\/employees$/ : /\/service-orders$/)

      await page.goto('/dashboard')
      await expect(page).toHaveURL(expected.dashboard ? /\/dashboard$/ : /\/service-orders$/)

      await page.goto('/service-orders/new')
      await expect(page).toHaveURL(expected.newOrder ? /\/service-orders\/new$/ : /\/service-orders$/)

      const exportResponse = await page.request.get(
        `/api/export/receivable?start=${fixture.today}&end=${fixture.today}`,
      )
      expect(exportResponse.status()).toBe(expected.exports ? 200 : 403)

      if (role === 'limpeza' || role === 'consegna') {
        const response = await page.goto(`/service-orders/${fixture.unassignedOrderId}`)
        expect(response?.status()).toBe(404)
      }
      if (role === 'cliente') {
        const response = await page.goto(`/service-orders/${fixture.foreignOrderId}`)
        expect(response?.status()).toBe(404)
      }

      await context.close()
    }
  })

  test('creates and edits service orders through the browser', async ({ page }) => {
    await login(page, fixture.users.admin)

    await page.goto('/service-orders/new')
    await page.getByRole('combobox').first().selectOption(fixture.propertyId)
    await page.locator('input[type="date"]').first().fill(fixture.today)
    await page.getByRole('button', { name: '4. Note sulla Pulizia' }).click()
    await page.getByPlaceholder('Indicazioni del cliente, punti di attenzione, richieste speciali di pulizia…').fill(fixture.createNote)
    await page.getByRole('button', { name: 'Crea O.L.' }).click()
    await expect(page).toHaveURL(/\/service-orders$/)

    await page.goto(`/service-orders/${fixture.orderId}`)
    await page.getByRole('button', { name: '4. Note sulla Pulizia' }).click()
    await page.getByPlaceholder('Indicazioni del cliente, punti di attenzione, richieste speciali di pulizia…').fill(fixture.editNote)
    await page.getByRole('button', { name: 'Salva Modifiche' }).click()
    await expect(page.getByText('O.L. salvato con successo.')).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: '4. Note sulla Pulizia' }).click()
    await expect(page.getByPlaceholder('Indicazioni del cliente, punti di attenzione, richieste speciali di pulizia…')).toHaveValue(fixture.editNote)
  })

  test('keeps Rome date boundaries consistent across dashboard, CSV, and PDF views', async ({ page }) => {
    await login(page, fixture.users.admin)

    await page.goto('/dashboard')
    await expect(page.locator('body')).toContainText(fixture.propertyName)
    await expect(page.locator('body')).toContainText(fixture.boundaryEndProperty)

    await page.goto('/statements/receivable')
    await setDateRange(page, fixture.today)
    await page.getByRole('button', { name: 'Filtrar' }).click()
    await expect(page.locator('body')).toContainText(fixture.propertyName)
    await expect(page.locator('body')).toContainText(fixture.boundaryEndProperty)
    await expect(page.getByText(fixture.boundaryOutsideProperty)).toHaveCount(0)

    let response = await page.request.get(
      `/api/export/receivable?start=${fixture.today}&end=${fixture.today}`,
    )
    expect(response.status()).toBe(200)
    let body = await response.text()
    expect(body).toContain(fixture.propertyName)
    expect(body).toContain(fixture.boundaryEndProperty)
    expect(body).not.toContain(fixture.boundaryOutsideProperty)

    let popupPromise = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'PDF' }).click()
    let popup = await popupPromise
    await expect(popup.locator('body')).toContainText(fixture.propertyName)
    await expect(popup.locator('body')).toContainText(fixture.boundaryEndProperty)
    await expect(popup.locator('body')).not.toContainText(fixture.boundaryOutsideProperty)
    await popup.close()

    await page.goto('/statements/payable')
    await setDateRange(page, fixture.today)
    await page.getByRole('button', { name: 'Filtrar' }).click()
    await expect(page.locator('body')).toContainText('Sensitive Smoke limpeza')

    response = await page.request.get(
      `/api/export/payable?start=${fixture.today}&end=${fixture.today}`,
    )
    expect(response.status()).toBe(200)
    body = await response.text()
    expect(body).toContain(fixture.propertyName)
    expect(body).toContain(fixture.boundaryEndProperty)
    expect(body).not.toContain(fixture.boundaryOutsideProperty)

    popupPromise = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'PDF' }).click()
    popup = await popupPromise
    await expect(popup.locator('body')).toContainText(fixture.propertyName)
    await expect(popup.locator('body')).toContainText(fixture.boundaryEndProperty)
    await expect(popup.locator('body')).not.toContainText(fixture.boundaryOutsideProperty)
    await popup.close()
  })

  test('locks a synthetic login after four failures and keeps the message generic', async ({ page }) => {
    const user = fixture.users.lockout
    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await page.getByLabel('Password').fill(`invalid-${attempt}`)
      const responsePromise = page.waitForResponse(response => (
        response.url().endsWith('/api/auth/login') && response.request().method() === 'POST'
      ))
      await page.getByRole('button', { name: 'Accedi' }).click()
      expect((await responsePromise).status()).toBe(401)
      await expect(page.getByText('Email ou senha incorretos.')).toBeVisible()
    }

    await page.getByLabel('Password').fill(user.password)
    const blockedResponse = page.waitForResponse(response => (
      response.url().endsWith('/api/auth/login') && response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: 'Accedi' }).click()
    expect((await blockedResponse).status()).toBe(401)
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText('Email ou senha incorretos.')).toBeVisible()
  })
})
