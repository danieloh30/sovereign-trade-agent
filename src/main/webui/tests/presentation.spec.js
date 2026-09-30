import { test, expect } from '@playwright/test'

const result = {
  decision: { verdict: 'REJECTED', message: 'Manual review under the GBP policy.', amount: 12500, currency: 'GBP', ruleId: 1, threshold: 10000 },
  model: 'llama3.2', traceId: '12345678901234567890123456789012', durationMs: 450,
}
const rules = [
  { id: 1, currency: 'GBP', threshold: 10000, verdict: 'REJECTED', description: 'Manual review under the GBP policy.' },
  { id: 2, currency: 'GBP', threshold: 5000, verdict: 'WARNING', description: 'Enhanced due diligence.' },
]

test('reveals outcomes after analysis and shows the actual matched database rule', async ({ page }) => {
  await page.route('**/trade/analyze', route => route.fulfill({ json: result }))
  await page.route('**/trade/policies', route => route.fulfill({ json: rules }))
  await page.goto('/')
  const scenarios = page.getByRole('button', { name: /High-value GBP|Standard GBP|Mid-range GBP|EUR transfer/ })
  await expect(scenarios).toHaveCount(4)
  for (const scenario of await scenarios.all()) await expect(scenario).not.toContainText(/Cleared|Warning|Rejected|Manual review/)
  await page.getByRole('button', { name: /High-value GBP/ }).click()
  await page.getByRole('button', { name: /Run analysis/ }).click()
  await expect(page.getByRole('heading', { name: 'Manual review required', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('mobile-result.png'), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'View matched policy' }).click()
  const match = page.getByRole('row').filter({ hasText: 'Latest match' })
  await expect(match).toContainText('10,000.00')
  await expect(match).toContainText('GBP')
  await expect(page.getByRole('table')).toContainText('Enhanced due diligence.')
  await page.screenshot({ path: test.info().outputPath('policies.png'), fullPage: true })
})

test('keeps the submitted API request paired with its response after editing the next query', async ({ page }) => {
  let submitted
  await page.route('**/trade/analyze', route => {
    submitted = route.request().postData()
    return route.fulfill({ json: result })
  })
  await page.goto('/')
  await page.getByRole('button', { name: /High-value GBP/ }).click()
  await page.getByRole('button', { name: /Run analysis/ }).click()
  await expect(page.getByRole('article')).toBeVisible()
  await page.getByLabel('Transaction query').fill('Check a different payment.')
  await page.getByRole('button', { name: 'API exchange' }).click()
  await expect(page.getByRole('region', { name: 'Analysis request' })).toContainText(submitted)
  const response = page.getByRole('region', { name: 'Analysis response' })
  await expect(response).toContainText('HTTP 200')
  await expect(response).toContainText('"verdict": "REJECTED"')
  await expect(response).toContainText(result.traceId)
  await expect(page.getByRole('link', { name: /Open Swagger UI/ })).toHaveAttribute('href', '/q/swagger-ui/')
  await expect(page.getByRole('link', { name: /OpenAPI specification/ })).toHaveAttribute('href', '/q/openapi')
  await page.getByText('Repeat this request with curl', { exact: true }).click()
  await expect(page.locator('details pre')).toContainText("'\\''London Tech Ltd'\\''")
  await page.screenshot({ path: test.info().outputPath('api.png'), fullPage: true })
})

test('distinguishes an HTTP error response from a network failure', async ({ page }) => {
  await page.route('**/trade/analyze', route => route.fulfill({ status: 503, json: {
    decision: { verdict: 'ERROR', message: 'Service unavailable.' }, durationMs: 100,
  } }))
  await page.goto('/')
  await page.getByRole('button', { name: /Standard GBP/ }).click()
  await page.getByRole('button', { name: /Run analysis/ }).click()
  await expect(page.getByRole('heading', { name: 'Analysis unavailable' })).toBeVisible()
  await page.getByRole('button', { name: 'API exchange' }).click()
  await expect(page.getByRole('region', { name: 'Analysis response' })).toContainText('HTTP 503')
  await page.getByRole('button', { name: 'Transaction check' }).click()
  await page.route('**/trade/analyze', route => route.abort())
  await page.getByRole('button', { name: 'Retry analysis' }).click()
  await expect(page.getByText(/Could not complete the analysis/)).toBeVisible()
  await page.getByRole('button', { name: 'API exchange' }).click()
  await expect(page.getByRole('region', { name: 'Analysis response' })).toContainText('No HTTP response')
  await expect(page.getByRole('region', { name: 'Analysis response' }).locator('pre')).toHaveCount(0)
})

test('retries policy loading and preserves navigation on a narrow screen', async ({ page }) => {
  let available = false
  await page.route('**/trade/policies', route => {
    return available ? route.fulfill({ json: rules }) : route.fulfill({ status: 503 })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Demo policies' }).click()
  await expect(page.getByRole('button', { name: 'Retry policies' })).toBeVisible()
  available = true
  await page.getByRole('button', { name: 'Retry policies' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('mobile-policies.png'), fullPage: true })
  await page.getByRole('button', { name: 'API exchange' }).click()
  await expect(page.getByRole('heading', { name: 'API exchange' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('mobile-api.png'), fullPage: true })
})

test('the boundary and JPY examples submit their exact amounts and currencies', async ({ page }) => {
  await page.route('**/trade/analyze', route => route.fulfill({ json: result }))
  await page.goto('/')
  await page.getByText('Boundary and currency examples', { exact: true }).click()
  for (const [label, amount, currency] of [['Below GBP boundary', '9999', 'GBP'], ['At GBP boundary', '10000', 'GBP'], ['JPY transfer', '12000', 'JPY']]) {
    await page.getByRole('button', { name: new RegExp(label) }).click()
    const request = page.waitForRequest('**/trade/analyze')
    await page.getByRole('button', { name: /Run analysis/ }).click()
    expect((await request).postData()).toContain(`${amount} ${currency}`)
    await expect(page.getByRole('article')).toBeVisible()
  }
})
