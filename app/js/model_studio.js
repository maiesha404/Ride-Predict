// RidePredict - Machine Learning Model Studio Engine

let studioTravelType = 2;

function initModelStudioUI() {
  if (!appData || !appData.models) return;

  // Travel type tabs in model studio
  const buttons = document.querySelectorAll('.studio-tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      buttons.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      studioTravelType = parseInt(e.currentTarget.dataset.type);
      renderModelStudioData();
    });
  });

  renderModelStudioData();
}

function renderModelStudioData() {
  const modelData = appData.models[String(studioTravelType)];
  if (!modelData) return;

  const comp = modelData.models_comparison;
  const dt = comp.decision_tree;
  const lr = comp.logistic_regression;
  const rf = comp.random_forest;

  // Update Metric Cards
  document.getElementById('dtAccuracy').textContent = `${dt.accuracy}%`;
  document.getElementById('dtPrecision').textContent = `${dt.precision}%`;
  document.getElementById('dtRecall').textContent = `${dt.recall}%`;
  document.getElementById('dtF1').textContent = `${dt.f1}%`;
  document.getElementById('dtAuc').textContent = `${dt.roc_auc}%`;

  document.getElementById('lrAccuracy').textContent = `${lr.accuracy}%`;
  document.getElementById('lrF1').textContent = `${lr.f1}%`;
  document.getElementById('lrAuc').textContent = `${lr.roc_auc}%`;

  document.getElementById('rfAccuracy').textContent = `${rf.accuracy}%`;
  document.getElementById('rfF1').textContent = `${rf.f1}%`;
  document.getElementById('rfAuc').textContent = `${rf.roc_auc}%`;

  // Update Confusion Matrix (Decision Tree)
  const cm = dt.confusion_matrix;
  document.getElementById('cmTN').textContent = cm.tn.toLocaleString();
  document.getElementById('cmFP').textContent = cm.fp.toLocaleString();
  document.getElementById('cmFN').textContent = cm.fn.toLocaleString();
  document.getElementById('cmTP').textContent = cm.tp.toLocaleString();

  // Render Feature Importance Chart
  renderFeatureImportanceChart(modelData.feature_importances);

  // Render Tree Rules
  renderTreeRules(modelData.tree_json);
}

function renderFeatureImportanceChart(importances) {
  const ctx = document.getElementById('chartImportance')?.getContext('2d');
  if (!ctx) return;

  if (charts.importance) charts.importance.destroy();

  const labels = importances.map(i => i.feature.replace(/_/g, ' '));
  const values = importances.map(i => i.importance);

  charts.importance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Relative Importance (%)',
        data: values,
        backgroundColor: '#f59e0b',
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8', callback: v => `${v}%` }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#f8fafc', font: { size: 11, weight: 'bold' } }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderTreeRules(treeRoot) {
  const container = document.getElementById('treeRulesContainer');
  if (!container) return;

  function buildHtml(node, depth = 0) {
    if (depth > 3) return ''; // limit display depth for clean UI

    if (node.type === 'leaf') {
      const isCanc = node.prediction === 1;
      return `
        <div class="tree-node">
          <span class="tree-leaf ${isCanc ? 'cancel' : ''}">
            ➔ <b>${isCanc ? 'CANCELLED (1)' : 'COMPLETED (0)'}</b> 
            (Risk: ${(node.prob_cancel * 100).toFixed(1)}%, n=${node.samples})
          </span>
        </div>
      `;
    }

    return `
      <div class="tree-node">
        <span class="tree-condition">🌿 IF <b>${node.feature}</b> ≤ ${node.threshold.toFixed(2)}:</span>
        ${buildHtml(node.left, depth + 1)}
        <span class="tree-condition" style="margin-top:4px; display:inline-block;">🌿 ELSE IF <b>${node.feature}</b> > ${node.threshold.toFixed(2)}:</span>
        ${buildHtml(node.right, depth + 1)}
      </div>
    `;
  }

  container.innerHTML = `
    <div style="font-family: var(--font-mono); font-size: 0.8rem; line-height: 1.6; color: #cbd5e1;">
      ${buildHtml(treeRoot)}
    </div>
  `;
}
