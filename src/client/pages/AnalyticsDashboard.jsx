import React, { useState } from 'react';
import { useFilters } from '../contexts/FilterContext';
import { useSettings } from '../contexts/SettingsContext';
import SpendingTrends from '../components/SpendingTrends';
import TopMerchants from '../components/TopMerchants';
import DebitCreditRatio from '../components/DebitCreditRatio';
import CategoryBreakdown from '../components/CategoryBreakdown';
import WeekdayChart from '../components/WeekdayChart';
import SegmentedControl from '../components/ui/SegmentedControl';
import { Card } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import './AnalyticsDashboard.css';

/** Insights: deeper charts over the global card + period filters. */
function AnalyticsDashboard({ csvData }) {
  const { filtered, rangeLabel } = useFilters();
  const { showCredits } = useSettings();
  const [granularity, setGranularity] = useState('monthly');

  if (!csvData || csvData.length === 0) {
    return (
      <div className="page insights">
        <Card>
          <EmptyState icon="insights" title="No data yet">
            Upload a statement to see trends, category splits and spending patterns.
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div className="page insights">
      <div className="insights-bar">
        <p className="page-intro">
          <span className="num">{filtered.length.toLocaleString('en-IN')}</span> transactions {rangeLabel}
        </p>
        <SegmentedControl
          label="Granularity"
          value={granularity}
          onChange={setGranularity}
          options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon="calendar" title="Nothing in this period">
            No transactions match the selected card and dates.
          </EmptyState>
        </Card>
      ) : (
        <div className="insights-grid">
          <div className="span-12"><SpendingTrends data={filtered} granularity={granularity} /></div>
          <div className="span-6"><CategoryBreakdown data={filtered} /></div>
          <div className="span-6"><TopMerchants data={filtered} /></div>
          <div className={showCredits ? 'span-6' : 'span-12'}><WeekdayChart data={filtered} /></div>
          {showCredits && <div className="span-6"><DebitCreditRatio data={filtered} /></div>}
        </div>
      )}
    </div>
  );
}

export default AnalyticsDashboard;
