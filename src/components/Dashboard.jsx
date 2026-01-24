import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import './Dashboard.css';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
);

function Dashboard({ csvData }) {
  if (!csvData || csvData.length === 0) {
    return <p className="dashboard-message">Upload a CSV file to see your dashboard.</p>;
  }

  // Process data for Category Pie Chart
  const categorySpending = csvData.reduce((acc, item) => {
    // Ensure 'Category' and 'Amount' exist and 'Amount' is a valid number
    if (item.Category && typeof item.Amount === 'number' && !isNaN(item.Amount)) {
      const category = item.Category.trim();
      acc[category] = (acc[category] || 0) + item.Amount;
    }
    return acc;
  }, {});

  const pieChartData = {
    labels: Object.keys(categorySpending),
    datasets: [
      {
        data: Object.values(categorySpending),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(199, 199, 199, 0.6)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(199, 199, 199, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Spending by Category',
      },
    },
  };

  // Process data for Monthly Spending Bar Chart
  const monthlySpending = csvData.reduce((acc, item) => {
    // Ensure 'Date' and 'Amount' exist and 'Amount' is a valid number
    if (item.Date && typeof item.Amount === 'number' && !isNaN(item.Amount)) {
      const date = new Date(item.Date);
      if (!isNaN(date)) {
        const monthYear = `${date.toLocaleString('default', { month: 'short' })}-${date.getFullYear()}`;
        acc[monthYear] = (acc[monthYear] || 0) + item.Amount;
      }
    }
    return acc;
  }, {});

  // Sort months chronologically
  const sortedMonths = Object.keys(monthlySpending).sort((a, b) => {
    const [monthA, yearA] = a.split('-');
    const [monthB, yearB] = b.split('-');
    const dateA = new Date(`${monthA} 1, ${yearA}`);
    const dateB = new Date(`${monthB} 1, ${yearB}`);
    return dateA - dateB;
  });

  const barChartData = {
    labels: sortedMonths,
    datasets: [
      {
        label: 'Monthly Spending',
        data: sortedMonths.map((month) => monthlySpending[month]),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Monthly Spending Overview',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Month',
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Amount',
        },
      },
    },
  };

  return (
    <div className="dashboard-container">
      <h2>Expense Analysis Dashboard</h2>

      <div className="chart-section">
        <h3>Spending by Category</h3>
        {Object.keys(categorySpending).length > 0 ? (
          <div className="chart-wrapper">
            <Pie data={pieChartData} options={pieChartOptions} />
          </div>
        ) : (
          <p>No valid category or amount data found for pie chart.</p>
        )}
      </div>

      <div className="chart-section">
        <h3>Monthly Spending</h3>
        {Object.keys(monthlySpending).length > 0 ? (
          <div className="chart-wrapper">
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        ) : (
          <p>No valid date or amount data found for monthly spending chart.</p>
        )}
      </div>

      <p className="dashboard-message">Number of transactions: {csvData.length}</p>
    </div>
  );
}

export default Dashboard;