import React, { useState, useEffect } from 'react'
import axios from 'axios'

// AI Business Autopilot - Single-file React Dashboard
// All styles are JS objects. No external UI libs. Uses hooks only.

// ---------- Styles (JS objects) ----------
const COLORS = {
  bg: '#ffffff',
  primary: '#2563eb',
  surface: '#f8fafc',
  heading: '#0f172a',
  secondary: '#64748b',
}

const layout = {
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
  display: 'flex',
  minHeight: '100vh',
  background: COLORS.bg,
  color: COLORS.heading,
}

const sidebarStyle = {
  width: 240,
  background: COLORS.surface,
  padding: 24,
  boxSizing: 'border-box',
  borderRight: '1px solid rgba(15,23,42,0.04)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
}

const navItem = (active) => ({
  padding: '10px 12px',
  borderRadius: 8,
  color: active ? COLORS.primary : COLORS.heading,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  cursor: 'pointer',
  background: active ? 'rgba(37,99,235,0.06)' : 'transparent',
})

const mainStyle = {
  flex: 1,
  padding: 28,
  boxSizing: 'border-box',
}

const card = {
  background: COLORS.surface,
  padding: 18,
  borderRadius: 12,
  boxShadow: '0 6px 18px rgba(2,6,23,0.04)',
}

const metricCardStyle = {
  ...card,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
}

const badgeStyle = (source) => ({
  padding: '6px 10px',
  borderRadius: 999,
  background: source === 'Telegram' ? COLORS.primary : '#10b981',
  color: '#fff',
  fontSize: 12,
})

const smallMuted = { color: COLORS.secondary, fontSize: 13 }

// transform must stay 'none'. Any other value (even translateY(0)) makes this
// wrapper a containing block for position:fixed descendants, which orphans the
// Settings Save button and the toast — on the only page that writes data.
const transitionIn = { opacity: 1, transform: 'none', transition: 'all 260ms ease' }

// Inject spinner keyframes
const SpinnerStyles = () => (
  <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
)

// ---------- Helper Components ----------
function LoadingSpinner({ size = 28 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <SpinnerStyles />
      <div style={{ width: size, height: size, border: '3px solid rgba(15,23,42,0.08)', borderTop: `3px solid ${COLORS.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <div style={{ color: '#ef4444', marginBottom: 12 }}>{message}</div>
      <button onClick={onRetry} style={{ padding: '8px 12px', borderRadius: 8, background: COLORS.primary, color: '#fff', border: 'none', cursor: 'pointer' }}>Retry</button>
    </div>
  )
}

// ---------- Sidebar ----------
function Sidebar({ active, setActive, business }) {
  return (
    <aside style={sidebarStyle}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>AI</div>
          <div>
            <div style={{ fontWeight: 700 }}>AI Business Autopilot</div>
            <div style={{ color: COLORS.secondary, fontSize: 12 }}>Automate customer communication</div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['Dashboard', 'Leads', 'Conversations', 'Channels', 'Settings'].map((item) => (
            <div key={item} onClick={() => setActive(item)} style={navItem(active === item)}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: active === item ? COLORS.primary : 'transparent' }} />
              <div style={{ fontWeight: 600 }}>{item}</div>
            </div>
          ))}
        </nav>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ ...smallMuted }}>Business</div>
        <div style={{ fontWeight: 700 }}>{business?.name || 'Your Business'}</div>
        <div style={{ ...smallMuted, marginTop: 6 }}>{business?.timezone || 'Local Time'}</div>
      </div>
    </aside>
  )
}

// ---------- Top Bar ----------
function TopBar({ greeting }) {
  const today = new Date().toLocaleDateString()
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{greeting}</div>
        <div style={{ ...smallMuted }}>{today}</div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ ...card, padding: '8px 12px', borderRadius: 999, fontSize: 13 }}>Upgrade</div>
      </div>
    </div>
  )
}

// ---------- Metric Card ----------
function MetricCard({ title, value, change, icon }) {
  return (
    <div style={metricCardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
        <div style={{ color: COLORS.primary }}>{icon}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: COLORS.secondary }}>{title}</div>
        {change === null || change === undefined ? null : (
          <div style={{ color: change >= 0 ? '#10b981' : '#ef4444', fontSize: 13 }}>{change >= 0 ? `+${change}%` : `${change}%`}</div>
        )}
      </div>
    </div>
  )
}

// ---------- Dashboard Page ----------
function DashboardPage({ leads, loading, error, onRetry }) {
  // Derived from the leads actually returned by the API. These were previously
  // hardcoded (leads.length + 120, 48, 312, 76) with invented deltas, so the
  // dashboard reported activity the business had never had. No historical
  // baseline is stored yet, so no percentage change is shown rather than a
  // fabricated one.
  const metrics = [
    { title: 'Total Leads', value: leads.length, icon: '⬆' },
    { title: 'Conversations Today', value: '—', icon: '💬' },
    { title: 'Telegram Leads', value: leads.filter((l) => l.source === 'Telegram').length, icon: '📨' },
    { title: 'Web Widget Leads', value: leads.filter((l) => l.source === 'Web').length, icon: '🧩' },
  ]

  return (
    <div>
      <TopBar greeting="Good morning, Business Owner" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        {metrics.map((m) => (
          <MetricCard key={m.title} title={m.title} value={m.value} change={m.change} icon={m.icon} />
        ))}
      </div>

      <div style={{ ...card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Recent Leads</div>
          <div style={{ ...smallMuted }}>Showing latest</div>
        </div>

        {loading ? <LoadingSpinner /> : error ? <ErrorState message={error} onRetry={onRetry} /> : leads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 36 }}>
            <div style={{ fontSize: 48, color: '#e6eefc', marginBottom: 12 }}>🤝</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>No leads yet.</div>
            <div style={{ ...smallMuted }}>Share your bot link to get started.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ textAlign: 'left', color: COLORS.secondary }}>
                  <th style={{ padding: '12px 8px' }}>Customer</th>
                  <th style={{ padding: '12px 8px' }}>Query</th>
                  <th style={{ padding: '12px 8px' }}>Source</th>
                  <th style={{ padding: '12px 8px' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 6).map((l) => (
                  <tr key={l.id} style={{ borderTop: '1px solid rgba(15,23,42,0.04)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ fontWeight: 700 }}>{l.customer}</div>
                      <div style={{ ...smallMuted }}>{l.phone}</div>
                    </td>
                    <td style={{ padding: '12px 8px' }}>{l.query}</td>
                    <td style={{ padding: '12px 8px' }}><span style={badgeStyle(l.source)}>{l.source}</span></td>
                    <td style={{ padding: '12px 8px', ...smallMuted }}>{l.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Leads Page ----------
function LeadsPage({ leads }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 8

  const filtered = leads.filter((l) => (
    l.customer.toLowerCase().includes(query.toLowerCase()) || l.query.toLowerCase().includes(query.toLowerCase()) || (l.phone || '').includes(query)
  ))

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageSlice = filtered.slice((page - 1) * perPage, page * perPage)

  useEffect(() => { setPage(1) }, [query])

  return (
    <div>
      <TopBar greeting="Leads" />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search leads by name, query or phone" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(15,23,42,0.06)', width: 520 }} />
        <div style={{ ...smallMuted }}>{filtered.length} results</div>
      </div>

      <div style={{ ...card }}>
        <table style={tableStyle}>
          <thead>
            <tr style={{ textAlign: 'left', color: COLORS.secondary }}>
              <th style={{ padding: '12px 8px' }}>Customer Name</th>
              <th style={{ padding: '12px 8px' }}>Phone</th>
              <th style={{ padding: '12px 8px' }}>Query</th>
              <th style={{ padding: '12px 8px' }}>Channel</th>
              <th style={{ padding: '12px 8px' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {pageSlice.map((l) => (
              <tr key={l.id} style={{ borderTop: '1px solid rgba(15,23,42,0.04)', transition: 'background 160ms', cursor: 'default' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(2,6,23,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ padding: '12px 8px', fontWeight: 700 }}>{l.customer}</td>
                <td style={{ padding: '12px 8px' }}>{l.phone}</td>
                <td style={{ padding: '12px 8px' }}>{l.query}</td>
                <td style={{ padding: '12px 8px' }}><span style={badgeStyle(l.source)}>{l.source}</span></td>
                <td style={{ padding: '12px 8px', ...smallMuted }}>{l.time}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <div style={{ ...smallMuted }}>Page {page} of {totalPages}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPage(p => Math.max(1, p-1))} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', background: '#fff' }}>Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', background: '#fff' }}>Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Conversations Page ----------
function ConversationsPage() {
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loadingConversations, setLoadingConversations] = useState(true)

  useEffect(() => {
    const fetchConversations = async () => {
      setLoadingConversations(true)
      try {
        const res = await axios.get('https://ai-autopilot-backend-togt.onrender.com/conversations')
        const data = res.data?.conversations || []
        setConversations(data)
        setSelectedId((currentSelectedId) => currentSelectedId || data[0]?.id || null)
      } catch (err) {
        console.log('Conversations fetch error:', err)
        setConversations([])
      } finally {
        setLoadingConversations(false)
      }
    }

    fetchConversations()
  }, [])

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId) || null

  const formatConversationTime = (createdAt) => {
    if (!createdAt) return 'just now'
    const date = new Date(createdAt)
    if (Number.isNaN(date.getTime())) return 'just now'
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  const previewText = (message) => {
    if (!message) return ''
    return message.length > 64 ? `${message.slice(0, 64)}...` : message
  }

  return (
    <div>
      <TopBar greeting="Conversations" />

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
        <div style={{ ...card, maxHeight: '70vh', overflowY: 'auto' }}>
          {loadingConversations ? (
            <LoadingSpinner />
          ) : conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 36 }}>
              <div style={{ fontSize: 48, color: '#e6eefc', marginBottom: 12 }}>💬</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>No conversations yet.</div>
              <div style={{ ...smallMuted }}>New customer chats will appear here once they arrive.</div>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setSelectedId(conversation.id)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 8,
                  cursor: 'pointer',
                  background: selectedId === conversation.id ? 'rgba(37,99,235,0.04)' : 'transparent',
                  border: selectedId === conversation.id ? '1px solid rgba(37,99,235,0.10)' : '1px solid transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conversation.customer_id}</div>
                  <div style={{ ...smallMuted, whiteSpace: 'nowrap' }}>{formatConversationTime(conversation.created_at)}</div>
                </div>
                <div style={{ ...smallMuted, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewText(conversation.message)}</div>
              </div>
            ))
          )}
        </div>

        <div style={{ ...card, maxHeight: '70vh', overflowY: 'auto' }}>
          {loadingConversations ? (
            <LoadingSpinner />
          ) : !selectedConversation ? (
            <div style={{ ...smallMuted }}>Select a conversation to view messages</div>
          ) : (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{selectedConversation.customer_id}</div>
              <div style={{ ...smallMuted, marginBottom: 14 }}>
                {selectedConversation.source || 'web'} · {formatConversationTime(selectedConversation.created_at)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ background: 'rgba(15,23,42,0.05)', color: COLORS.heading, padding: '12px 14px', borderRadius: '16px 16px 16px 4px', maxWidth: '72%', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {selectedConversation.message}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ background: COLORS.primary, color: '#fff', padding: '12px 14px', borderRadius: '16px 16px 4px 16px', maxWidth: '72%', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {selectedConversation.reply}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Channels Page ----------
function ChannelsPage() {
  const botLink = 'https://t.me/your_bot'
  const widgetScript = `<script src="https://yourdomain.com/widget.js"></script>`

  const copy = async (txt) => { await navigator.clipboard.writeText(txt) }

  return (
    <div>
      <TopBar greeting="Channels" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Telegram</div>
          <div style={{ ...smallMuted, marginBottom: 8 }}>Status: <span style={{ color: COLORS.primary, fontWeight: 700 }}>Active</span></div>
          <div style={{ marginBottom: 8 }}>@your_bot</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={botLink} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)' }} />
            <button onClick={() => copy(botLink)} style={{ padding: '8px 12px', borderRadius: 8, background: COLORS.primary, color: '#fff', border: 'none' }}>Copy</button>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Web Widget</div>
          <div style={{ ...smallMuted, marginBottom: 8 }}>Status: <span style={{ color: COLORS.primary, fontWeight: 700 }}>Active</span></div>
          <div style={{ marginBottom: 8, fontSize: 13 }}>Embed script</div>
          <pre style={{ background: '#0f172a', color: '#e6eefc', padding: 12, borderRadius: 8, overflowX: 'auto' }}>{widgetScript}</pre>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => copy(widgetScript)} style={{ padding: '8px 12px', borderRadius: 8, background: COLORS.primary, color: '#fff', border: 'none' }}>Copy</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Settings Page ----------
function SettingsPage({ business, setBusiness }) {
  const BUSINESS_ID = '967c5b1f-1376-4272-8be3-af82f65128db'
  const [form, setForm] = useState({
    name: '', category: 'Salon', address: '', contact_number: '', services: '', pricing: '', timings: '', faqs: '', appointment_required: false, walkins_welcome: false, booking_instructions: '', special_notes: '', telegram_chat_id: ''
  })
  const [loadingBiz, setLoadingBiz] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  // If the profile never loaded, `form` still holds its blank initial state.
  // Saving that would PUT empty strings over the live profile — and the backend
  // accepts empty strings — silently wiping the data that feeds the AI's system
  // prompt. There is no backup, so the save is blocked rather than warned about.
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoadingBiz(true)
      try {
        const res = await axios.get(`https://ai-autopilot-backend-togt.onrender.com/business/${BUSINESS_ID}`)
        const b = res.data && res.data.business ? res.data.business : {}
        setForm(prev => ({ ...prev,
          name: b.name || '', category: b.category || 'Salon', address: b.address || '', contact_number: b.contact_number || '', services: b.services || '', pricing: b.pricing || '', timings: b.timings || '', faqs: b.faqs || '', appointment_required: !!b.appointment_required, walkins_welcome: !!b.walkins_welcome, booking_instructions: b.booking_instructions || '', special_notes: b.special_notes || '', telegram_chat_id: b.telegram_chat_id || ''
        }))
        setBusiness(b)
        setLoadFailed(false)
      } catch (err) {
        setLoadFailed(true)
        setToast({ type: 'error', message: 'Failed to load business — saving is disabled to protect your profile' })
      } finally { setLoadingBiz(false) }
    }
    load()
  }, [setBusiness])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const save = async () => {
    if (loadFailed) {
      setToast({ type: 'error', message: 'Cannot save: your profile never loaded. Reload the page first.' })
      return
    }
    setSaving(true)
    try {
      await axios.put(`https://ai-autopilot-backend-togt.onrender.com/business/${BUSINESS_ID}`, form)
      setToast({ type: 'success', message: 'Settings saved' })
      setBusiness({ ...business, ...form })
    } catch (err) {
      setToast({ type: 'error', message: 'Save failed' })
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'relative' }}>
      <TopBar greeting="Settings" />

      <div style={{ display: 'grid', gap: 18 }}>
        <section style={{ ...card }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Business Profile</div>
          <div style={{ height: 1, background: 'rgba(15,23,42,0.04)', margin: '8px 0 16px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Business Name</label>
              <input value={form.name} onChange={e=>handleChange('name', e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', width: '100%' }} />
            </div>

            <div>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Category</label>
              <select value={form.category} onChange={e=>handleChange('category', e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', width: '100%' }}>
                {['Salon','Clinic','Restaurant','Gym','Retail Shop','Other'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Address</label>
              <input value={form.address} onChange={e=>handleChange('address', e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', width: '100%' }} />
            </div>

            <div>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Contact Number</label>
              <input value={form.contact_number} onChange={e=>handleChange('contact_number', e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', width: '100%' }} />
            </div>
          </div>
        </section>

        <section style={{ ...card }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Services & Pricing</div>
          <div style={{ height: 1, background: 'rgba(15,23,42,0.04)', margin: '8px 0 16px' }} />

          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Services Offered</label>
              <textarea value={form.services} onChange={e=>handleChange('services', e.target.value)} rows={4} style={{ padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', width: '100%' }} />
            </div>

            <div>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Pricing Details</label>
              <textarea value={form.pricing} onChange={e=>handleChange('pricing', e.target.value)} rows={4} style={{ padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', width: '100%' }} />
            </div>
          </div>
        </section>

        <section style={{ ...card }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Availability & Booking</div>
          <div style={{ height: 1, background: 'rgba(15,23,42,0.04)', margin: '8px 0 16px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Timings</label>
              <input value={form.timings} onChange={e=>handleChange('timings', e.target.value)} placeholder="Mon-Sat 9am-8pm" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', width: '100%' }} />
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Appointment Required</label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={!!form.appointment_required} onChange={e=>handleChange('appointment_required', e.target.checked)} />
                  <span style={{ color: COLORS.secondary }}>Require appointments</span>
                </label>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Walk-ins Welcome</label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={!!form.walkins_welcome} onChange={e=>handleChange('walkins_welcome', e.target.checked)} />
                  <span style={{ color: COLORS.secondary }}>Allow walk-ins</span>
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Booking Instructions</label>
            <textarea value={form.booking_instructions} onChange={e=>handleChange('booking_instructions', e.target.value)} rows={3} style={{ padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', width: '100%' }} />
          </div>
        </section>

        <section style={{ ...card }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Additional Info</div>
          <div style={{ height: 1, background: 'rgba(15,23,42,0.04)', margin: '8px 0 16px' }} />

          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>FAQs</label>
              <textarea value={form.faqs} onChange={e=>handleChange('faqs', e.target.value)} rows={3} style={{ padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', width: '100%' }} />
            </div>

            <div>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Special Notes</label>
              <textarea value={form.special_notes} onChange={e=>handleChange('special_notes', e.target.value)} rows={2} style={{ padding: 12, borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', width: '100%' }} />
            </div>

            <div>
              <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Telegram Chat ID</label>
              <input value={form.telegram_chat_id} onChange={e=>handleChange('telegram_chat_id', e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.06)', width: '100%' }} />
            </div>
          </div>
        </section>
      </div>

      {/* Fixed save button bottom-right */}
      <div style={{ position: 'fixed', right: 28, bottom: 28, display: 'flex', gap: 10, alignItems: 'center' }}>
        {loadingBiz && <div style={{ ...card, padding: 12 }}>Loading...</div>}
        <button onClick={save} disabled={saving || loadFailed} title={loadFailed ? 'Your profile failed to load. Reload the page before saving.' : undefined} style={{ padding: '12px 18px', borderRadius: 10, background: (saving || loadFailed) ? COLORS.secondary : COLORS.primary, color: '#fff', border: 'none', boxShadow: '0 6px 18px rgba(2,6,23,0.08)', cursor: (saving || loadFailed) ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', right: 28, top: 28, padding: '10px 14px', borderRadius: 8, background: toast.type === 'success' ? '#10b981' : '#ef4444', color: '#fff', boxShadow: '0 6px 18px rgba(2,6,23,0.08)' }}>{toast.message}</div>
      )}
    </div>
  )
}

// ---------- Main App ----------
export default function App() {
  const [active, setActive] = useState('Dashboard')
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [business, setBusiness] = useState({ id: '967c5b1f-1376-4272-8be3-af82f65128db', name: 'Loading...' })

  const fetchLeads = async () => {
    setLoading(true); setError(null)
    try {
      const res = await axios.get('https://ai-autopilot-backend-togt.onrender.com/leads')
      const data = res.data?.leads || []
      // An empty result means no leads. Substituting placeholder rows here made
      // the real empty state below unreachable and showed fake customers with
      // dialable phone numbers as if they were real.
      setLeads(data.map((d) => ({ id: d.id, customer: d.customer_name || 'Unknown', query: d.query || '', source: d.source ? d.source.charAt(0).toUpperCase() + d.source.slice(1) : 'Web', time: d.created_at ? new Date(d.created_at).toLocaleString() : 'just now', phone: d.phone || '' })))
    } catch (err) {
      setError('Failed to fetch leads')
      setLeads([])
    } finally { setLoading(false) }
  }

  const fetchBusiness = async () => {
    try {
      const res = await axios.get('https://ai-autopilot-backend-togt.onrender.com/business/967c5b1f-1376-4272-8be3-af82f65128db')
      if (res.data?.business) setBusiness(res.data.business)
    } catch (err) { console.log('Business fetch error:', err) }
  }

  useEffect(() => {
    fetchLeads()
    fetchBusiness()
    const id = setInterval(fetchLeads, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={layout}>
      <Sidebar active={active} setActive={setActive} business={business} />
      <main style={mainStyle}>
        {active === 'Dashboard' && <div style={transitionIn}><DashboardPage leads={leads} loading={loading} error={error} onRetry={fetchLeads} /></div>}
        {active === 'Leads' && <div style={transitionIn}><LeadsPage leads={leads} /></div>}
        {active === 'Conversations' && <div style={transitionIn}><ConversationsPage /></div>}
        {active === 'Channels' && <div style={transitionIn}><ChannelsPage /></div>}
        {active === 'Settings' && <div style={transitionIn}><SettingsPage business={business} setBusiness={setBusiness} /></div>}
      </main>
    </div>
  )
}
