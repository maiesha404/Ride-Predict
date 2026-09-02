// RidePredict - Live Interactive Predictor Engine

let appData = null;
let currentTravelType = 2; // Default: Point to Point

// Initialize predictor on load
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('data/model_data.json');
    appData = await res.json();
    initPredictorUI();
    initAnalyticsUI();
    initMapUI();
    runPrediction(); // Initial baseline prediction
  } catch (err) {
    console.error('Failed to load model data:', err);
  }
});

function initPredictorUI() {
  if (!appData) return;

  // Populate From Areas
  const fromAreaSelect = document.getElementById('fromAreaSelect');
  if (fromAreaSelect) {
    fromAreaSelect.innerHTML = appData.dropdown_options.top_from_areas
      .map(a => `<option value="${a.id}">${a.label}</option>`)
      .join('');
  }

  // Populate To Areas
  const toAreaSelect = document.getElementById('toAreaSelect');
  if (toAreaSelect) {
    toAreaSelect.innerHTML = appData.dropdown_options.top_to_areas
      .map(a => `<option value="${a.id}">${a.label}</option>`)
      .join('');
  }

  // Populate Packages
  const packageSelect = document.getElementById('packageSelect');
  if (packageSelect) {
    packageSelect.innerHTML = appData.dropdown_options.packages
      .map(p => `<option value="${p.id}">${p.label}</option>`)
      .join('');
  }

  // Set default datetime: now + 3 hours
  const now = new Date();
  const pickupTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  
  const formatDT = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const bookingInput = document.getElementById('bookingCreatedInput');
  const pickupInput = document.getElementById('pickupDateInput');
  
  if (bookingInput) bookingInput.value = formatDT(now);
  if (pickupInput) pickupInput.value = formatDT(pickupTime);

  // Travel Type Radio Listeners
  document.querySelectorAll('input[name="travelType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentTravelType = parseInt(e.target.value);
      updateFormVisibility();
      runPrediction();
    });
  });

  // Channel Button Listeners
  document.querySelectorAll('.channel-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      runPrediction();
    });
  });

  // Change listeners on inputs for instant live feedback
  const watchInputs = [
    'fromAreaSelect', 'toAreaSelect', 'packageSelect', 'vehicleModelSelect',
    'pickupDateInput', 'bookingCreatedInput', 'fromCitySelect', 'toCitySelect'
  ];
  watchInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', runPrediction);
  });

  updateFormVisibility();
}

function updateFormVisibility() {
  const toAreaGroup = document.getElementById('toAreaGroup');
  const packageGroup = document.getElementById('packageGroup');
  const cityGroup = document.getElementById('cityGroup');

  if (currentTravelType === 1) { // Long Distance
    if (toAreaGroup) toAreaGroup.style.display = 'none';
    if (packageGroup) packageGroup.style.display = 'none';
    if (cityGroup) cityGroup.style.display = 'grid';
  } else if (currentTravelType === 2) { // Point to Point
    if (toAreaGroup) toAreaGroup.style.display = 'flex';
    if (packageGroup) packageGroup.style.display = 'none';
    if (cityGroup) cityGroup.style.display = 'grid';
  } else if (currentTravelType === 3) { // Hourly Rental
    if (toAreaGroup) toAreaGroup.style.display = 'none';
    if (packageGroup) packageGroup.style.display = 'flex';
    if (cityGroup) cityGroup.style.display = 'none';
  }
}

// Tree Traversal Algorithm in JS
function evaluateTree(node, sample) {
  if (node.type === 'leaf') {
    return {
      prediction: node.prediction,
      prob_cancel: node.prob_cancel,
      samples: node.samples
    };
  }

  const featureVal = sample[node.feature] !== undefined ? sample[node.feature] : 0;
  if (featureVal <= node.threshold) {
    return evaluateTree(node.left, sample);
  } else {
    return evaluateTree(node.right, sample);
  }
}

// Feature Extractor and Live Inference
function runPrediction() {
  if (!appData) return;

  const modelInfo = appData.models[String(currentTravelType)];
  if (!modelInfo) return;

  // 1. Gather inputs
  const fromArea = parseInt(document.getElementById('fromAreaSelect')?.value || appData.metadata.defaults.from_area_mode);
  const toArea = parseInt(document.getElementById('toAreaSelect')?.value || appData.metadata.defaults.to_area_mode);
  const packageId = parseInt(document.getElementById('packageSelect')?.value || 1);
  const vehicleModel = parseInt(document.getElementById('vehicleModelSelect')?.value || 12);
  const fromCity = parseInt(document.getElementById('fromCitySelect')?.value || appData.metadata.defaults.from_city_mode);
  const toCity = parseInt(document.getElementById('toCitySelect')?.value || appData.metadata.defaults.to_city_mode);

  const pickupDT = new Date(document.getElementById('pickupDateInput')?.value || new Date());
  const bookingDT = new Date(document.getElementById('bookingCreatedInput')?.value || new Date());

  // Active channel
  const activeChannelBtn = document.querySelector('.channel-btn.active');
  const channelType = activeChannelBtn ? activeChannelBtn.dataset.channel : 'desktop';
  const online_booking = channelType === 'online' ? 1 : 0;
  const mobile_site_booking = channelType === 'mobile' ? 1 : 0;

  // 2. Feature Engineering
  const is_VMID_12 = vehicleModel === 12 ? 1 : 0;
  const month = pickupDT.getMonth() + 1;
  const day_of_week = (pickupDT.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const is_weekend = day_of_week >= 5 ? 1 : 0;

  // Time difference in hours
  let time_diff = (pickupDT.getTime() - bookingDT.getTime()) / (1000 * 60 * 60);
  if (isNaN(time_diff) || time_diff < 0) time_diff = 1.0;

  const booking_nature = time_diff <= 4 ? 0 : (time_diff <= 24 ? 1 : 2);

  // Area cancellation volume
  const areaCat = appData.dropdown_options.area_cat_dict[String(fromArea)] || 'Low';
  const area_cancellation_volume = areaCat === 'High' ? 3 : (areaCat === 'Medium' ? 2 : (areaCat === 'Low' ? 1 : 0));

  // Build sample feature map
  const sample = {
    from_area_id: fromArea,
    to_area_id: toArea,
    from_city_id: fromCity,
    to_city_id: toCity,
    package_id: packageId,
    online_booking: online_booking,
    mobile_site_booking: mobile_site_booking,
    is_VMID_12: is_VMID_12,
    month: month,
    day_of_week: day_of_week,
    is_weekend: is_weekend,
    booking_nature: booking_nature,
    area_cancellation_volume: area_cancellation_volume
  };

  // 3. Tree Inference
  const result = evaluateTree(modelInfo.tree_json, sample);
  
  // Calculate calibrated probability
  let riskPercent = Math.round(result.prob_cancel * 100);
  
  // Fine heuristic calibration for subtle adjustments (e.g., tight lead time, high area)
  if (time_diff <= 1.0) riskPercent = Math.min(96, Math.max(riskPercent, 68));
  else if (time_diff <= 2.5 && area_cancellation_volume >= 2) riskPercent = Math.min(90, Math.max(riskPercent, 55));
  else if (time_diff > 24 && area_cancellation_volume <= 1) riskPercent = Math.min(riskPercent, 12);

  const isCancelled = riskPercent >= 45 || result.prediction === 1;

  // 4. Update UI Display
  updatePredictionUI(riskPercent, isCancelled, {
    time_diff,
    booking_nature,
    areaCat,
    channelType,
    is_VMID_12,
    is_weekend
  });
}

function updatePredictionUI(riskPercent, isCancelled, factors) {
  // Update Gauge Fill (circumference 283)
  const gaugeFill = document.getElementById('gaugeFill');
  const gaugeValText = document.getElementById('gaugeValText');
  const resultBadge = document.getElementById('resultBadge');
  const resultSummary = document.getElementById('resultSummary');

  const offset = 283 - (283 * (riskPercent / 100));
  if (gaugeFill) gaugeFill.style.strokeDashoffset = offset;
  if (gaugeValText) gaugeValText.textContent = `${riskPercent}%`;

  if (resultBadge) {
    if (riskPercent < 25) {
      resultBadge.className = 'result-badge safe';
      resultBadge.innerHTML = '<span>🟢</span> Low Cancellation Risk (Completed)';
    } else if (riskPercent < 55) {
      resultBadge.className = 'result-badge warning';
      resultBadge.innerHTML = '<span>🟡</span> Moderate Risk';
    } else {
      resultBadge.className = 'result-badge danger';
      resultBadge.innerHTML = '<span>🔴</span> High Cancellation Risk';
    }
  }

  if (resultSummary) {
    if (riskPercent < 25) {
      resultSummary.textContent = `This booking is strongly predicted to be COMPLETED smoothly. Factors like advance lead time and pickup zone stability favor high fulfillment.`;
    } else if (riskPercent < 55) {
      resultSummary.textContent = `This booking has moderate uncertainty. Driver availability and traffic conditions in the pickup zone could elevate cancellation probability.`;
    } else {
      resultSummary.textContent = `ALERT: High likelihood of booking CANCELLATION. Tight booking lead time (< 2 hrs) and elevated cancellation history in this pickup sector increase risk.`;
    }
  }

  // Update Factor Bars
  updateFactorBars(factors, riskPercent);

  // Update AI Recommendations
  updateAdvice(factors, riskPercent);
}

function updateFactorBars(f, riskPercent) {
  const container = document.getElementById('factorsContainer');
  if (!container) return;

  // Lead Time factor
  let leadTimeScore = f.time_diff <= 2 ? 85 : (f.time_diff <= 6 ? 50 : 15);
  let leadTimeClass = leadTimeScore > 60 ? 'risk' : (leadTimeScore > 35 ? 'neutral' : 'safe');

  // Area cancellation factor
  let areaScore = f.areaCat === 'High' ? 88 : (f.areaCat === 'Medium' ? 52 : 18);
  let areaClass = areaScore > 60 ? 'risk' : (areaScore > 35 ? 'neutral' : 'safe');

  // Channel Factor
  let channelScore = f.channelType === 'mobile' ? 65 : (f.channelType === 'online' ? 45 : 20);
  let channelClass = channelScore > 50 ? 'risk' : 'safe';

  // Vehicle Factor
  let vehScore = f.is_VMID_12 ? 30 : 60;
  let vehClass = vehScore > 50 ? 'risk' : 'safe';

  container.innerHTML = `
    <div class="factor-item">
      <div class="factor-header">
        <span>⏱️ Booking Lead Time (${f.time_diff.toFixed(1)} hrs)</span>
        <span style="color: ${leadTimeScore > 60 ? '#f43f5e' : '#10b981'}">${leadTimeScore > 60 ? 'High Impact' : 'Favorable'}</span>
      </div>
      <div class="factor-bar-bg">
        <div class="factor-bar-fill ${leadTimeClass}" style="width: ${leadTimeScore}%"></div>
      </div>
    </div>
    
    <div class="factor-item">
      <div class="factor-header">
        <span>📍 Pickup Zone Risk (${f.areaCat} Tier)</span>
        <span style="color: ${areaScore > 60 ? '#f43f5e' : '#10b981'}">${areaScore > 60 ? 'Hotspot Risk' : 'Stable'}</span>
      </div>
      <div class="factor-bar-bg">
        <div class="factor-bar-fill ${areaClass}" style="width: ${areaScore}%"></div>
      </div>
    </div>

    <div class="factor-item">
      <div class="factor-header">
        <span>📱 Booking Channel (${f.channelType.toUpperCase()})</span>
        <span>${channelScore}% Base Variance</span>
      </div>
      <div class="factor-bar-bg">
        <div class="factor-bar-fill ${channelClass}" style="width: ${channelScore}%"></div>
      </div>
    </div>

    <div class="factor-item">
      <div class="factor-header">
        <span>🚗 Vehicle Category Profile</span>
        <span>${f.is_VMID_12 ? 'Standard Sedan (Popular)' : 'Specialty Vehicle'}</span>
      </div>
      <div class="factor-bar-bg">
        <div class="factor-bar-fill ${vehClass}" style="width: ${vehScore}%"></div>
      </div>
    </div>
  `;
}

function updateAdvice(f, riskPercent) {
  const box = document.getElementById('adviceBox');
  if (!box) return;

  if (riskPercent >= 55) {
    box.innerHTML = `
      <div class="advice-icon">⚡</div>
      <div class="advice-content">
        <h4>High-Risk Mitigation Actions:</h4>
        <p>1. Auto-dispatch priority drivers within a 3km radius immediately.<br>
           2. Send automated passenger pickup confirmation SMS 30 mins prior.<br>
           3. Apply dynamic driver fulfillment incentive for this sector.</p>
      </div>
    `;
  } else if (riskPercent >= 25) {
    box.innerHTML = `
      <div class="advice-icon">💡</div>
      <div class="advice-content">
        <h4>Operational Best Practice:</h4>
        <p>1. Ensure standard route staging and driver re-assignment fallback.<br>
           2. Monitor local traffic congestion along the designated route corridor.</p>
      </div>
    `;
  } else {
    box.innerHTML = `
      <div class="advice-icon">✅</div>
      <div class="advice-content">
        <h4>Optimal Booking Profile:</h4>
        <p>High completion likelihood. Standard automated dispatch pipeline recommended without extra intervention.</p>
      </div>
    `;
  }
}
