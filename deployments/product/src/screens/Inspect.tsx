import { useState } from 'react';
import {
  Button,
  ErrorNote,
  LoadingNote,
  PageHeader,
  Pill,
  Plate,
  Stat,
} from '../components/ui';
import { useEvidence } from '../lib/session';

export function Inspect() {
  const { report, status, message, inspect } = useEvidence();
  const [source, setSource] = useState('');
  const [consent, setConsent] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Local export"
        title="Read the slice. Leave the repository where it is."
        lede="oAX1 checks an oax-evidence.v1 export from your workbench. Indexing, edits, and approvals stay on the local runtime."
      />
      <div className="stats">
        <Stat
          value={report ? String(report.related.length) : '0'}
          label="Related excerpts"
        />
        <Stat
          value={report ? `v${report.documentVersion}` : '—'}
          label="Document version"
        />
        <Stat
          value={report ? String(report.redactions) : '0'}
          label="Redactions"
        />
      </div>
      <div className="actions">
        <Button
          tone="primary"
          disabled={status === 'loading'}
          onClick={() => inspect({ sample: true })}
        >
          Inspect public sample
        </Button>
      </div>
      {status === 'loading' ? (
        <LoadingNote label="Checking the export." />
      ) : null}
      {status === 'error' ? <ErrorNote message={message} /> : null}
      {report ? (
        <Plate>
          <p className="eyebrow">Focused file</p>
          <h2>{report.focused.name}</h2>
          <p>
            <Pill>{report.path}</Pill>
          </p>
          <p>{report.objective}</p>
          <pre>{report.excerpt}</pre>
          <h3>Historical evidence</h3>
          <pre>{JSON.stringify(report.historical, null, 2)}</pre>
          <h3>Reviewed source-linked notes</h3>
          <pre>{JSON.stringify(report.memory, null, 2)}</pre>
          <p>
            Untrusted snapshot claims. Current checkout freshness is not
            rechecked; local actions still require their own approvals.
          </p>
          <ul>
            {report.limitations.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </Plate>
      ) : null}
      <Plate>
        <label htmlFor="export">Exported evidence</label>
        <textarea
          id="export"
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setConsent(false);
          }}
          placeholder="Paste an oax-evidence.v1 JSON export"
          spellCheck={false}
        />
        <p>
          This inspection sends the pasted code, history and notes to this
          hosted backend. For browser-only inspection, use the{' '}
          <a href="https://oax-evidence-viewer-xvokez.v2.appdeploy.ai/">
            local evidence viewer
          </a>
          .
        </p>
        <label>
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />{' '}
          I reviewed this export and authorize sending it for hosted inspection.
        </label>
        <Button
          tone="secondary"
          disabled={status === 'loading' || !consent}
          onClick={() => inspect({ source })}
        >
          Inspect export
        </Button>
      </Plate>
    </>
  );
}
