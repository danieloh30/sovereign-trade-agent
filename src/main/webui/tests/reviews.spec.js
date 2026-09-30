import { test, expect } from '@playwright/test'

const decision = { verdict: 'REJECTED', message: 'Demo policy requires manual review.', amount: 12500, currency: 'GBP', ruleId: 1, threshold: 10000 }
const pending = {
  id: 101, query: 'Check a £12,500 GBP payment.', decision, model: 'llama3.2',
  analysisTraceId: '12345678901234567890123456789012', status: 'PENDING', createdAt: '2026-09-30T15:00:00Z',
  reviewer: null, note: null, reviewedAt: null, reviewTraceId: null,
}
const analysis = { decision, model: 'llama3.2', traceId: pending.analysisTraceId, durationMs: 450, reviewRequestId: pending.id }

async function analyze(page) {
  await page.route('**/trade/analyze', route => route.fulfill({ json: analysis }))
  await page.goto('/')
  await page.getByRole('button', { name: /High-value GBP/ }).click()
  await page.getByRole('button', { name: /Run analysis/ }).click()
  await page.getByRole('button', { name: 'Open human review' }).click()
}

for (const outcome of ['APPROVED', 'DECLINED']) {
  test(`records a human ${outcome.toLowerCase()} decision while preserving the policy verdict`, async ({ page }) => {
    let stored = { ...pending }
    let submissions = 0
    await page.route('**/trade/reviews', route => route.fulfill({ json: [stored] }))
    await page.route('**/trade/reviews/101/decision', async route => {
      submissions++
      const body = route.request().postDataJSON()
      expect(body.outcome).toBe(outcome)
      stored = { ...pending, status: body.outcome, reviewer: body.reviewer, note: body.note,
        reviewedAt: '2026-09-30T15:01:00Z', reviewTraceId: 'abcdefabcdefabcdefabcdefabcdefab' }
      await route.fulfill({ json: stored })
    })
    await analyze(page)
    const button = page.getByRole('button', { name: outcome === 'APPROVED' ? 'Approve review' : 'Decline review' })
    await expect(button).toBeDisabled()
    await page.getByLabel('Reviewer name').fill('Daniel')
    await expect(button).toBeDisabled()
    await page.getByRole('button', { name: outcome === 'APPROVED' ? 'Use approval example' : 'Use decline example' }).click()
    await expect(page.getByLabel('Review note')).toHaveValue(outcome === 'APPROVED' ? /Supplier identity and invoice verified/ : /Supplier identity could not be verified/)
    // Example notes are editable and never submit a human decision themselves.
    expect(submissions).toBe(0)
    await page.getByLabel('Review note').fill('Supplier details checked in the demo.')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath('pending-mobile.png'), fullPage: true })
    await button.click()
    await expect(page.getByRole('heading', { name: outcome === 'APPROVED' ? 'Approved by human' : 'Declined by human' })).toBeVisible()
    await expect(page.getByRole('article', { name: 'Review details' })).toContainText('Daniel')
    await expect(page.getByRole('article', { name: 'Review details' })).toContainText('Supplier details checked in the demo.')
    await expect(page.getByRole('button', { name: 'Approve review' })).toHaveCount(0)
    expect(submissions).toBe(1)
    await expect(page.getByRole('link', { name: /View review trace/ })).toHaveAttribute('href', /abcdefabcdefabcdefabcdefabcdefab/)
    await page.getByRole('button', { name: 'Transaction check', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Manual review required', exact: true })).toBeVisible()
    await expect(page.getByRole('article', { name: 'Analysis result' })).toContainText(outcome === 'APPROVED' ? 'Approved by human' : 'Declined by human')
    await page.getByRole('button', { name: 'Session history', exact: false }).click()
    await expect(page.getByRole('article', { name: 'Analysis result' })).toContainText(outcome === 'APPROVED' ? 'Approved by human' : 'Declined by human')
    await page.getByRole('button', { name: 'API exchange', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Analysis response' })).toContainText('"verdict": "REJECTED"')
    await page.reload()
    await page.getByRole('button', { name: 'Human review', exact: true }).click()
    await expect(page.getByRole('heading', { name: outcome === 'APPROVED' ? 'Approved by human' : 'Declined by human' })).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.screenshot({ path: test.info().outputPath('reviewed-desktop.png'), fullPage: true })
  })
}

test('a conflict can be refreshed without overwriting another reviewer', async ({ page }) => {
  let stored = { ...pending }
  await page.route('**/trade/reviews', route => route.fulfill({ json: [stored] }))
  await page.route('**/trade/reviews/101/decision', route => {
    stored = { ...pending, status: 'DECLINED', reviewer: 'Other reviewer', note: 'Not verified.', reviewedAt: '2026-09-30T15:01:00Z' }
    return route.fulfill({ status: 409, json: { message: 'This request already has a human decision. Refresh to see it.' } })
  })
  await analyze(page)
  await page.getByLabel('Reviewer name').fill('Daniel')
  await page.getByLabel('Review note').fill('Checked.')
  await page.getByRole('button', { name: 'Approve review' }).click()
  await expect(page.getByRole('alert')).toContainText('already has a human decision')
  await page.getByRole('button', { name: 'Refresh reviews' }).click()
  await expect(page.getByRole('heading', { name: 'Declined by human' })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Review details' })).toContainText('Other reviewer')
})

test('a network failure does not fabricate human approval', async ({ page }) => {
  await page.route('**/trade/reviews', route => route.fulfill({ json: [pending] }))
  await page.route('**/trade/reviews/101/decision', route => route.abort())
  await analyze(page)
  await page.getByLabel('Reviewer name').fill('Daniel')
  await page.getByLabel('Review note').fill('Checked.')
  await page.getByRole('button', { name: 'Approve review' }).click()
  await expect(page.getByRole('alert')).toContainText('Could not record your decision')
  await expect(page.getByRole('heading', { name: 'Approved by human' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Approve review' })).toBeEnabled()
})

test('an older request remains accessible from its analysis result', async ({ page }) => {
  await page.route('**/trade/reviews', route => route.fulfill({ json: [] }))
  await page.route('**/trade/reviews/101', route => route.fulfill({ json: pending }))
  await analyze(page)
  await expect(page.getByRole('heading', { name: 'Review #101' })).toBeVisible()
  await expect(page.getByLabel('Reviewer name')).toBeVisible()
})

test('locks the human decision while its submission is pending', async ({ page }) => {
  let release
  const pendingResponse = new Promise(resolve => { release = resolve })
  await page.route('**/trade/reviews', route => route.fulfill({ json: [pending] }))
  await page.route('**/trade/reviews/101/decision', async route => {
    await pendingResponse
    await route.fulfill({ json: { ...pending, status: 'APPROVED', reviewer: 'Daniel', note: 'Checked.', reviewedAt: '2026-09-30T15:01:00Z' } })
  })
  await analyze(page)
  await page.getByLabel('Reviewer name').fill('Daniel')
  await page.getByLabel('Review note').fill('Checked.')
  await page.getByRole('button', { name: 'Approve review' }).click()
  await expect(page.getByLabel('Reviewer name')).toBeDisabled()
  await expect(page.getByLabel('Review note')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Decline review' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Use approval example' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Use decline example' })).toBeDisabled()
  release()
  await expect(page.getByRole('heading', { name: 'Approved by human' })).toBeVisible()
})
