import React from 'react';
import { Card, CardHeader } from './ui/Card';
import './ChartCard.css';

/**
 * Card with a fixed-height canvas area (no layout shift while Chart.js loads)
 * and a visually hidden text summary for screen readers.
 */
export default function ChartCard({ title, subtitle, actions, summary, height = 'md', className = '', children }) {
  return (
    <Card className={`chart-card ${className}`.trim()}>
      <CardHeader title={title} subtitle={subtitle} actions={actions} />
      {summary && <p className="sr-only">{summary}</p>}
      <div className={`chart-box chart-box-${height}`}>{children}</div>
    </Card>
  );
}
