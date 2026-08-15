import { useState, useEffect, useRef } from 'react'
import './App.css'

const SCENARIOS = [
  {
    label: 'High-value GBP',
    tag: 'reject',
    query: "I have a customer, 'London Tech Ltd', trying to move £12,500 to a new vendor in Estonia for 'Cloud Services'. Before I approve this, check our local AML rules.",
  },
  {
    label: 'Standard GBP',
    tag: 'clear',
    query: "Please verify a £3,200 GBP payment from 'Baker Street Consulting' to a domestic supplier for office furniture.",
  },
  {
    label: 'Mid-range GBP',
    tag: 'warning',
    query: "A customer wants to send £7,500 GBP to a consulting firm in Dublin. Check if this triggers any AML rules.",
  },
  {
    label: 'EUR Transfer',
    tag: 'clear',
    query: "Check AML compliance for a €9,000 EUR wire transfer from our Paris branch to a Frankfurt-based logistics company.",
  },
]

function getVerdict(text) {
  const upper = text.toUpperCase()
  if (upper.startsWith('ERROR') || upper.includes('ERROR:'))
    return { type: 'error', label: 'Error', icon: '✖' }
  if (upper.includes('REJECTED'))
    return { type: 'rejected', label: 'Rejected', icon: '✖' }
  if (upper.includes('WARNING'))
    return { type: 'warning', label: 'Warning', icon: '⚠' }
  if (upper.includes('CLEARED'))
    return { type: 'cleared', label: 'Cleared', icon: '✔' }
  return { type: 'unknown', label: 'Response', icon: 'ℹ' }
}

function useTypingEffect(text, speed = 18) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const idx = useRef(0)

  useEffect(() => {
    if (!text) {
      setDisplayed('')
      setDone(false)
      idx.current = 0
      return
    }
    setDisplayed('')
    setDone(false)
    idx.current = 0

    const interval = setInterval(() => {
      idx.current++
      setDisplayed(text.slice(0, idx.current))
      if (idx.current >= text.length) {
        setDone(true)
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return { displayed, done }
}

function App() {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeScenario, setActiveScenario] = useState(null)
  const [elapsed, setElapsed] = useState(null)
  const { displayed, done } = useTypingEffect(response)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResponse('')
    setElapsed(null)
    const start = Date.now()

    try {
      const res = await fetch('/trade/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: query,
      })

      const data = await res.text()
      setElapsed(((Date.now() - start) / 1000).toFixed(1))
      if (!res.ok) {
        setResponse('Error: ' + data)
      } else {
        setResponse(data)
      }
    } catch (error) {
      setElapsed(((Date.now() - start) / 1000).toFixed(1))
      setResponse('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadScenario = (idx) => {
    setActiveScenario(idx)
    setQuery(SCENARIOS[idx].query)
    setResponse('')
    setElapsed(null)
  }

  const handleClear = () => {
    setQuery('')
    setResponse('')
    setActiveScenario(null)
    setElapsed(null)
  }

  const verdict = response ? getVerdict(response) : null

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">S</div>
          <span className="topbar-title">Sovereign Trade Agent</span>
        </div>
        <div className="topbar-right">
          <span className="topbar-badge">FCA Compliance</span>
          <div className="topbar-env">
            <span className="env-dot"></span>
            <span>System Online</span>
          </div>
        </div>
      </div>

      <div className="main-layout">
        <div className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section-title">Operations</div>
            <div className="sidebar-item active">
              <span className="sidebar-icon">{'▶'}</span>
              <span>Transaction Check</span>
            </div>
            <a className="sidebar-item" href="/q/dev-ui/io.quarkus.quarkus-opentelemetry" target="_blank" rel="noopener">
              <span className="sidebar-icon">{'☰'}</span>
              <span>Audit Log</span>
            </a>
            <a className="sidebar-item" href="/q/dev-ui/io.quarkiverse.langchain4j.quarkus-langchain4j-agentic" target="_blank" rel="noopener">
              <span className="sidebar-icon">{'⚑'}</span>
              <span>Agent Monitor</span>
            </a>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-section-title">Data Sources</div>
            <a className="sidebar-item" href="/q/dev-ui/io.quarkus.quarkus-datasources" target="_blank" rel="noopener">
              <span className="sidebar-icon">{'☷'}</span>
              <span>Regulatory DB</span>
            </a>
            <a className="sidebar-item" href="/q/dev-ui/io.quarkus.quarkus-smallrye-openapi" target="_blank" rel="noopener">
              <span className="sidebar-icon">{'☖'}</span>
              <span>API Endpoints</span>
            </a>
          </div>
          <div className="sidebar-spacer"></div>
          <div className="sidebar-footer">
            <a className="sidebar-footer-item" href="/q/dev-ui/" target="_blank" rel="noopener">
              <span className="sidebar-icon">{'⚙'}</span>
              <span>Dev Console</span>
            </a>
          </div>
        </div>

        <div className="content">
          <div className="page-header">
            <h1>Transaction Compliance Check</h1>
            <p>Verify transactions against FCA anti-money laundering rules using a sovereign AI agent</p>
          </div>

          <div className="scenarios">
            {SCENARIOS.map((s, i) => (
              <button
                key={i}
                className={`scenario-btn${activeScenario === i ? ' active' : ''}`}
                onClick={() => loadScenario(i)}
              >
                <span className={`scenario-tag ${s.tag}`}>
                  {s.tag === 'reject' ? 'REJECT' : s.tag === 'warning' ? 'WARN' : 'CLEAR'}
                </span>
                {s.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-card">
              <label className="form-label" htmlFor="query">Transaction Query</label>
              <textarea
                id="query"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveScenario(null); }}
                placeholder="Describe the transaction you want to verify..."
                rows="4"
                required
              />
              <div className="form-actions">
                <button type="button" onClick={handleClear} className="btn-clear">Clear</button>
                <button type="submit" disabled={loading} className="btn-submit">
                  {loading && <span className="spinner"></span>}
                  {loading ? 'Analyzing...' : 'Run Analysis'}
                </button>
              </div>
            </div>
          </form>

          {(response || loading) && (
            <div className="response-card">
              <div className="response-header">
                {verdict ? (
                  <>
                    <div className={`response-verdict-icon ${verdict.type}`}>{verdict.icon}</div>
                    <span className={`response-verdict-text ${verdict.type}`}>{verdict.label}</span>
                  </>
                ) : (
                  <>
                    <div className="response-verdict-icon unknown">
                      <span className="spinner" style={{ borderColor: 'rgba(59,130,246,0.3)', borderTopColor: '#3b82f6', width: 16, height: 16 }}></span>
                    </div>
                    <span className="response-verdict-text unknown">Processing...</span>
                  </>
                )}
              </div>
              <div className="response-body">
                <span className="response-text">{displayed}</span>
                {!done && response && <span className="response-cursor"></span>}
              </div>
              {elapsed && done && (
                <div className="response-meta">
                  <span className="meta-item">{'⏱'} {elapsed}s</span>
                  <span className="meta-item">{'☷'} Local LLM</span>
                  <span className="meta-item">{'☑'} Sovereign Processing</span>
                </div>
              )}
            </div>
          )}

          <div className="info-bar">
            <div className="info-chip">
              <span className="info-chip-dot blue"></span>
              Regional LLM (Ollama)
            </div>
            <div className="info-chip">
              <span className="info-chip-dot green"></span>
              Regulatory DB (PostgreSQL)
            </div>
            <div className="info-chip">
              <span className="info-chip-dot amber"></span>
              Enterprise ERP
            </div>
            <div className="info-chip">
              <span className="info-chip-dot purple"></span>
              OpenTelemetry
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
