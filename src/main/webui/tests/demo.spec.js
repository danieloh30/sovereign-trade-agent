import { test, expect } from '@playwright/test'

const result = {
  decision: { verdict: 'REJECTED', message: 'Demo policy: manual review required for amounts of £10,000 or more.', amount: 12500, currency: 'GBP', ruleId: 1, threshold: 10000 },
  model: 'llama3.2', traceId: '12345678901234567890123456789012', durationMs: 450,
}

async function chooseScenario(page) {
  await page.goto('/')
  await page.getByRole('button', { name: /High-value GBP/ }).click()
}

test('uses the structured verdict and opens its exact trace', async ({ page }) => {
  await page.route('**/trade/analyze', route => route.fulfill({ json: { ...result, decision: { ...result.decision, message: 'Payment needs manual review.' } } }))
  await chooseScenario(page)
  await page.getByRole('button', { name: /Run analysis/ }).click()
  await expect(page.getByRole('heading', { name: 'Rejected', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /View this trace/ })).toHaveAttribute('href', new RegExp(result.traceId))
  await page.getByRole('button', { name: /Session history/ }).click()
  await expect(page.getByText('Payment needs manual review.')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /Session history/ }).click()
  await expect(page.getByRole('heading', { name: 'No checks yet' })).toBeVisible()
})

test('locks the query and scenarios until the pending response completes', async ({ page }) => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  await page.route('**/trade/analyze', async route => { await pending; await route.fulfill({ json: result }) })
  await chooseScenario(page)
  await page.getByRole('button', { name: /Run analysis/ }).click()
  await expect(page.getByLabel('Transaction query')).toBeDisabled()
  await expect(page.getByRole('button', { name: /Standard GBP/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled()
  release()
  await expect(page.getByRole('heading', { name: 'Rejected', exact: true })).toBeVisible()
  await expect(page.getByLabel('Transaction query')).toBeEnabled()
  await page.getByRole('button', { name: /Standard GBP/ }).click()
  await expect(page.getByRole('article', { name: 'Analysis result' })).toHaveCount(0)
})

test('times out without hanging the demo and permits retry', async ({ page }) => {
  await page.clock.install()
  let release
  const pending = new Promise(resolve => { release = resolve })
  await page.route('**/trade/analyze', async route => { await pending; await route.abort().catch(() => {}) })
  await chooseScenario(page)
  await page.getByRole('button', { name: /Run analysis/ }).click()
  await expect(page.getByLabel('Transaction query')).toBeDisabled()
  await page.clock.fastForward(36000)
  await expect(page.getByText(/The request timed out/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry analysis' })).toBeEnabled()
  release()
})

test('handles a non-JSON server failure without displaying its raw page', async ({ page }) => {
  await page.route('**/trade/analyze', route => route.fulfill({ status: 503, contentType: 'text/html', body: '<html>internal stack trace</html>' }))
  await chooseScenario(page)
  await page.getByRole('button', { name: /Run analysis/ }).click()
  await expect(page.getByRole('heading', { name: 'Analysis unavailable' })).toBeVisible()
  await expect(page.getByText('internal stack trace')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Retry analysis' })).toBeEnabled()
})

test('fits a narrow viewport and supports keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await chooseScenario(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: /Session history/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Session history' })).toBeVisible()
})
