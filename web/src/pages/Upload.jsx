import { useState } from 'react';
import { api, DEMO } from '../api.js';
import { TEMPLATES } from '../demo/engine/csv.js';

export default function Upload() {
  const [type, setType] = useState('activity');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (dryRun) => {
    if (!file) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      setResult(await api(`/ingest/${type}${dryRun ? '?dryRun=true' : ''}`, { method: 'POST', form }));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const [showTpl, setShowTpl] = useState(false);
  const downloadTemplate = async () => {
    if (DEMO) { setShowTpl(!showTpl); return; } // downloads are blocked in the sandboxed demo frame
    const res = await api(`/ingest/template/${type}`, { raw: true });
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: `${type}-template.csv` });
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h1>Upload data</h1>
      <div className="card">
        <div className="row gap">
          <label className="inline">Type
            <select value={type} onChange={(e) => { setType(e.target.value); setResult(null); }}>
              <option value="activity">Activity data (kWh, litres, km…)</option>
              <option value="invoice">Invoices (spend-based)</option>
            </select>
          </label>
          <button className="link" onClick={downloadTemplate}>{DEMO ? (showTpl ? 'Hide sample CSV' : 'Show sample CSV') : 'Download CSV template'}</button>
        </div>
        <p className="muted small">
          {type === 'activity'
            ? 'Columns: date, factor_key, quantity, unit, facility, description. Emissions = quantity × the factor for factor_key (see Emission factors).'
            : 'Columns: invoice_no, vendor, date, description, amount, currency, factor_key. Lines are converted to USD and multiplied by a spend-based factor; leave factor_key blank to classify by description.'}
        </p>
        {DEMO && showTpl && (
          <div>
            <pre className="pre">{TEMPLATES[type]}</pre>
            <button className="link" onClick={() => navigator.clipboard?.writeText(TEMPLATES[type]).catch(() => {})}>Copy</button>
            <span className="muted small"> Paste into a .csv file and upload it below to try the import.</span>
          </div>
        )}
        <input type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); }} />
        <div className="row gap top">
          <button className="secondary" disabled={!file || busy} onClick={() => send(true)}>Validate only</button>
          <button disabled={!file || busy} onClick={() => send(false)}>{busy ? 'Working…' : 'Import'}</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {result && (
          <div className="result">
            <p>
              <strong>{result.dryRun ? 'Validation complete' : `Imported ${result.imported} rows`}</strong>
              {' · '}{result.validRows} valid · {result.rejected.length} rejected · {result.totalKgCo2e.toLocaleString()} kg CO₂e
            </p>
            {result.rejected.length > 0 && (
              <table className="tbl"><thead><tr><th>Line</th><th>Reason</th></tr></thead>
                <tbody>{result.rejected.map((r) => <tr key={r.line}><td>{r.line}</td><td>{r.reason}</td></tr>)}</tbody></table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
