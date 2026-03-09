import { useState } from 'react'
import './App.css'

function App() {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResponse('')

    try {
      const res = await fetch('/trade/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: query,
      })

      const data = await res.text()
      setResponse(data)
    } catch (error) {
      setResponse('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadExample = () => {
    setQuery("I have a customer, 'London Tech Ltd', trying to move £12,500 to a new vendor in Estonia for 'Cloud Services'. Before I approve this, check our local AML rules.")
  }

  return (
    <div className="container">
      <div className="card">
        <h1>🏦 Sovereign Trade Agent</h1>
        <p className="subtitle">AI-powered trade compliance for the London market</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="query">Transaction Query</label>
            <textarea
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe the transaction you want to verify..."
              rows="6"
              required
            />
          </div>

          <div className="button-group">
            <button type="button" onClick={loadExample} className="btn-secondary">
              Load Example
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Analyzing...' : 'Analyze Transaction'}
            </button>
          </div>
        </form>

        {response && (
          <div className="response">
            <h3>Compliance Assessment</h3>
            <p>{response}</p>
          </div>
        )}

        <div className="info">
          <p><strong>Features:</strong></p>
          <ul>
            <li>🤖 Regional LLM (Ollama/KServe)</li>
            <li>🗄️ Local Regulatory Database (PostgreSQL)</li>
            <li>🏢 Enterprise ERP Integration</li>
            <li>📊 OpenTelemetry Observability</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default App

// Made with Bob
