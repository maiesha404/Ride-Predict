// RidePredict - Geospatial Hotspot Map Engine (Leaflet)

let mapInstance = null;
let markerLayer = null;

function initMapUI() {
  if (!appData || !appData.eda || !appData.eda.hotspots) return;

  // Initialize map when the map tab is first clicked or when ready
  const mapTabBtn = document.querySelector('.tab-btn[data-tab="map"]');
  if (mapTabBtn) {
    mapTabBtn.addEventListener('click', () => {
      setTimeout(() => {
        if (!mapInstance) {
          setupLeafletMap();
        } else {
          mapInstance.invalidateSize();
        }
      }, 200);
    });
  }

  // Filter Buttons on Map
  document.querySelectorAll('.map-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.map-filter-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      filterMapMarkers(e.currentTarget.dataset.filter);
    });
  });
}

function setupLeafletMap() {
  const mapEl = document.getElementById('mapContainer');
  if (!mapEl || typeof L === 'undefined') return;

  // Center on Bengaluru (12.9716, 77.5946)
  mapInstance = L.map('mapContainer').setView([12.9716, 77.5946], 11);

  // CartoDB Dark Matter tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(mapInstance);

  markerLayer = L.layerGroup().addTo(mapInstance);
  renderMapMarkers('all');
}

function renderMapMarkers(filter) {
  if (!markerLayer || !appData.eda.hotspots) return;

  markerLayer.clearLayers();

  const hotspots = appData.eda.hotspots;
  hotspots.forEach(h => {
    if (filter === 'high' && h.risk_level !== 'High') return;
    if (filter === 'low' && h.risk_level !== 'Low') return;

    const color = h.risk_level === 'High' ? '#f43f5e' : (h.risk_level === 'Medium' ? '#f59e0b' : '#10b981');
    const radius = Math.min(22, Math.max(7, Math.sqrt(h.total) * 1.5));

    const circle = L.circleMarker([h.lat, h.lng], {
      radius: radius,
      fillColor: color,
      color: color,
      weight: 1.5,
      opacity: 0.9,
      fillOpacity: 0.55
    });

    circle.bindPopup(`
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.85rem; padding: 4px;">
        <h3 style="font-size: 0.95rem; font-weight: 800; color: #fff; margin-bottom: 4px;">
          📍 Area ID #${h.area_id}
        </h3>
        <p style="color: #94a3b8; margin: 0 0 6px 0; font-size: 0.75rem;">Bengaluru Sector Coordinates: ${h.lat}, ${h.lng}</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: rgba(0,0,0,0.3); padding: 6px; border-radius: 6px;">
          <div><b style="color:#fff;">${h.total.toLocaleString()}</b> <span style="font-size:0.7rem; color:#94a3b8;">Bookings</span></div>
          <div><b style="color:${color};">${h.rate}%</b> <span style="font-size:0.7rem; color:#94a3b8;">Cancel Rate</span></div>
        </div>
        <div style="margin-top: 8px;">
          <span class="badge" style="background:${color}22; color:${color}; border-color:${color}44;">
            ${h.risk_level} Cancellation Risk
          </span>
        </div>
      </div>
    `);

    markerLayer.addLayer(circle);
  });
}

function filterMapMarkers(filter) {
  renderMapMarkers(filter);
}
