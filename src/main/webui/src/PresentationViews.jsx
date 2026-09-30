import { useEffect, useState } from 'react'
import { VERDICTS } from './verdicts'

export function PolicyView({ decision }) {
  const [rules, setRules] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    let active = true
    setRules(null)
    setError('')
    async function load() {
      try {
        const response = await fetch('/trade/policies', { headers: { Accept: 'application/json' }, signal: controller.signal })
        if (!response.ok) throw new Error('Policies unavailable')
        const data = await response.json()
        if (!Array.isArray(data) || data.some(rule => !Number.isFinite(rule.id)
            || typeof rule.currency !== 'string' || !Number.isFinite(rule.threshold)
            || !VERDICTS[rule.verdict] || typeof rule.description !== 'string')) throw new Error('Invalid policies')
        if (active) setRules(data)
      } catch {
        if (active) setError('Could not load the local policies. Check the app and PostgreSQL, then retry.')
      } finally {
        clearTimeout(timeout)
      }
    }
    load()
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [attempt])

  const matches = rule => rule.id === decision?.ruleId && rule.currency === decision.currency
    && rule.threshold === decision.threshold && rule.verdict === decision.verdict

  return <>
    <div className="page-header"><p className="eyebrow">Local policy database</p><h1>Demo policies</h1><p>The same PostgreSQL rules used by the policy tool.</p></div>
    <div className="explanation-card"><h2>How a rule is selected</h2><p>For a positive amount, the highest threshold at or below the amount wins. Thresholds are inclusive: £10,000 matches the £10,000 rule. A currency without a policy requires review.</p></div>
    <div aria-live="polite" aria-busy={rules === null && !error}>
      {error ? <div className="message-card"><p>{error}</p><button className="button secondary" onClick={() => setAttempt(value => value + 1)}>Retry policies</button></div>
        : rules === null ? <p className="message-card" role="status">Loading local policies…</p>
        : rules.length === 0 ? <p className="message-card">No policies are configured. Payments require review.</p>
        : <div className="table-wrap" role="region" aria-label="Local policy rules" tabIndex={0}><table className="policy-table">
          <caption>Current rules · highest threshold first within each currency</caption>
          <thead><tr><th scope="col">Rule</th><th scope="col">Currency</th><th scope="col">Amount ≥</th><th scope="col">Outcome</th><th scope="col">Policy reason</th></tr></thead>
          <tbody>{rules.map(rule => <tr key={rule.id} className={matches(rule) ? 'matched-rule' : ''}>
            <th scope="row">{rule.id}{matches(rule) && <span className="matched-label">Latest match</span>}</th>
            <td>{rule.currency}</td><td>{new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rule.threshold)}</td>
            <td>{VERDICTS[rule.verdict].label}</td><td>{rule.description}</td>
          </tr>)}</tbody>
        </table></div>}
    </div>
    <p className="policy-note">Illustrative AML policies. Cleared means no configured review threshold was triggered. Manual review required is a policy outcome; this demo never executes or rejects a payment.</p>
  </>
}

// Quote literal request bodies safely, including apostrophes in company names.
const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`

export function ApiView({ query, exchange }) {
  const body = exchange?.query ?? query
  const curl = `curl ${shellQuote(`${window.location.origin}/trade/analyze`)} -H 'Content-Type: text/plain' -H 'Accept: application/json' --data-raw ${shellQuote(body)}`
  return <>
    <div className="page-header"><p className="eyebrow">The HTTP contract</p><h1>API exchange</h1><p>The dashboard and other API clients use the same analysis endpoint.</p></div>
    <div className="api-links"><a className="button secondary" href="/q/swagger-ui/" target="_blank" rel="noopener noreferrer">Open Swagger UI ↗</a><a href="/q/openapi" target="_blank" rel="noopener noreferrer">OpenAPI specification ↗</a></div>
    <section className="code-card" aria-label="Analysis request"><div className="code-heading"><h2>{exchange ? 'Latest request' : 'Request preview'}</h2><span>POST /trade/analyze</span></div><p className="code-meta">Content-Type: text/plain · Accept: application/json</p>
      {body ? <pre>{body}</pre> : <p className="message-card">Choose a scenario or enter a transaction in Transaction check.</p>}
    </section>
    <section className="code-card" aria-label="Analysis response"><div className="code-heading"><h2>Latest response</h2><span>{exchange?.status != null ? `HTTP ${exchange.status}` : exchange ? 'No HTTP response' : 'No request yet'}</span></div>
      {exchange ? <>{exchange.error && <p className="message-card">{exchange.error}</p>}{exchange.response != null && <pre>{typeof exchange.response === 'string' ? exchange.response : JSON.stringify(exchange.response, null, 2)}</pre>}</>
        : <p className="message-card">Run an analysis to see the actual server response, including its verdict, matched policy, and trace ID.</p>}
    </section>
    {body && <details className="code-card"><summary>Repeat this request with curl</summary><pre>{curl}</pre></details>}
    <div className="explanation-card"><h2>Reading the verdict</h2><p><code>REJECTED</code> is the API code displayed as “Manual review required” when a policy matches. <code>REVIEW_REQUIRED</code> means a transaction or policy match could not be verified. No payment is executed.</p></div>
  </>
}
