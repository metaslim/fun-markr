import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { importResults, type ImportFormat } from '../services/api';
import { useContextStore } from '../stores/contextStore';
import { useJobStore, type Job } from '../stores/jobStore';

export function Import() {
  const [content, setContent] = useState('');
  const [format, setFormat] = useState<ImportFormat>('xml');
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const addPageVisit = useContextStore((state) => state.addPageVisit);
  const { jobs, addJob } = useJobStore();

  // Get current job from store
  const currentJob: Job | undefined = currentJobId
    ? jobs.find((j) => j.id === currentJobId)
    : undefined;

  useEffect(() => {
    addPageVisit('/import', 'Import Results');
  }, [addPageVisit]);

  // Sync local status with job store
  useEffect(() => {
    if (!currentJob) return;

    if (currentJob.status === 'completed') {
      setStatus('completed');
    } else if (currentJob.status === 'failed') {
      setStatus('error');
      setError(currentJob.error || 'Job failed');
    } else if (currentJob.status === 'processing' || currentJob.status === 'queued') {
      setStatus('processing');
    }
  }, [currentJob?.status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setStatus('uploading');
    setError(null);
    setCurrentJobId(null);

    try {
      const job = await importResults(content, format);
      setCurrentJobId(job.job_id);
      addJob(job.job_id); // Add to global store - polling starts automatically
      setStatus('processing');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      setFormat(ext === 'csv' ? 'csv' : 'xml');
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (event) => {
        setContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const clearFile = () => {
    setContent('');
    setFileName(null);
    setStatus('idle');
    setError(null);
    setCurrentJobId(null);
  };

  const isDisabled = status === 'uploading' || status === 'processing' || status === 'completed' || !content.trim();

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 text-center">Import Results</h1>

      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File upload area */}
          <div>
            {!fileName ? (
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-gray-200 hover:border-emerald-400 rounded-2xl p-8 text-center transition-all hover:bg-emerald-50/50">
                  <input
                    type="file"
                    accept=".xml,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="text-4xl mb-3">📄</div>
                  <div className="text-gray-600 mb-1 font-medium">
                    Drop file here or click to browse
                  </div>
                  <div className="text-sm text-gray-400">
                    Supports .xml and .csv files
                  </div>
                </div>
              </label>
            ) : (
              <div className="border-2 border-emerald-200 bg-emerald-50 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{format === 'csv' ? '📊' : '📄'}</div>
                    <div>
                      <div className="font-medium text-gray-900">{fileName}</div>
                      <div className="text-sm text-gray-500">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          format === 'xml' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {format.toUpperCase()}
                        </span>
                        <span className="ml-2">{content.split('\n').length} lines</span>
                      </div>
                    </div>
                  </div>
                  {status === 'idle' && (
                    <button
                      type="button"
                      onClick={clearFile}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Processing status - inline */}
          {(status === 'processing' || status === 'uploading') && currentJob && (
            <div className="p-4 rounded-xl border-2 bg-amber-50 border-amber-200">
              <div className="flex items-center gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full" />
                <div className="flex-1">
                  <div className="font-semibold text-amber-700 capitalize">
                    {currentJob.status === 'queued' ? 'Queued' : 'Processing'}
                  </div>
                  <div className="text-xs text-amber-600">
                    Processing in background...
                  </div>
                </div>
                <div className="text-xs text-amber-500 font-mono">{currentJob.id.slice(0, 8)}</div>
              </div>
              <p className="text-xs text-amber-600 mt-3 text-center">
                You can leave this page - the import will continue in the background.
              </p>
            </div>
          )}

          {/* Error state - inline */}
          {status === 'error' && (
            <div className="p-4 rounded-xl border-2 bg-red-50 border-red-200">
              <div className="flex items-center gap-3">
                <span className="text-xl">❌</span>
                <div>
                  <div className="font-semibold text-red-700">Import Failed</div>
                  {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Success state - inline */}
          {status === 'completed' && currentJob?.status === 'completed' && (
            <div className="p-4 rounded-xl border-2 bg-emerald-50 border-emerald-200 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <h3 className="text-emerald-700 font-semibold mb-1">Import Complete!</h3>
              <p className="text-emerald-600 text-sm mb-4">
                {currentJob.testIds.length > 0
                  ? `${currentJob.testIds.length} test${currentJob.testIds.length > 1 ? 's' : ''} imported successfully.`
                  : 'Results imported and aggregates calculated.'}
              </p>
              {currentJob.testIds.length > 0 ? (
                <div className="space-y-2">
                  {currentJob.testIds.map((testId) => (
                    <Link
                      key={testId}
                      to={`/tests/${testId}`}
                      className="block w-full px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      View Test {testId} Results →
                    </Link>
                  ))}
                  {currentJob.testIds.length > 1 && (
                    <Link
                      to="/"
                      className="block w-full px-4 py-2 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium transition-colors"
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

          {/* Submit button - only show when not completed */}
          {status !== 'completed' && (
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
              {(status === 'idle' || status === 'error') && 'Import Results'}
            </button>
          )}

          {/* Import another button - only show when completed */}
          {status === 'completed' && (
            <button
              type="button"
              onClick={clearFile}
              className="w-full py-3 rounded-xl font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              Import Another File
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
