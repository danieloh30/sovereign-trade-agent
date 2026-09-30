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
    ['JPY transfer', 'Review required'],
  ]
  for (const [scenario, verdict] of cases) {
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
      await page.getByRole('button', { name: 'Open human review' }).click()
      await expect(page.getByLabel('Reviewer name')).toBeVisible()
      await page.screenshot({ path: resolve('../../../assets/human_review.png'), fullPage: true })
      await page.getByLabel('Reviewer name').fill('Daniel')
      await page.getByLabel('Review note').fill('Supplier details checked for this presentation. Approved for the demo; no payment executed.')
      await page.getByRole('button', { name: 'Approve review' }).click()
      await expect(page.getByRole('heading', { name: 'Approved by human' })).toBeVisible()
      await expect(page.getByRole('link', { name: /View review trace/ })).toBeVisible()
      await page.screenshot({ path: resolve('../../../assets/human_review_completed.png'), fullPage: true })
      await page.getByRole('button', { name: 'Transaction check', exact: true }).click()
      await expect(page.getByRole('article', { name: 'Analysis result' })).toContainText('Approved by human')
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
  await expect(page.getByRole('article', { name: 'Analysis result' })).toHaveCount(5)
  await page.screenshot({ path: resolve('../../../assets/session_history.png'), fullPage: true })
  await page.getByRole('button', { name: /Transaction check/ }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: resolve('../../../assets/mobile_ui.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('a real human decline survives refresh and preserves the policy evidence', async ({ page, request }) => {
  test.skip(process.env.CAPTURE_DEMO !== '1', 'Set CAPTURE_DEMO=1 to run against the real local agent')
  await page.goto('/')
  await page.getByRole('button', { name: /High-value GBP/ }).click()
  const response = page.waitForResponse(response => response.url().endsWith('/trade/analyze') && response.request().method() === 'POST')
  await page.getByRole('button', { name: /Run analysis/ }).click()
  await expect(page.getByRole('heading', { name: 'Manual review required', exact: true })).toBeVisible({ timeout: 40000 })
  const analysis = await (await response).json()
  expect(analysis.reviewRequestId).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Open human review' }).click()
  await page.getByLabel('Reviewer name').fill('Daniel')
  await page.getByLabel('Review note').fill('Supplier details could not be verified for this demo.')
  await page.getByRole('button', { name: 'Decline review' }).click()
  await expect(page.getByRole('heading', { name: 'Declined by human' })).toBeVisible()
  const saved = await request.get(`/trade/reviews/${analysis.reviewRequestId}`)
  expect(saved.ok()).toBe(true)
  expect(await saved.json()).toMatchObject({ status: 'DECLINED', reviewer: 'Daniel', decision: analysis.decision })
  await page.reload()
  await page.getByRole('button', { name: 'Human review', exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`Review #${analysis.reviewRequestId}\\b`) }).click()
  await expect(page.getByRole('heading', { name: 'Declined by human' })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Review details' })).toContainText('Manual review required')
  await expect(page.getByLabel('Reviewer name')).toHaveCount(0)
})
