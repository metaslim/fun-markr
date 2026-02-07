import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { importResults, getJobStatus } from '../services/api';
import { useContextStore } from '../stores/contextStore';
import type { JobStatus } from '../types';

export function Import() {
  const [xmlContent, setXmlContent] = useState('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle');
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [importedTestIds, setImportedTestIds] = useState<string[]>([]);

  const addPageVisit = useContextStore((state) => state.addPageVisit);

  // Extract test IDs from XML content
  const extractTestIds = (xml: string): string[] => {
    const testIds: string[] = [];
    const regex = /<test-id>(\d+)<\/test-id>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      if (!testIds.includes(match[1])) {
        testIds.push(match[1]);
      }
    }
    return testIds;
  };

  useEffect(() => {
    addPageVisit('/import', 'Import Results');
  }, [addPageVisit]);

  // Poll for job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const result = await getJobStatus(jobId);
      setJobStatus(result);
      setPollCount(prev => prev + 1);

      if (result.status === 'completed') {
        setStatus('completed');
        return;
      } else if (result.status === 'failed' || result.status === 'dead') {
        setStatus('error');
        setError(result.error || 'Job failed');
        return;
      }

      // Continue polling if still processing
      if (result.status === 'queued' || result.status === 'processing') {
        setTimeout(() => pollJobStatus(jobId), 1000);
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to check status');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!xmlContent.trim()) return;

    setStatus('uploading');
    setError(null);
    setJobStatus(null);
    setPollCount(0);

    // Extract test IDs before submitting
    const testIds = extractTestIds(xmlContent);
    setImportedTestIds(testIds);

    try {
      const job = await importResults(xmlContent);
      setJobStatus(job);
      setStatus('processing');

      // Start polling
      pollJobStatus(job.job_id);
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

  const isDisabled = status === 'uploading' || status === 'processing' || !xmlContent.trim();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Import Results</h1>
        <p className="text-gray-500 mt-1">Upload XML files with MCQ test results</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upload Form */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File upload */}
            <div>
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-gray-200 hover:border-emerald-400 rounded-2xl p-8 text-center transition-all hover:bg-emerald-50/50">
                  <input
                    type="file"
                    accept=".xml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="text-4xl mb-3">📄</div>
                  <div className="text-gray-600 mb-1 font-medium">Drop XML file here or click to browse</div>
                  <div className="text-sm text-gray-400">Supports .xml files</div>
                </div>
              </label>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 uppercase font-medium">or paste XML</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Text area */}
            <div>
              <textarea
                value={xmlContent}
                onChange={(e) => setXmlContent(e.target.value)}
                placeholder={`<mcq-test-results>
  <mcq-test-result scanned-on="2017-12-04T12:12:10+11:00">
    <first-name>KJ</first-name>
    <last-name>Alysander</last-name>
    <student-number>002299</student-number>
    <test-id>9863</test-id>
    <summary-marks available="20" obtained="13" />
  </mcq-test-result>
</mcq-test-results>`}
                className="w-full h-48 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-mono text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-y"
              />
            </div>

            <button
              type="submit"
              disabled={isDisabled}
              className={`w-full py-3.5 rounded-xl font-medium transition-all ${
                isDisabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
            >
              {status === 'uploading' && 'Uploading...'}
              {status === 'processing' && 'Processing...'}
              {(status === 'idle' || status === 'completed' || status === 'error') && 'Import Results'}
            </button>
          </form>
        </div>

        {/* Status Panel */}
        <div className="space-y-6">
          {/* Job Status */}
          {jobStatus && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Import Progress</h3>

              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-400 mb-1">Job ID</div>
                  <div className="text-gray-900 font-mono text-sm truncate">{jobStatus.job_id}</div>
                </div>

                {/* Status with animation */}
                <div className={`p-4 rounded-xl border-2 ${
                  status === 'completed'
                    ? 'bg-emerald-50 border-emerald-200'
                    : status === 'error'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-center gap-3">
                    {status === 'processing' && (
                      <div className="animate-spin w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full" />
                    )}
                    {status === 'completed' && <span className="text-xl">✅</span>}
                    {status === 'error' && <span className="text-xl">❌</span>}

                    <div>
                      <div className={`font-semibold capitalize ${
                        status === 'completed' ? 'text-emerald-700'
                        : status === 'error' ? 'text-red-700'
                        : 'text-amber-700'
                      }`}>
                        {jobStatus.status}
                      </div>
                      {status === 'processing' && (
                        <div className="text-xs text-amber-600">
                          Polling... ({pollCount} checks)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success */}
          {status === 'completed' && (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="text-emerald-700 font-semibold mb-2">Import Complete!</h3>
              <p className="text-emerald-600 text-sm mb-4">
                {importedTestIds.length > 0
                  ? `${importedTestIds.length} test${importedTestIds.length > 1 ? 's' : ''} imported successfully.`
                  : 'Results imported and aggregates calculated.'}
              </p>

              {importedTestIds.length > 0 ? (
                <div className="space-y-2">
                  {importedTestIds.map((testId) => (
                    <Link
                      key={testId}
                      to={`/tests/${testId}`}
                      className="block w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      View Test {testId} Results →
                    </Link>
                  ))}
                  {importedTestIds.length > 1 && (
                    <Link
                      to="/"
                      className="block w-full px-4 py-2.5 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium transition-colors mt-2"
                    >
                      View All on Dashboard
                    </Link>
                  )}
                </div>
              ) : (
                <Link
                  to="/"
                  className="inline-block px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  View Dashboard
                </Link>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6">
              <div className="text-2xl mb-2">❌</div>
              <h3 className="text-red-700 font-semibold mb-2">Error</h3>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Help */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">XML Format</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Upload XML with <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-emerald-600 font-mono">mcq-test-results</code> root element.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-gray-500">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                first-name (optional)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                last-name (optional)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                student-number
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                test-id
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                summary-marks (available, obtained)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
