# 🚕 RidePredict

### Cab Cancellation Prediction & Analysis Web Application

**RidePredict** is an end-to-end Machine Learning web application and data analytics platform designed to predict whether a cab booking will be **Completed (0)** or **Cancelled (1)**. The system enables fleet operators, ride aggregators, and data analysts to understand cancellation risk factors, simulate scenarios, and explore geospatial cancellation hotspots.

---

## 🌟 Key Application Features

### 1. 🎯 Real-Time ML Predictor Engine
* **Travel Type Support:** Point-to-Point (Intra-city), Long Distance (Outstation), and Hourly Rental.
* **Instant In-Browser Inference:** Evaluates Decision Tree traversal sub-millisecond without network latency.
* **Animated Radial Risk Gauge:** 0% to 100% cancellation probability with color-coded risk tiers (Green = Safe, Amber = Moderate, Red = High Risk).
* **Explainable AI Risk Factor Breakdown:** Visual bars showing the contribution of lead time, pickup zone risk, booking channel, and vehicle category.
* **Actionable Mitigation Recommendations:** Automated suggestions for priority dispatch, passenger notifications, and driver incentives.

### 2. 📊 Exploratory Data Analysis (EDA) Dashboard
* **Overall Distribution:** 43,431 bookings analyzed (40,299 completed vs 3,132 cancelled, ~7.21% cancellation rate).
* **Travel Type Risk Breakdown:** Point-to-Point (~8.3%) vs Hourly (~4.5%) vs Outstation (~1.4%).
* **Channel Comparison:** Mobile Web vs Online Web vs Desktop/Call Center.
* **24-Hour Cycle & Day of Week Heatmaps:** Peak cancellation risk hours (early morning & late night rush).
* **Lead Time Curve:** Advance booking hours vs Cancellation probability.

### 3. 🗺️ Geospatial Cancellation Hotspot Map
* **Interactive Leaflet Map:** Visualizes Bengaluru pickup sectors with color-coded markers.
* **Risk Categorization:** Low (<6%), Medium (6-12%), and High (≥12%) cancellation sectors.
* **Interactive Marker Popups:** Displays sector total volume, cancellation rate %, and risk tier.

---

## 🚀 Quick Start Guide

### Prerequisites
* Python 3.9+ (with `pandas`, `scikit-learn`, `numpy` installed)

### Running the Web Application

1. **Retrain Models & Export Metrics (Optional / Pre-computed):**
   ```bash
   python train_and_export_models.py
   ```

2. **Start the Web Server:**
   ```bash
   python server.py
   ```

3. **Open in Browser:**
   Navigate to:
   ```text
   http://localhost:8000
   ```

---

## 📁 Project Structure

```text
Cab Cancellation/
├── app/
│   ├── index.html              # Main Single-Page Web Application
│   ├── css/
│   │   └── styles.css          # Glassmorphic Dark UI Design System
│   ├── js/
│   │   ├── predictor.js        # Live ML Inference & Explainability Engine
│   │   ├── analytics.js        # Chart.js Data Visualizations & KPIs
│   │   ├── model_studio.js     # Model Benchmarking & Matrix View
│   │   ├── batch.js            # Scenario Simulator & Batch CSV Engine
│   │   └── map.js              # Leaflet Geospatial Hotspots Map
│   └── data/
│       └── model_data.json     # Trained Decision Trees, Metrics & EDA Stats
├── 1_Long_Distance.ipynb       # EDA & Modeling for Outstation Rides
├── 2_Point_to_Point.ipynb      # EDA & Modeling for Intra-city Rides
├── 3_Hourly.ipynb              # EDA & Modeling for Hourly Rental Rides
├── train_and_export_models.py  # Automated Model Training & Data Extraction Script
├── server.py                   # Python HTTP Server & Prediction API
├── YourCabs.csv                # Historical Cab Booking Dataset
└── README.md                   # Project Documentation
```

---

## 🛠️ Technology Stack
* **Frontend:** HTML5, Modern CSS3 (Dark Glassmorphism, CSS Grid/Flexbox), Vanilla JavaScript (ES6+)
* **Visualizations:** Chart.js, Leaflet.js
* **Backend:** Python `http.server`, REST API handlers
* **Machine Learning:** Scikit-Learn (`DecisionTreeClassifier`, `LogisticRegression`, `RandomForestClassifier`), Pandas, NumPy
