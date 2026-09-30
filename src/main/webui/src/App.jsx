import { useEffect, useRef, useState } from 'react'
import './App.css'
import { VERDICTS } from './verdicts'
import { ApiView, PolicyView } from './PresentationViews'

const SCENARIOS = [
  { label: 'High-value GBP', amount: '£12,500', query: "I have a customer, 'London Tech Ltd', trying to move £12,500 to a new vendor in Estonia for 'Cloud Services'. Before I approve this, check our local AML rules." },
  { label: 'Standard GBP', amount: '£3,200', query: "Please verify a £3,200 GBP payment from 'Baker Street Consulting' to a domestic supplier for office furniture." },
  { label: 'Mid-range GBP', amount: '£7,500', query: 'A customer wants to send £7,500 GBP to a consulting firm in Dublin. Check if this triggers any AML rules.' },
  { label: 'EUR transfer', amount: '€9,000', query: 'Check AML compliance for a €9,000 EUR wire transfer from our Paris branch to a Frankfurt-based logistics company.' },
  { label: 'Below GBP boundary', amount: '£9,999', query: 'Check a 9999 GBP payment to a domestic supplier.' },
  { label: 'At GBP boundary', amount: '£10,000', query: 'Check a 10000 GBP payment to a domestic supplier.' },
  { label: 'JPY transfer', amount: '¥12,000', query: 'Check a 12000 JPY payment to a supplier in Tokyo.' },
]

const grafanaUrl = (import.meta.env.VITE_GRAFANA_URL || `${window.location.protocol}//${window.location.hostname}:3001`).replace(/\/$/, '')
function grafanaLink(kind, traceId) {
  const datasource = { type: kind, uid: kind }
  const query = kind === 'loki'
    ? { expr: '{service_name="sovereign-trade-agent"}' }
    : { queryType: 'traceql', query: traceId || '{resource.service.name = "sovereign-trade-agent"}' }
  const panes = { demo: { datasource: kind, queries: [{ refId: 'A', datasource, ...query }], range: { from: 'now-1h', to: 'now' } } }
  return `${grafanaUrl}/explore?schemaVersion=1&panes=${encodeURIComponent(JSON.stringify(panes))}&orgId=1`
}

function amountLabel(decision) {
  if (decision.amount == null) return 'Not extracted'
  return `${new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(decision.amount)} ${decision.currency || ''}`.trim()
}

function DecisionCard({ result, query, compact = false, onViewPolicy }) {
  const { decision } = result
  const verdict = VERDICTS[decision.verdict] || VERDICTS.REVIEW_REQUIRED
  return (
    <article className={`decision-card ${verdict.className}`} aria-label="Analysis result">
      <div className="decision-heading">
        <div className="decision-title"><span className="verdict-icon" aria-hidden="true">{verdict.icon}</span><h2>{verdict.label}</h2></div>
        <span className="duration">{(result.durationMs / 1000).toFixed(2)}s</span>
      </div>
      {compact && <p className="audit-query">{query}</p>}
      <p className="decision-message">{decision.message}</p>
      <dl className="decision-facts">
        <div><dt>Extracted transaction</dt><dd>{amountLabel(decision)}</dd></div>
        <div><dt>Matched policy</dt><dd>{decision.ruleId != null ? `Rule ${decision.ruleId} · ≥ ${new Intl.NumberFormat('en-GB').format(decision.threshold)} ${decision.currency}` : 'No verified match'}</dd></div>
      </dl>
      <div className="decision-footer">
        <span>{result.model ? `Model: ${result.model}` : 'Request did not complete'}</span>
        {decision.ruleId != null && onViewPolicy && <button className="text-button" onClick={onViewPolicy}>View matched policy</button>}
        {result.traceId && <a href={grafanaLink('tempo', result.traceId)} target="_blank" rel="noopener noreferrer">View this trace <span aria-hidden="true">↗</span></a>}
      </div>
    </article>
  )
}

export default function App() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeScenario, setActiveScenario] = useState(null)
  const [activeView, setActiveView] = useState('check')
  const [history, setHistory] = useState([])
  const [waiting, setWaiting] = useState(0)
  const [exchange, setExchange] = useState(null)
  const controller = useRef(null)
  const started = useRef(0)

  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    if (!loading) return
    const timer = setInterval(() => setWaiting((Date.now() - started.current) / 1000), 100)
    return () => clearInterval(timer)
  }, [loading])

  function loadScenario(index) {
    if (controller.current) return
    setActiveScenario(index)
    setQuery(SCENARIOS[index].query)
    setResult(null)
  }

  function clear() {
    if (controller.current) return
    setQuery('')
    setResult(null)
    setActiveScenario(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (controller.current || !query.trim()) return
    const submittedQuery = query.trim()
    const request = new AbortController()
    controller.current = request
    started.current = Date.now()
    setWaiting(0)
    setLoading(true)
    setResult(null)
    const timeout = setTimeout(() => request.abort(), 35000)
    let next
    const nextExchange = { query: submittedQuery, status: null, response: null }
    try {
      const response = await fetch('/trade/analyze', {
        method: 'POST', headers: { 'Content-Type': 'text/plain', Accept: 'application/json' },
        body: submittedQuery, signal: request.signal,
      })
      nextExchange.status = response.status
      const raw = await response.text()
      nextExchange.response = raw
      const data = JSON.parse(raw)
      nextExchange.response = data
      if (!data.decision || !VERDICTS[data.decision.verdict] || !Number.isFinite(data.durationMs)
          || (!response.ok && data.decision.verdict !== 'ERROR')) throw new Error('Invalid response')
      next = data
    } catch (error) {
      next = {
        decision: { verdict: 'ERROR', message: error.name === 'AbortError'
          ? 'The request timed out. Check that the local model is ready, then retry.'
          : 'Could not complete the analysis. Check the local app and Ollama, then retry.' },
        durationMs: Date.now() - started.current,
      }
      nextExchange.error = next.decision.message
    } finally {
      clearTimeout(timeout)
      controller.current = null
      setLoading(false)
    }
    setResult(next)
    setExchange(nextExchange)
    setHistory(previous => [...previous, { id: crypto.randomUUID(), query: submittedQuery, result: next, time: new Date().toLocaleTimeString('en-GB') }])
  }

  return (
    <>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">S</span><span>Sovereign Trade Agent</span></div>
        <div className="event"><span>apidays London 2026</span><span className="local-label">Local demo</span></div>
      </header>
      <div className="app-layout">
        <aside className="sidebar">
          <p className="nav-label">Workspace</p>
          <nav aria-label="Demo navigation">
            <button className={`nav-item ${activeView === 'check' ? 'active' : ''}`} onClick={() => setActiveView('check')} aria-current={activeView === 'check' ? 'page' : undefined}><span aria-hidden="true">▣</span>Transaction check</button>
            <button className={`nav-item ${activeView === 'policies' ? 'active' : ''}`} onClick={() => setActiveView('policies')} aria-current={activeView === 'policies' ? 'page' : undefined}><span aria-hidden="true">▤</span>Demo policies</button>
            <button className={`nav-item ${activeView === 'api' ? 'active' : ''}`} onClick={() => setActiveView('api')} aria-current={activeView === 'api' ? 'page' : undefined}><span aria-hidden="true">↔</span>API exchange</button>
            <button className={`nav-item ${activeView === 'audit' ? 'active' : ''}`} onClick={() => setActiveView('audit')} aria-current={activeView === 'audit' ? 'page' : undefined}><span aria-hidden="true">≡</span>Session history<span className="count">{history.length}</span></button>
          </nav>
          <p className="nav-label observability-label">Observability</p>
          <a className="nav-item" href={grafanaLink('tempo')} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">◎</span>Traces · Tempo<span className="external">↗</span></a>
          <a className="nav-item" href={grafanaLink('loki')} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▤</span>Logs · Loki<span className="external">↗</span></a>
          <div className="sidebar-note"><span className="eyebrow">The demo path</span><p>Local inference.<br />Local policies.<br />A trace for every check.</p></div>
          <a className="dev-link" href="/q/dev/" target="_blank" rel="noopener noreferrer">Quarkus Dev UI ↗</a>
        </aside>
        <main>
          {activeView === 'check' ? <>
            <div className="page-header"><p className="eyebrow">Sovereign AI in action</p><h1>Transaction compliance</h1><p>Describe a payment, check a local policy, and follow the decision.</p></div>
            <div className="scenarios" aria-label="Demo scenarios">
              {SCENARIOS.slice(0, 4).map((scenario, index) => <button key={scenario.label} className={`scenario ${activeScenario === index ? 'selected' : ''}`} disabled={loading} onClick={() => loadScenario(index)} aria-pressed={activeScenario === index}>
                <span className="scenario-amount">{scenario.amount}</span>
                <span className="scenario-label">{scenario.label}</span>
              </button>)}
            </div>
            <details className="more-scenarios"><summary>Boundary and currency examples</summary><div className="scenarios extra-scenarios">
              {SCENARIOS.slice(4).map((scenario, index) => <button key={scenario.label} className={`scenario ${activeScenario === index + 4 ? 'selected' : ''}`} disabled={loading} onClick={() => loadScenario(index + 4)} aria-pressed={activeScenario === index + 4}>
                <span className="scenario-amount">{scenario.amount}</span><span className="scenario-label">{scenario.label}</span>
              </button>)}
            </div></details>
            <form onSubmit={handleSubmit} className="query-card">
              <div className="query-heading"><label htmlFor="query">Transaction query</label><span>One transaction per check</span></div>
              <textarea id="query" value={query} disabled={loading} maxLength={2000} rows={4} required placeholder="Describe an amount, currency, and payment context…" onChange={event => { setQuery(event.target.value); setActiveScenario(null); setResult(null) }} />
              <div className="form-actions"><span className="input-hint">Try a scenario above or describe your own payment.</span><button type="button" className="button secondary" onClick={clear} disabled={loading || !query}>Clear</button><button type="submit" className="button primary" disabled={loading || !query.trim()}>{loading ? 'Checking…' : result?.decision.verdict === 'ERROR' ? 'Retry analysis' : 'Run analysis'}<span aria-hidden="true">{loading ? '' : ' →'}</span></button></div>
            </form>
            <div aria-live="polite" aria-atomic="true" aria-busy={loading}>
              {loading && <div className="loading-card" role="status"><span className="spinner" aria-hidden="true" /><div><strong>Checking with the local agent</strong><p>{waiting >= 8 ? 'The model may be loading. The first check can take longer.' : 'Extracting the transaction and checking the policy database.'}</p></div><span className="duration">{waiting.toFixed(1)}s</span></div>}
              {result && <DecisionCard result={result} onViewPolicy={() => setActiveView('policies')} />}
            </div>
            <div className="flow" aria-label="How the demo works"><span><b>01</b>Local LLM extracts</span><span aria-hidden="true">→</span><span><b>02</b>Policy tool decides</span><span aria-hidden="true">→</span><span><b>03</b>OpenTelemetry records</span></div>
            <p className="policy-note">Illustrative AML policies for this demo. A cleared result means no configured threshold was triggered.</p>
          </> : activeView === 'policies' ? <PolicyView decision={result?.decision} />
            : activeView === 'api' ? <ApiView query={query.trim()} exchange={exchange} /> : <>
            <div className="page-header"><p className="eyebrow">This browser session</p><h1>Session history</h1><p>Queries, verified verdicts, and their traces. Refreshing the page clears this history.</p></div>
            {history.length === 0 ? <div className="empty-state"><span aria-hidden="true">≡</span><h2>No checks yet</h2><p>Run a transaction check to start your session history.</p><button className="button secondary" onClick={() => setActiveView('check')}>Go to transaction check</button></div> : <div className="history-list">{history.slice().reverse().map(entry => <section key={entry.id}><p className="history-time">{entry.time}</p><DecisionCard result={entry.result} query={entry.query} compact /></section>)}</div>}
          </>}
        </main>
      </div>
    </>
  )
}
