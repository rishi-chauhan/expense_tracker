import React from 'react';
import {
  Chart as ChartJS,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import './Dashboard.css';

ChartJS.register(
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
);

// Helper function to identify CC payments
function isCCPayment(description) {
  if (!description) return false;
  const desc = description.toUpperCase();
  return desc.includes('CC PAYMENT') || desc.includes('BPPY');
}

function Dashboard({ csvData }) {
  if (!csvData || csvData.length === 0) {
    return <p className="dashboard-message">Upload a CSV file to see your dashboard.</p>;
  }

  // Filter out CC payments and invalid entries from analytics
  const analyticsData = csvData.filter(t => {
    if (t.IsCredit && isCCPayment(t.Description)) return false;
    if (typeof t.Amount !== 'number' || isNaN(t.Amount)) return false;
    if (!t.Date || isNaN(new Date(t.Date).getTime())) return false;
    return true;
  });

  // Calculate summary statistics
  const totalDebits = analyticsData
    .filter(t => !t.IsCredit)
    .reduce((sum, t) => sum + t.Amount, 0);

  const totalCredits = analyticsData
    .filter(t => t.IsCredit)
    .reduce((sum, t) => sum + t.Amount, 0);

  const netSpending = totalDebits - totalCredits;

  // Group by month and separate debits/credits
  const monthlyData = analyticsData.reduce((acc, item) => {
    if (!item.Date || !item.Amount) return acc;

    const date = new Date(item.Date);
    if (isNaN(date.getTime())) return acc;

    const monthYear = date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });

    if (!acc[monthYear]) {
      acc[monthYear] = { debits: 0, credits: 0 };
    }

    if (item.IsCredit) {
      acc[monthYear].credits += item.Amount;
    } else {
      acc[monthYear].debits += item.Amount;
    }

    return acc;
  }, {});

  // Sort months chronologically
  const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
    return new Date(a) - new Date(b);
  });

  // Prepare chart data with two datasets (enhanced styling)
  const barChartData = {
    labels: sortedMonths,
    datasets: [
      {
        label: 'Debits (Expenses)',
        data: sortedMonths.map(month => monthlyData[month].debits),
        backgroundColor: 'rgba(240, 99, 122, 0.75)',
        borderWidth: 0,
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: 'Credits (Payments/Refunds)',
        data: sortedMonths.map(month => monthlyData[month].credits),
        backgroundColor: 'rgba(61, 217, 160, 0.75)',
        borderWidth: 0,
        borderRadius: 6,
        borderSkipped: false,
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2,
    plugins: {
      legend: {
        display: false, // Using custom legend instead
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1c1e2e',
        borderColor: '#e2a23b',
        borderWidth: 1,
        padding: 16,
        cornerRadius: 8,
        titleFont: {
          family: "'Sora', sans-serif",
          size: 13,
          weight: '600',
        },
        bodyFont: {
          family: "'DM Sans', sans-serif",
          size: 13,
        },
        titleColor: '#e8e9ed',
        bodyColor: '#8b8da0',
        callbacks: {
          label: function(context) {
            return context.dataset.label + ': ₹' + context.parsed.y.toLocaleString('en-IN');
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        border: {
          color: 'rgba(255, 255, 255, 0.06)',
        },
        ticks: {
          font: {
            family: "'DM Sans', sans-serif",
            size: 12,
          },
          color: '#8b8da0',
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.04)',
        },
        border: {
          color: 'rgba(255, 255, 255, 0.06)',
        },
        ticks: {
          font: {
            family: "'JetBrains Mono', monospace",
            size: 11,
          },
          color: '#5c5e72',
          callback: function(value) {
            return '₹' + value.toLocaleString('en-IN');
          }
        }
      },
    },
    animation: {
      duration: 750,
      easing: 'easeOutCubic',
    }
  };

  return (
    <div className="dashboard-container">
      <h2>Credit Card Statement Analysis</h2>

      <div className="summary-stats">
        <div className="stat-card debits">
          <div className="stat-card-header">
            <div className="stat-icon">↓</div>
            <div className="stat-label">Total Debits</div>
          </div>
          <div className="stat-value">
            ₹{totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-trend">Expenses</div>
        </div>

        <div className="stat-card credits">
          <div className="stat-card-header">
            <div className="stat-icon">↑</div>
            <div className="stat-label">Total Credits</div>
          </div>
          <div className="stat-value">
            ₹{totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-trend">Payments</div>
        </div>

        <div className="stat-card net">
          <div className="stat-card-header">
            <div className="stat-icon">Σ</div>
            <div className="stat-label">Net Spending</div>
          </div>
          <div className="stat-value">
            ₹{netSpending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-trend">Balance</div>
        </div>
      </div>

      <div className="chart-section">
        <div className="chart-header">
          <div className="chart-title-group">
            <h3>Monthly Spending</h3>
            <p className="chart-section-subtitle">
              Debits vs Credits over time
            </p>
          </div>
          <div className="chart-legend">
            <div className="legend-item">
              <div className="legend-dot debits"></div>
              <span className="legend-label">Debits (Expenses)</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot credits"></div>
              <span className="legend-label">Credits (Payments)</span>
            </div>
          </div>
        </div>

        {sortedMonths.length > 0 ? (
          <>
            <div className="chart-wrapper">
              <Bar data={barChartData} options={barChartOptions} />
            </div>
            <div className="chart-footer">
              <span>{analyticsData.length} transactions</span>
              <span className="chart-footer-divider">•</span>
              <span>{sortedMonths.length} months</span>
            </div>
          </>
        ) : (
          <p className="dashboard-message">No valid date or amount data found for monthly spending chart.</p>
        )}
      </div>
    </div>
  );
}

export default Dashboard;