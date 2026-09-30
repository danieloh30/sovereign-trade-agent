import { useEffect, useRef, useState } from 'react'
import { VERDICTS } from './verdicts'

export const REVIEW_STATUSES = {
  PENDING: 'Awaiting human review', APPROVED: 'Approved by human', DECLINED: 'Declined by human',
}
const validReview = review => Number.isFinite(review?.id) && REVIEW_STATUSES[review.status]
  && typeof review.query === 'string' && review.decision?.verdict === 'REJECTED'
  && Number.isFinite(review.decision.ruleId)

const EXAMPLE_NOTES = {
  approval: 'Supplier identity and invoice verified. Payment purpose confirmed; approved after manual review.',
  decline: 'Supplier identity could not be verified and supporting documents are missing. Declined pending further evidence.',
}

async function readResponse(response) {
  const data = await response.json()
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'The review service is unavailable. Please retry.')
  return data
}

function ReviewForm({ review, onDecided }) {
  const [reviewer, setReviewer] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef(null)
  useEffect(() => () => controller.current?.abort(), [])

  async function submit(outcome) {
    if (controller.current || !reviewer.trim() || !note.trim()) return
    const request = new AbortController()
    controller.current = request
    setBusy(true)
    setError('')
    const timeout = setTimeout(() => request.abort(), 10000)
    try {
      const data = await readResponse(await fetch(`/trade/reviews/${review.id}/decision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ outcome, reviewer: reviewer.trim(), note: note.trim() }), signal: request.signal,
      }))
      if (!validReview(data) || data.id !== review.id || data.status !== outcome) throw new Error('Could not verify the recorded decision. Refresh reviews to check its status.')
      onDecided(data)
    } catch (failure) {
      setError(failure.name === 'AbortError'
        ? 'The request timed out. Refresh reviews to check whether your decision was recorded before retrying.'
        : failure instanceof TypeError || failure instanceof SyntaxError
          ? 'Could not record your decision. Refresh reviews to check its status, then retry.' : failure.message)
    } finally {
      clearTimeout(timeout)
      controller.current = null
      setBusy(false)
    }
  }

  return <form className="review-form" aria-label="Human decision" onSubmit={event => event.preventDefault()}>
    <h3>Your decision</h3>
    <label htmlFor={`reviewer-${review.id}`}>Reviewer name</label>
    <input id={`reviewer-${review.id}`} value={reviewer} onChange={event => setReviewer(event.target.value)} maxLength={80} required disabled={busy} autoComplete="name" />
    <label htmlFor={`note-${review.id}`}>Review note</label>
    <textarea id={`note-${review.id}`} value={note} onChange={event => setNote(event.target.value)} maxLength={1000} required disabled={busy} rows={3} placeholder="Explain why you approve or decline this case…" />
    <div className="review-examples" aria-label="Example choices">
      <p className="review-hint">Example notes for the demo. Choose one and edit it to match your review.</p>
      <div className="review-example-options">
        <div><button type="button" className="text-button" disabled={busy} onClick={() => setNote(EXAMPLE_NOTES.approval)}>Use approval example</button><p>{EXAMPLE_NOTES.approval}</p></div>
        <div><button type="button" className="text-button" disabled={busy} onClick={() => setNote(EXAMPLE_NOTES.decline)}>Use decline example</button><p>{EXAMPLE_NOTES.decline}</p></div>
      </div>
    </div>
    <p className="review-hint">Your name and note are recorded with this decision. No payment will be executed.</p>
    <div className="review-actions"><button type="button" className="button secondary" disabled={busy || !reviewer.trim() || !note.trim()} onClick={() => submit('DECLINED')}>Decline review</button><button type="button" className="button primary" disabled={busy || !reviewer.trim() || !note.trim()} onClick={() => submit('APPROVED')}>{busy ? 'Recording…' : 'Approve review'}</button></div>
    <div aria-live="polite">{error && <p className="review-error" role="alert">{error}</p>}</div>
  </form>
}

export default function ReviewInbox({ requestedId, onRecords, onBack, traceLink }) {
  const [requests, setRequests] = useState(null)
  const [selectedId, setSelectedId] = useState(requestedId)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    let active = true
    setRequests(null)
    setError('')
    async function load() {
      try {
        let data = await readResponse(await fetch('/trade/reviews', { headers: { Accept: 'application/json' }, signal: controller.signal }))
        if (!Array.isArray(data) || data.some(review => !validReview(review))) throw new Error('Invalid reviews')
        if (requestedId != null && !data.some(review => review.id === requestedId)) {
          const requested = await readResponse(await fetch(`/trade/reviews/${requestedId}`, { headers: { Accept: 'application/json' }, signal: controller.signal }))
          if (!validReview(requested) || requested.id !== requestedId) throw new Error('Invalid review')
          data = [requested, ...data]
        }
        if (!active) return
        setRequests(data)
        setSelectedId(current => requestedId ?? (data.some(review => review.id === current) ? current : data.find(review => review.status === 'PENDING')?.id ?? data[0]?.id))
        onRecords(data)
      } catch {
        if (active) setError('Could not load the review requests. Check the app and PostgreSQL, then refresh.')
      } finally {
        clearTimeout(timeout)
      }
    }
    load()
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [requestedId, refresh, onRecords])

  function decided(review) {
    setRequests(previous => previous.map(item => item.id === review.id ? review : item))
    onRecords([review])
  }
  const selected = requests?.find(review => review.id === selectedId)
  return <>
    <div className="page-header"><p className="eyebrow">Human in the loop</p><h1>Human review</h1><p>A person resolves cases flagged by a matched manual-review policy.</p></div>
    <div className="review-toolbar"><p>Reviews are stored in the local database.</p><button className="button secondary" disabled={requests === null && !error} onClick={() => setRefresh(value => value + 1)}>Refresh reviews</button></div>
    <div aria-live="polite">{error && <p className="message-card" role="alert">{error}</p>}{requests === null && !error && <p className="message-card" role="status">Loading human reviews…</p>}</div>
    {requests?.length === 0 && <div className="empty-state"><h2>No review requests yet</h2><p>Run a high-value GBP analysis to create a request for human review.</p><button className="button secondary" onClick={onBack}>Go to transaction check</button></div>}
    {requests?.length > 0 && <div className="review-layout">
      <div className="review-list" aria-label="Review requests">{requests.map(review => <button key={review.id} className={`review-item ${selectedId === review.id ? 'selected' : ''}`} onClick={() => setSelectedId(review.id)} aria-pressed={selectedId === review.id}>
        <span className="review-item-title">Review #{review.id}</span><span>{new Intl.NumberFormat('en-GB').format(review.decision.amount)} {review.decision.currency}</span><span className={`review-status ${review.status.toLowerCase()}`}>{REVIEW_STATUSES[review.status]}</span>
      </button>)}</div>
      {selected && <article className="review-detail" aria-label="Review details">
        <div className="review-detail-heading"><h2>Review #{selected.id}</h2><span className={`review-status ${selected.status.toLowerCase()}`}>{REVIEW_STATUSES[selected.status]}</span></div>
        <p className="review-date">Requested {new Date(selected.createdAt).toLocaleString()}</p>
        <p className="review-query">{selected.query}</p>
        <div className="review-evidence"><h3>Original policy assessment</h3><p><strong>{VERDICTS[selected.decision.verdict].label}</strong> · Rule {selected.decision.ruleId} · ≥ {new Intl.NumberFormat('en-GB').format(selected.decision.threshold)} {selected.decision.currency}</p><p>{selected.decision.message}</p>
          {selected.analysisTraceId && <a href={traceLink(selected.analysisTraceId)} target="_blank" rel="noopener noreferrer">View analysis trace ↗</a>}
        </div>
        {selected.status === 'PENDING' ? <ReviewForm key={selected.id} review={selected} onDecided={decided} /> : <div className="review-resolution" aria-label="Recorded human decision"><h3>{REVIEW_STATUSES[selected.status]}</h3><p>Reviewed by <strong>{selected.reviewer}</strong> · {new Date(selected.reviewedAt).toLocaleString()}</p><p className="review-note">{selected.note}</p>{selected.reviewTraceId && <a href={traceLink(selected.reviewTraceId)} target="_blank" rel="noopener noreferrer">View review trace ↗</a>}<p className="review-hint">The original policy assessment is preserved. No payment was executed.</p></div>}
      </article>}
    </div>}
  </>
}
