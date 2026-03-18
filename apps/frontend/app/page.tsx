'use client';

import { useState } from 'react';

interface PageElement {
  tag: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  missingAlt: boolean;
}

interface PageResult {
  url: string;
  title: string;
  screenshotPath: string;
  text: string;
  links: string[];
  layout: {
    hasHorizontalScroll: boolean;
    viewport: { width: number; height: number };
    document: { scrollWidth: number; scrollHeight: number };
  };
  elements: PageElement[];
  meta: {
    description: string;
    lang: string;
    canonical: string;
  };
  consoleErrors: string[];
  images: PageImage[];
}

interface CrawlResult {
  pages: PageResult[];
}

type Status = 'idle' | 'loading' | 'success' | 'error';

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
      const res = await fetch('http://localhost:3001/crawl', {
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
      <p style={styles.sub}>Enter a URL to crawl and capture screenshots</p>

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
          {result.pages.map((page, i) => {
            const missingAltCount = page.images.filter((img) => img.missingAlt).length;
            return (
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

                {/* Stat chips */}
                <div style={styles.chips}>
                  <Chip label={`${page.links.length} links`} />
                  <Chip label={`${page.elements.length} elements`} />
                  <Chip label={`${page.images.length} images`} />
                  {missingAltCount > 0 && (
                    <Chip label={`${missingAltCount} missing alt`} color="orange" />
                  )}
                  {page.consoleErrors.length > 0 && (
                    <Chip label={`${page.consoleErrors.length} JS errors`} color="red" />
                  )}
                  {page.layout.hasHorizontalScroll && (
                    <Chip label="horizontal scroll" color="orange" />
                  )}
                </div>

                {/* Layout row */}
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Viewport</span>
                  <span>
                    {page.layout.viewport.width} × {page.layout.viewport.height}px
                  </span>
                  <span style={styles.dot}>·</span>
                  <span style={styles.infoLabel}>Document</span>
                  <span>
                    {page.layout.document.scrollWidth} × {page.layout.document.scrollHeight}px
                  </span>
                </div>

                {/* Meta row */}
                {(page.meta.description || page.meta.lang || page.meta.canonical) && (
                  <div style={styles.infoRow}>
                    {page.meta.lang && (
                      <>
                        <span style={styles.infoLabel}>lang</span>
                        <span>{page.meta.lang}</span>
                        <span style={styles.dot}>·</span>
                      </>
                    )}
                    {page.meta.description && (
                      <>
                        <span style={styles.infoLabel}>description</span>
                        <span style={styles.truncate}>{page.meta.description}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Screenshot */}
                <div style={{ ...styles.infoRow, marginBottom: 10 }}>
                  <span style={styles.infoLabel}>Screenshot</span>
                  <code style={{ fontSize: 12 }}>{page.screenshotPath.split('/').pop()}</code>
                </div>

                {/* Console errors */}
                {page.consoleErrors.length > 0 && (
                  <details style={styles.details}>
                    <summary style={{ ...styles.summary, color: '#b91c1c' }}>
                      {page.consoleErrors.length} console error{page.consoleErrors.length !== 1 ? 's' : ''}
                    </summary>
                    <div style={styles.errorList}>
                      {page.consoleErrors.map((err, j) => (
                        <div key={j} style={styles.errorItem}>{err}</div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Raw JSON */}
                <details style={styles.details}>
                  <summary style={styles.summary}>View raw JSON</summary>
                  <pre style={styles.pre}>{JSON.stringify(page, null, 2)}</pre>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Chip({ label, color = 'default' }: { label: string; color?: 'default' | 'red' | 'orange' }) {
  const bg = color === 'red' ? '#fee2e2' : color === 'orange' ? '#fff7ed' : '#f1f5f9';
  const text = color === 'red' ? '#b91c1c' : color === 'orange' ? '#c2410c' : '#475569';
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
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: '#444',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  infoLabel: {
    color: '#888',
    fontWeight: 500,
  },
  dot: {
    color: '#ccc',
  },
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 320,
    display: 'inline-block',
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
  errorList: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  errorItem: {
    padding: '6px 10px',
    backgroundColor: '#fff0f0',
    border: '1px solid #fca5a5',
    borderRadius: 4,
    fontSize: 12,
    color: '#b91c1c',
    wordBreak: 'break-all',
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
