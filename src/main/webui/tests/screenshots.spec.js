import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'

// Opt in: these screenshots exercise the real local model and database.
test('capture the live demo and session history', async ({ page }) => {
  test.skip(process.env.CAPTURE_DEMO !== '1', 'Set CAPTURE_DEMO=1 to run against the real local agent')
  test.setTimeout(120000)
  await page.goto('/')
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const cases = [
    ['High-value GBP', 'Manual review required'], ['Standard GBP', 'Cleared'],
    ['Mid-range GBP', 'Warning'], ['EUR transfer', 'Cleared'],
    ['Below GBP boundary', 'Warning'], ['At GBP boundary', 'Manual review required'],
    ['JPY transfer', 'Review required'],
  ]
  for (const [scenario, verdict] of cases) {
    if (scenario === 'Below GBP boundary') await page.getByText('Boundary and currency examples', { exact: true }).click()
    await page.getByRole('button', { name: new RegExp(scenario) }).click()
    await page.getByRole('button', { name: /Run analysis/ }).click()
    await expect(page.getByRole('heading', { name: verdict, exact: true })).toBeVisible({ timeout: 40000 })
    if (scenario === 'High-value GBP') {
      await page.screenshot({ path: resolve('../../../assets/web_ui.png'), fullPage: true })
      await page.getByRole('button', { name: 'View matched policy' }).click()
      await expect(page.getByRole('row').filter({ hasText: 'Latest match' })).toBeVisible()
      await page.screenshot({ path: resolve('../../../assets/policies.png'), fullPage: true })
      await page.getByRole('button', { name: 'API exchange' }).click()
      await expect(page.getByRole('region', { name: 'Analysis response' })).toContainText('"verdict": "REJECTED"')
      await page.screenshot({ path: resolve('../../../assets/api_exchange.png'), fullPage: true })
      await page.getByRole('button', { name: 'Transaction check' }).click()
    }
  }
  // Verify that the real trace link resolves to the policy tool span in Grafana.
  const traceHref = await page.getByRole('link', { name: /View this trace/ }).getAttribute('href')
  const tracePage = await page.context().newPage()
  await tracePage.setViewportSize({ width: 1600, height: 1200 })
  await tracePage.goto(traceHref)
  await expect(async () => {
    await tracePage.reload()
    await expect(tracePage.getByText('checkAMLStatus', { exact: true }).first()).toBeVisible({ timeout: 3000 })
  }).toPass({ intervals: [1000, 2000, 5000], timeout: 30000 }).catch(async error => {
    console.log(await tracePage.locator('body').innerText())
    await tracePage.screenshot({ path: test.info().outputPath('trace-error.png'), fullPage: true })
    throw error
  })
  await tracePage.screenshot({ path: resolve('../../../assets/tempo.png'), fullPage: true })
  await tracePage.close()
  await page.getByRole('button', { name: /Session history/ }).click()
  await expect(page.getByRole('article', { name: 'Analysis result' })).toHaveCount(7)
  await page.screenshot({ path: resolve('../../../assets/session_history.png'), fullPage: true })
  await page.getByRole('button', { name: /Transaction check/ }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: resolve('../../../assets/mobile_ui.png'), fullPage: true })
  expect(errors).toEqual([])
})
