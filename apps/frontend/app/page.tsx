'use client';

import { useState } from 'react';

interface Issue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
}

interface PageResult {
  url: string;
  title: string;
  screenshotPath: string;
  issues: Issue[];
}

interface CrawlResult {
  pages: PageResult[];
}

type Status = 'idle' | 'loading' | 'success' | 'error';

const severityColor: Record<Issue['severity'], { bg: string; text: string }> = {
  high:   { bg: '#fee2e2', text: '#b91c1c' },
  medium: { bg: '#fff7ed', text: '#c2410c' },
  low:    { bg: '#f0fdf4', text: '#166534' },
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleScan() {
    if (!url.trim()) return;

    setStatus('loading');
    setResult(null);
    setErrorMsg('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }

      const data: CrawlResult = await res.json();
      setResult(data);
      setStatus('success');
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Unknown error');
      setStatus('error');
    }
  }

  return (
    <main style={styles.main}>
      <h1 style={styles.heading}>UI QA Scanner</h1>
      <p style={styles.sub}>Enter a URL to crawl and detect UI issues</p>

      <div style={styles.inputRow}>
        <input
          style={styles.input}
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleScan()}
          disabled={status === 'loading'}
        />
        <button
          style={{
            ...styles.button,
            opacity: status === 'loading' ? 0.6 : 1,
            cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          }}
          onClick={handleScan}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Scanning...' : 'Scan Website'}
        </button>
      </div>

      {status === 'loading' && (
        <p style={styles.info}>Crawling pages — this may take up to 45s...</p>
      )}

      {status === 'error' && (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {status === 'success' && result && (
        <div style={styles.results}>
          <h2 style={styles.resultsHeading}>
            Crawled {result.pages.length} page{result.pages.length !== 1 ? 's' : ''}
          </h2>
          {result.pages.map((page, i) => (
            <div key={i} style={styles.card}>
              {/* Header */}
              <div style={styles.cardHeader}>
                <span style={styles.badge}>{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.pageTitle}>{page.title || '(no title)'}</div>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.pageUrl}
                  >
                    {page.url}
                  </a>
                </div>
              </div>

              {/* Issue count chip */}
              <div style={styles.chips}>
                <Chip
                  label={`${page.issues.length} issue${page.issues.length !== 1 ? 's' : ''}`}
                  color={page.issues.length === 0 ? 'green' : 'default'}
                />
                <Chip
                  label={`screenshot: ${page.screenshotPath.split('/').pop()}`}
                  color="default"
                />
              </div>

              {/* Issues list */}
              {page.issues.length > 0 ? (
                <div style={styles.issueList}>
                  {page.issues.map((issue, j) => (
                    <div key={j} style={{ ...styles.issueItem, backgroundColor: severityColor[issue.severity].bg }}>
                      <div style={styles.issueHeader}>
                        <span style={{ ...styles.severityBadge, color: severityColor[issue.severity].text }}>
                          {issue.severity.toUpperCase()}
                        </span>
                        <span style={styles.issueType}>{issue.type}</span>
                      </div>
                      <div style={styles.issueDesc}>{issue.description}</div>
                      {issue.suggestion && (
                        <div style={styles.issueSuggestion}>Suggestion: {issue.suggestion}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={styles.noIssues}>No issues detected.</p>
              )}

              {/* Raw JSON */}
              <details style={styles.details}>
                <summary style={styles.summary}>View raw JSON</summary>
                <pre style={styles.pre}>{JSON.stringify(page, null, 2)}</pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Chip({ label, color = 'default' }: { label: string; color?: 'default' | 'red' | 'orange' | 'green' }) {
  const bg =
    color === 'red' ? '#fee2e2' :
    color === 'orange' ? '#fff7ed' :
    color === 'green' ? '#f0fdf4' :
    '#f1f5f9';
  const text =
    color === 'red' ? '#b91c1c' :
    color === 'orange' ? '#c2410c' :
    color === 'green' ? '#166534' :
    '#475569';
  return (
    <span style={{ ...chipStyle, backgroundColor: bg, color: text }}>{label}</span>
  );
}

const chipStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 99,
  fontSize: 12,
  fontWeight: 500,
};

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 740,
    margin: '0 auto',
    padding: '48px 24px',
    fontFamily: 'system-ui, sans-serif',
    color: '#111',
  },
  heading: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
  },
  sub: {
    color: '#555',
    marginTop: 8,
    marginBottom: 28,
  },
  inputRow: {
    display: 'flex',
    gap: 10,
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    fontSize: 15,
    border: '1px solid #ccc',
    borderRadius: 6,
    outline: 'none',
  },
  button: {
    padding: '10px 20px',
    fontSize: 15,
    fontWeight: 600,
    backgroundColor: '#0070f3',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    whiteSpace: 'nowrap',
  },
  info: {
    marginTop: 18,
    color: '#555',
    fontSize: 14,
  },
  errorBox: {
    marginTop: 18,
    padding: '12px 16px',
    backgroundColor: '#fff0f0',
    border: '1px solid #fca5a5',
    borderRadius: 6,
    color: '#b91c1c',
    fontSize: 14,
  },
  results: {
    marginTop: 28,
  },
  resultsHeading: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 14,
  },
  card: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '16px 20px',
    marginBottom: 14,
    backgroundColor: '#fafafa',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 10,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    backgroundColor: '#0070f3',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  pageTitle: {
    fontWeight: 600,
    fontSize: 15,
  },
  pageUrl: {
    fontSize: 13,
    color: '#0070f3',
    wordBreak: 'break-all',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  issueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 12,
  },
  issueItem: {
    padding: '10px 14px',
    borderRadius: 6,
  },
  issueHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  severityBadge: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
  },
  issueType: {
    fontSize: 13,
    fontWeight: 600,
    color: '#111',
  },
  issueDesc: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
  },
  issueSuggestion: {
    fontSize: 12,
    color: '#555',
    fontStyle: 'italic',
  },
  noIssues: {
    fontSize: 13,
    color: '#555',
    marginBottom: 12,
  },
  details: {
    marginTop: 6,
  },
  summary: {
    fontSize: 13,
    cursor: 'pointer',
    color: '#444',
    userSelect: 'none',
  },
  pre: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    fontSize: 12,
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
};
