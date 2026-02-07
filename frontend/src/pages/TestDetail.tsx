import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAggregate } from '../services/api';
import { useContextStore } from '../stores/contextStore';
import type { TestAggregate } from '../types';

export function TestDetail() {
  const { testId } = useParams<{ testId: string }>();
  const [aggregate, setAggregate] = useState<TestAggregate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const addPageVisit = useContextStore((state) => state.addPageVisit);
  const addViewedTest = useContextStore((state) => state.addViewedTest);

  useEffect(() => {
    if (!testId) return;

    addPageVisit(`/tests/${testId}`, `Test ${testId}`);

    setLoading(true);
    setError(null);

    getAggregate(testId)
      .then((data) => {
        setAggregate(data);
        addViewedTest(testId, data);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [testId, addPageVisit, addViewedTest]);

  if (loading) {
    return (
      <div className="page">
        <h1>Test {testId}</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>Test {testId}</h1>
        <div className="error-card">
          <p>{error}</p>
          <p>Make sure you've imported results for this test first.</p>
          <Link to="/import" className="btn">Import Results</Link>
        </div>
      </div>
    );
  }

  if (!aggregate) return null;

  return (
    <div className="page">
      <Link to="/" className="back-link">&larr; Back to Dashboard</Link>
      <h1>Test {testId}</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Students</div>
          <div className="stat-value">{aggregate.count}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Mean</div>
          <div className="stat-value">{aggregate.mean.toFixed(2)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Std Dev</div>
          <div className="stat-value">{aggregate.stddev.toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        <h2>Score Distribution</h2>
        <table>
          <tbody>
            <tr>
              <td>Minimum</td>
              <td>{aggregate.min.toFixed(2)}%</td>
            </tr>
            <tr>
              <td>25th Percentile (P25)</td>
              <td>{aggregate.p25.toFixed(2)}%</td>
            </tr>
            <tr>
              <td>Median (P50)</td>
              <td>{aggregate.p50.toFixed(2)}%</td>
            </tr>
            <tr>
              <td>75th Percentile (P75)</td>
              <td>{aggregate.p75.toFixed(2)}%</td>
            </tr>
            <tr>
              <td>Maximum</td>
              <td>{aggregate.max.toFixed(2)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Interpretation</h2>
        <ul>
          <li>Average score is <strong>{aggregate.mean.toFixed(1)}%</strong></li>
          <li>Half the students scored above <strong>{aggregate.p50.toFixed(1)}%</strong> (median)</li>
          <li>Score range: <strong>{aggregate.min.toFixed(1)}%</strong> to <strong>{aggregate.max.toFixed(1)}%</strong></li>
          <li>Spread (std dev): <strong>{aggregate.stddev.toFixed(2)}</strong></li>
        </ul>
      </div>
    </div>
  );
}
