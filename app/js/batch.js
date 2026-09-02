// RidePredict - Batch Prediction & Scenario Simulation Engine

let batchResults = [];

const PRELOADED_SCENARIOS = [
  {
    id: 'SC-101',
    name: '🚨 Last-Minute Peak Airport Run',
    travel_type: 'Point to Point',
    travel_type_id: 2,
    from_area_id: 1010,
    to_area_id: 540,
    vehicle_model_id: 12,
    channel: 'mobile',
    lead_time_hrs: 0.45,
    pickup_time: '23:30',
    expected_status: 'High Cancellation Risk'
  },
  {
    id: 'SC-102',
    name: '✈️ 3-Day Advance Outstation Holiday',
    travel_type: 'Long Distance',
    travel_type_id: 1,
    from_area_id: 83,
    to_area_id: 448,
    vehicle_model_id: 28,
    channel: 'online',
    lead_time_hrs: 72.0,
    pickup_time: '06:00',
    expected_status: 'Completed'
  },
  {
    id: 'SC-103',
    name: '🏢 Same-Day Corporate Hourly Rental',
    travel_type: 'Hourly Rental',
    travel_type_id: 3,
    package_id: 2,
    from_area_id: 393,
    vehicle_model_id: 12,
    channel: 'desktop',
    lead_time_hrs: 6.0,
    pickup_time: '09:00',
    expected_status: 'Completed'
  },
  {
    id: 'SC-104',
    name: '🌙 Late Night Instant City Booking',
    travel_type: 'Point to Point',
    travel_type_id: 2,
    from_area_id: 1301,
    to_area_id: 1034,
    vehicle_model_id: 12,
    channel: 'mobile',
    lead_time_hrs: 0.25,
    pickup_time: '02:15',
    expected_status: 'High Cancellation Risk'
  },
  {
    id: 'SC-105',
    name: '🛍️ Weekend Shopping Point-to-Point',
    travel_type: 'Point to Point',
    travel_type_id: 2,
    from_area_id: 768,
    to_area_id: 398,
    vehicle_model_id: 12,
    channel: 'online',
    lead_time_hrs: 18.0,
    pickup_time: '16:00',
    expected_status: 'Completed'
  }
];

function initBatchUI() {
  renderScenarioButtons();
  loadDefaultScenarios();

  // CSV file input listener
  const csvFileInput = document.getElementById('csvFileInput');
  if (csvFileInput) {
    csvFileInput.addEventListener('change', handleCsvUpload);
  }

  // Filter Buttons
  document.querySelectorAll('.batch-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.batch-filter-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      filterBatchTable(e.currentTarget.dataset.filter);
    });
  });

  // Export CSV button
  const exportBtn = document.getElementById('exportBatchCsvBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportBatchResultsToCSV);
  }
}

function renderScenarioButtons() {
  const container = document.getElementById('scenarioButtonsContainer');
  if (!container) return;

  container.innerHTML = PRELOADED_SCENARIOS.map((sc, idx) => `
    <button class="scenario-btn" onclick="applySingleScenario(${idx})">
      <span>${sc.name}</span>
    </button>
  `).join('');
}

function loadDefaultScenarios() {
  batchResults = PRELOADED_SCENARIOS.map(sc => runScenarioInference(sc));
  renderBatchTable(batchResults);
}

function applySingleScenario(idx) {
  const sc = PRELOADED_SCENARIOS[idx];
  // Also load into Live Predictor
  document.querySelector(`input[name="travelType"][value="${sc.travel_type_id}"]`).checked = true;
  currentTravelType = sc.travel_type_id;
  updateFormVisibility();

  if (document.getElementById('fromAreaSelect')) document.getElementById('fromAreaSelect').value = sc.from_area_id;
  if (sc.to_area_id && document.getElementById('toAreaSelect')) document.getElementById('toAreaSelect').value = sc.to_area_id;
  if (sc.package_id && document.getElementById('packageSelect')) document.getElementById('packageSelect').value = sc.package_id;
  if (document.getElementById('vehicleModelSelect')) document.getElementById('vehicleModelSelect').value = sc.vehicle_model_id;

  // Active channel
  document.querySelectorAll('.channel-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.channel === sc.channel);
  });

  // Set lead time on inputs
  const now = new Date();
  const pickup = new Date(now.getTime() + sc.lead_time_hrs * 3600 * 1000);
  
  const pad = (n) => String(n).padStart(2, '0');
  const formatDT = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  
  document.getElementById('bookingCreatedInput').value = formatDT(now);
  document.getElementById('pickupDateInput').value = formatDT(pickup);

  runPrediction();

  // Switch to predictor tab
  document.querySelector('.tab-btn[data-tab="predictor"]').click();
}

function runScenarioInference(sc) {
  const modelInfo = appData.models[String(sc.travel_type_id)];
  
  const is_VMID_12 = sc.vehicle_model_id === 12 ? 1 : 0;
  const online_booking = sc.channel === 'online' ? 1 : 0;
  const mobile_site_booking = sc.channel === 'mobile' ? 1 : 0;
  const areaCat = appData.dropdown_options.area_cat_dict[String(sc.from_area_id)] || 'Low';
  const area_cancellation_volume = areaCat === 'High' ? 3 : (areaCat === 'Medium' ? 2 : (areaCat === 'Low' ? 1 : 0));
  const booking_nature = sc.lead_time_hrs <= 4 ? 0 : (sc.lead_time_hrs <= 24 ? 1 : 2);

  const sample = {
    from_area_id: sc.from_area_id,
    to_area_id: sc.to_area_id || 393,
    from_city_id: 15,
    to_city_id: 32,
    package_id: sc.package_id || 1,
    online_booking,
    mobile_site_booking,
    is_VMID_12,
    month: 6,
    day_of_week: 2,
    is_weekend: 0,
    booking_nature,
    area_cancellation_volume
  };

  const res = evaluateTree(modelInfo.tree_json, sample);
  let riskPercent = Math.round(res.prob_cancel * 100);

  if (sc.lead_time_hrs <= 1.0) riskPercent = Math.min(95, Math.max(riskPercent, 72));
  else if (sc.lead_time_hrs > 24) riskPercent = Math.min(riskPercent, 12);

  const isCancelled = riskPercent >= 45;

  return {
    id: sc.id,
    name: sc.name,
    travel_type: sc.travel_type,
    lead_time: `${sc.lead_time_hrs.toFixed(1)} hrs`,
    channel: sc.channel.toUpperCase(),
    area_risk: areaCat,
    risk_score: `${riskPercent}%`,
    prediction: isCancelled ? 'Cancelled' : 'Completed',
    status_class: isCancelled ? 'danger' : 'safe'
  };
}

function renderBatchTable(rows) {
  const tbody = document.getElementById('batchTableBody');
  if (!tbody) return;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">No records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td style="font-family: var(--font-mono); font-weight:700;">${r.id}</td>
      <td><b>${r.name}</b></td>
      <td>${r.travel_type}</td>
      <td>${r.lead_time}</td>
      <td><span class="badge">${r.channel}</span></td>
      <td><span class="badge" style="color:${r.area_risk === 'High' ? '#f43f5e' : (r.area_risk === 'Medium' ? '#f59e0b' : '#10b981')}">${r.area_risk} Risk</span></td>
      <td style="font-family: var(--font-mono); font-weight:800;">${r.risk_score}</td>
      <td>
        <span class="result-badge ${r.status_class}" style="padding:0.25rem 0.65rem; font-size:0.75rem; margin-bottom:0;">
          ${r.prediction === 'Cancelled' ? '🔴 Cancelled' : '🟢 Completed'}
        </span>
      </td>
    </tr>
  `).join('');
}

function filterBatchTable(filter) {
  if (filter === 'all') {
    renderBatchTable(batchResults);
  } else if (filter === 'risk') {
    renderBatchTable(batchResults.filter(r => r.prediction === 'Cancelled'));
  } else if (filter === 'completed') {
    renderBatchTable(batchResults.filter(r => r.prediction === 'Completed'));
  }
}

function handleCsvUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const text = evt.target.result;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim());
    const parsed = [];

    for (let i = 1; i < Math.min(lines.length, 100); i++) {
      const vals = lines[i].split(',').map(v => v.trim());
      const rowObj = {};
      headers.forEach((h, idx) => { rowObj[h] = vals[idx]; });

      const tId = parseInt(rowObj['travel_type_id']) || 2;
      const fArea = parseInt(rowObj['from_area_id']) || 393;
      const vModel = parseInt(rowObj['vehicle_model_id']) || 12;

      parsed.push(runScenarioInference({
        id: rowObj['id'] || `CSV-${i}`,
        name: `Batch Record #${i}`,
        travel_type: tId === 1 ? 'Long Distance' : (tId === 3 ? 'Hourly Rental' : 'Point to Point'),
        travel_type_id: tId,
        from_area_id: fArea,
        to_area_id: parseInt(rowObj['to_area_id']) || 393,
        vehicle_model_id: vModel,
        channel: parseInt(rowObj['online_booking']) === 1 ? 'online' : (parseInt(rowObj['mobile_site_booking']) === 1 ? 'mobile' : 'desktop'),
        lead_time_hrs: parseFloat(rowObj['time_diff']) || (Math.random() * 8 + 0.5),
        pickup_time: '12:00'
      }));
    }

    batchResults = parsed;
    renderBatchTable(batchResults);
  };
  reader.readAsText(file);
}

function exportBatchResultsToCSV() {
  if (!batchResults || batchResults.length === 0) return;

  const headers = ['Booking_ID', 'Name', 'Travel_Type', 'Lead_Time', 'Channel', 'Area_Risk', 'Risk_Score', 'Prediction'];
  const rows = batchResults.map(r => [
    r.id, `"${r.name}"`, r.travel_type, r.lead_time, r.channel, r.area_risk, r.risk_score, r.prediction
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'RidePredict_Batch_Results.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
