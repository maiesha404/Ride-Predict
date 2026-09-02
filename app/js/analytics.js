// RidePredict - Analytics & Exploratory Data Analysis Engine

let charts = {};

function initAnalyticsUI() {
  if (!appData || !appData.eda) return;

  const eda = appData.eda;
  const meta = appData.metadata;

  // Update Global Summary KPIs
  const elTotal = document.getElementById('kpiTotalBookings');
  const elCancelRate = document.getElementById('kpiCancelRate');
  const elCompleted = document.getElementById('kpiCompleted');
  const elCancelled = document.getElementById('kpiCancelled');

  if (elTotal) elTotal.textContent = Number(meta.total_records).toLocaleString();
  if (elCancelRate) elCancelRate.textContent = `${meta.overall_cancellation_rate}%`;
  if (elCompleted) elCompleted.textContent = Number(meta.overall_completed_count).toLocaleString();
  if (elCancelled) elCancelled.textContent = Number(meta.overall_cancel_count).toLocaleString();

  // Initialize all charts
  renderDistributionChart(meta);
  renderTravelTypeChart(eda.travel_type_stats);
  renderChannelChart(eda.channel_stats);
  renderHourlyChart(eda.hourly_stats);
  renderDayChart(eda.day_stats);
  renderLeadTimeChart(eda.lead_time_stats);
}

function renderDistributionChart(meta) {
  const ctx = document.getElementById('chartDistribution')?.getContext('2d');
  if (!ctx) return;

  if (charts.distribution) charts.distribution.destroy();

  charts.distribution = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Completed Rides', 'Cancelled Rides'],
      datasets: [{
        data: [meta.overall_completed_count, meta.overall_cancel_count],
        backgroundColor: ['#10b981', '#f43f5e'],
        borderColor: '#111827',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: function(item) {
              const val = item.raw;
              const pct = ((val / meta.total_records) * 100).toFixed(2);
              return ` ${item.label}: ${val.toLocaleString()} (${pct}%)`;
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

function renderTravelTypeChart(stats) {
  const ctx = document.getElementById('chartTravelType')?.getContext('2d');
  if (!ctx) return;

  if (charts.travelType) charts.travelType.destroy();

  const labels = stats.map(s => s.name);
  const rates = stats.map(s => s.rate);
  const counts = stats.map(s => s.total);

  charts.travelType = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Cancellation Rate (%)',
        data: rates,
        backgroundColor: ['#06b6d4', '#f59e0b', '#8b5cf6'],
        borderRadius: 8,
        barThickness: 36
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8', callback: v => `${v}%` }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Cancellation Rate: ${ctx.raw}% (Total: ${counts[ctx.dataIndex].toLocaleString()})`
          }
        }
      }
    }
  });
}

function renderChannelChart(stats) {
  const ctx = document.getElementById('chartChannel')?.getContext('2d');
  if (!ctx) return;

  if (charts.channel) charts.channel.destroy();

  charts.channel = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stats.map(s => s.channel),
      datasets: [{
        label: 'Cancellation Rate (%)',
        data: stats.map(s => s.rate),
        backgroundColor: ['#f43f5e', '#3b82f6', '#10b981'],
        borderRadius: 8,
        barThickness: 36
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8', callback: v => `${v}%` }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Cancellation Rate: ${ctx.raw}%`
          }
        }
      }
    }
  });
}

function renderHourlyChart(stats) {
  const ctx = document.getElementById('chartHourly')?.getContext('2d');
  if (!ctx) return;

  if (charts.hourly) charts.hourly.destroy();

  charts.hourly = new Chart(ctx, {
    type: 'line',
    data: {
      labels: stats.map(s => `${String(s.hour).padStart(2, '0')}:00`),
      datasets: [
        {
          label: 'Cancellation Rate (%)',
          data: stats.map(s => s.rate),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          fill: true,
          tension: 0.4,
          yAxisID: 'yRate',
          pointRadius: 3
        },
        {
          label: 'Booking Volume',
          data: stats.map(s => s.total),
          borderColor: 'rgba(6, 182, 212, 0.4)',
          backgroundColor: 'rgba(6, 182, 212, 0.05)',
          type: 'bar',
          yAxisID: 'yVol',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        yRate: {
          type: 'linear',
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#f59e0b', callback: v => `${v}%` }
        },
        yVol: {
          type: 'linear',
          position: 'right',
          grid: { display: false },
          ticks: { color: '#06b6d4' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', maxTicksLimit: 12 }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { size: 11 } }
        }
      }
    }
  });
}

function renderDayChart(stats) {
  const ctx = document.getElementById('chartDay')?.getContext('2d');
  if (!ctx) return;

  if (charts.day) charts.day.destroy();

  charts.day = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stats.map(s => s.day),
      datasets: [{
        label: 'Cancellation Rate (%)',
        data: stats.map(s => s.rate),
        backgroundColor: stats.map((s, idx) => idx >= 5 ? '#f43f5e' : '#38bdf8'),
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8', callback: v => `${v}%` }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderLeadTimeChart(stats) {
  const ctx = document.getElementById('chartLeadTime')?.getContext('2d');
  if (!ctx) return;

  if (charts.leadTime) charts.leadTime.destroy();

  charts.leadTime = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stats.map(s => s.bucket),
      datasets: [{
        label: 'Cancellation Rate (%)',
        data: stats.map(s => s.rate),
        backgroundColor: '#ec4899',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8', callback: v => `${v}%` }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 10 } }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}
