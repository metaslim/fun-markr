import { useState } from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { importResults, waitForJob } from '../services/api';
import { useContextStore } from '../stores/contextStore';
import type { JobStatus } from '../types';

export function Import() {
  const [xmlContent, setXmlContent] = useState('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle');
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addPageVisit = useContextStore((state) => state.addPageVisit);

  useEffect(() => {
    addPageVisit('/import', 'Import Results');
  }, [addPageVisit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!xmlContent.trim()) return;

    setStatus('uploading');
    setError(null);

    try {
      const job = await importResults(xmlContent);
      setJobStatus(job);
      setStatus('processing');

      const finalStatus = await waitForJob(job.job_id);
      setJobStatus(finalStatus);

      if (finalStatus.status === 'completed') {
        setStatus('completed');
      } else {
        setStatus('error');
        setError(`Job ${finalStatus.status}: ${finalStatus.error || 'Unknown error'}`);
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setXmlContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="page">
      <Link to="/" className="back-link">&larr; Back to Dashboard</Link>
      <h1>Import Test Results</h1>

      <div className="card">
        <h2>Upload XML</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Upload File</label>
            <input type="file" accept=".xml" onChange={handleFileUpload} />
          </div>

          <div className="form-group">
            <label>Or Paste XML Content</label>
            <textarea
              value={xmlContent}
              onChange={(e) => setXmlContent(e.target.value)}
              placeholder={`<mcq-test-results>
  <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
    <student-number>002299</student-number>
    <test-id>9863</test-id>
    <summary-marks available="20" obtained="13" />
  </mcq-test-result>
</mcq-test-results>`}
              rows={12}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={status === 'uploading' || status === 'processing'}
          >
            {status === 'uploading' && 'Uploading...'}
            {status === 'processing' && 'Processing...'}
            {(status === 'idle' || status === 'completed' || status === 'error') && 'Import'}
          </button>
        </form>
      </div>

      {jobStatus && (
        <div className="card">
          <h2>Job Status</h2>
          <p>Job ID: <code>{jobStatus.job_id}</code></p>
          <p>Status: <span className={`status-${jobStatus.status}`}>{jobStatus.status}</span></p>
        </div>
      )}

      {status === 'completed' && (
        <div className="success-card">
          <h2>Import Complete!</h2>
          <p>Test results have been imported and aggregates calculated.</p>
          <Link to="/" className="btn">View Dashboard</Link>
        </div>
      )}

      {error && (
        <div className="error-card">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
