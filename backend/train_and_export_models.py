import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_auc_score
)

def tree_to_dict(tree, feature_names):
    """Recursively convert sklearn DecisionTreeClassifier to a clean JSON dict."""
    tree_ = tree.tree_
    feature_name = [
        feature_names[i] if i != -2 else "undefined!"
        for i in tree_.feature
    ]
    
    def recurse(node):
        if tree_.feature[node] != -2:
            name = feature_name[node]
            threshold = float(tree_.threshold[node])
            left_node = recurse(tree_.children_left[node])
            right_node = recurse(tree_.children_right[node])
            return {
                "type": "split",
                "feature": name,
                "threshold": threshold,
                "left": left_node,    # <= threshold
                "right": right_node,  # > threshold
                "samples": int(tree_.n_node_samples[node]),
                "value": [float(v) for v in tree_.value[node][0]]
            }
        else:
            values = tree_.value[node][0]
            prob_cancel = float(values[1] / np.sum(values)) if np.sum(values) > 0 else 0.0
            prediction = int(np.argmax(values))
            return {
                "type": "leaf",
                "prediction": prediction,
                "prob_cancel": round(prob_cancel, 4),
                "samples": int(tree_.n_node_samples[node]),
                "value": [int(v) for v in values]
            }
            
    return recurse(0)

def main():
    print("Loading YourCabs.csv...")
    data = pd.read_csv('YourCabs.csv')
    total_raw_records = len(data)
    
    # 1. Base EDA Aggregations before drops
    overall_cancel_count = int((data['Car_Cancellation'] == 1).sum())
    overall_completed_count = int((data['Car_Cancellation'] == 0).sum())
    overall_cancel_rate = float(overall_cancel_count / total_raw_records)
    
    # Travel Type Breakdown
    travel_type_labels = {1: "Long Distance / Outstation", 2: "Point to Point", 3: "Hourly Rental"}
    travel_type_stats = []
    for t_id, t_name in travel_type_labels.items():
        sub = data[data['travel_type_id'] == t_id]
        c_count = int((sub['Car_Cancellation'] == 1).sum())
        total_t = len(sub)
        rate = float(c_count / total_t) if total_t > 0 else 0.0
        travel_type_stats.append({
            "id": t_id,
            "name": t_name,
            "total": total_t,
            "cancelled": c_count,
            "completed": total_t - c_count,
            "rate": round(rate * 100, 2)
        })
        
    # Channel Breakdown
    def get_channel(row):
        if row['online_booking'] == 1:
            return 'Online Web'
        elif row['mobile_site_booking'] == 1:
            return 'Mobile Web'
        else:
            return 'Desktop / Call Center'
            
    data['channel'] = data.apply(get_channel, axis=1)
    channel_stats = []
    for ch, group in data.groupby('channel'):
        c_count = int((group['Car_Cancellation'] == 1).sum())
        total_ch = len(group)
        channel_stats.append({
            "channel": ch,
            "total": total_ch,
            "cancelled": c_count,
            "completed": total_ch - c_count,
            "rate": round((c_count / total_ch) * 100, 2) if total_ch > 0 else 0.0
        })
        
    # Temporal Parsing
    data['from_date_dt'] = pd.to_datetime(data['from_date'], format='mixed')
    data['booking_created_dt'] = pd.to_datetime(data['booking_created'], format='mixed')
    
    data['pickup_hour'] = data['from_date_dt'].dt.hour
    data['pickup_dayofweek'] = data['from_date_dt'].dt.dayofweek
    data['pickup_month'] = data['from_date_dt'].dt.month
    
    # Hourly Stats
    hourly_stats = []
    for h in range(24):
        sub_h = data[data['pickup_hour'] == h]
        total_h = len(sub_h)
        c_h = int((sub_h['Car_Cancellation'] == 1).sum()) if total_h > 0 else 0
        hourly_stats.append({
            "hour": h,
            "total": total_h,
            "cancelled": c_h,
            "rate": round((c_h / total_h) * 100, 2) if total_h > 0 else 0.0
        })
        
    # Day of Week Stats
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    day_stats = []
    for d_idx, d_name in enumerate(days):
        sub_d = data[data['pickup_dayofweek'] == d_idx]
        total_d = len(sub_d)
        c_d = int((sub_d['Car_Cancellation'] == 1).sum()) if total_d > 0 else 0
        day_stats.append({
            "day": d_name,
            "day_index": d_idx,
            "total": total_d,
            "cancelled": c_d,
            "rate": round((c_d / total_d) * 100, 2) if total_d > 0 else 0.0
        })
        
    # Hotspot map locations (top areas with valid coords)
    geo_data = data.dropna(subset=['from_lat', 'from_long', 'from_area_id']).copy()
    area_geo = geo_data.groupby('from_area_id').agg(
        lat=('from_lat', 'mean'),
        lng=('from_long', 'mean'),
        total_bookings=('Car_Cancellation', 'count'),
        cancelled=('Car_Cancellation', 'sum')
    ).reset_index()
    
    area_geo['cancellation_rate'] = (area_geo['cancelled'] / area_geo['total_bookings']) * 100
    area_geo = area_geo[area_geo['total_bookings'] >= 15].sort_values('total_bookings', ascending=False)
    
    hotspots = []
    for _, row in area_geo.head(60).iterrows():
        # Filter sensible Bengaluru lat/lng
        if 12.5 <= row['lat'] <= 13.5 and 77.3 <= row['lng'] <= 78.0:
            hotspots.append({
                "area_id": int(row['from_area_id']),
                "lat": round(float(row['lat']), 5),
                "lng": round(float(row['lng']), 5),
                "total": int(row['total_bookings']),
                "cancelled": int(row['cancelled']),
                "rate": round(float(row['cancellation_rate']), 2),
                "risk_level": "High" if row['cancellation_rate'] >= 12 else ("Medium" if row['cancellation_rate'] >= 6 else "Low")
            })

    # 2. Preprocessing & Feature Engineering as in Notebooks
    data_clean = data.copy()
    data_clean = data_clean.drop(columns=['id', 'user_id'])
    data_clean['is_VMID_12'] = data_clean['vehicle_model_id'].apply(lambda x: 1 if x == 12 else 0)
    data_clean = data_clean.drop(columns=['vehicle_model_id'])
    
    from_city_mode = int(data_clean['from_city_id'].mode()[0]) if not data_clean['from_city_id'].dropna().empty else 15
    to_city_mode = int(data_clean['to_city_id'].mode()[0]) if not data_clean['to_city_id'].dropna().empty else 15
    from_area_mode = int(data_clean['from_area_id'].mode()[0]) if not data_clean['from_area_id'].dropna().empty else 393
    to_area_mode = int(data_clean['to_area_id'].mode()[0]) if not data_clean['to_area_id'].dropna().empty else 393
    
    data_clean['from_city_id'] = data_clean['from_city_id'].fillna(from_city_mode)
    data_clean['to_city_id'] = data_clean['to_city_id'].fillna(to_city_mode)
    data_clean['from_area_id'] = data_clean['from_area_id'].fillna(from_area_mode)
    
    data_clean['month'] = data_clean['from_date_dt'].dt.month
    data_clean['day_of_week'] = data_clean['from_date_dt'].dt.dayofweek
    data_clean['is_weekend'] = data_clean['day_of_week'].apply(lambda x: 1 if x >= 5 else 0)
    data_clean['time_diff'] = (data_clean['from_date_dt'] - data_clean['booking_created_dt']).dt.total_seconds() / 3600
    data_clean['booking_nature'] = data_clean['time_diff'].apply(lambda x: 0 if x <= 4 else (1 if x <= 24 else 2))
    
    # Area mapping calculation
    area_info = data_clean.groupby('from_area_id')['Car_Cancellation'].agg(['count', 'mean'])
    def categorize(row):
        if row['count'] == 0:
            return 'Zero'
        elif row['mean'] < 0.05:
            return 'Low'
        elif row['mean'] < 0.15:
            return 'Medium'
        else:
            return 'High'
            
    area_cat_series = area_info.apply(categorize, axis=1)
    area_cat_dict = {int(k): v for k, v in area_cat_series.items()}
    
    data_clean['area_cancellation_volume'] = data_clean['from_area_id'].map(area_cat_series).fillna('Zero')
    data_clean['area_cancellation_volume'] = data_clean['area_cancellation_volume'].map({
        'Zero': 0, 'Low': 1, 'Medium': 2, 'High': 3
    })

    # Lead Time (time_diff) bucket analysis
    lead_time_buckets = [
        {"name": "< 2 hrs (Immediate)", "min": -999, "max": 2},
        {"name": "2 - 6 hrs (Same Day)", "min": 2, "max": 6},
        {"name": "6 - 12 hrs (Half Day)", "min": 6, "max": 12},
        {"name": "12 - 24 hrs (1 Day Advance)", "min": 12, "max": 24},
        {"name": "24 - 72 hrs (2-3 Days)", "min": 24, "max": 72},
        {"name": "> 72 hrs (Long Advance)", "min": 72, "max": 99999}
    ]
    lead_time_stats = []
    for b in lead_time_buckets:
        sub_b = data_clean[(data_clean['time_diff'] >= b['min']) & (data_clean['time_diff'] < b['max'])]
        tot = len(sub_b)
        canc = int((sub_b['Car_Cancellation'] == 1).sum()) if tot > 0 else 0
        lead_time_stats.append({
            "bucket": b['name'],
            "total": tot,
            "cancelled": canc,
            "rate": round((canc / tot) * 100, 2) if tot > 0 else 0.0
        })

    # 3. Model Training & Comparison for Travel Types
    models_output = {}
    
    # Common area & city choices for frontend dropdowns
    top_from_areas = [
        {"id": int(a), "label": f"Area {int(a)} ({area_cat_dict.get(int(a), 'Low')} Risk)"}
        for a in data_clean['from_area_id'].value_counts().head(40).index
    ]
    top_to_areas = [
        {"id": int(a), "label": f"Area {int(a)}"}
        for a in data_clean['to_area_id'].dropna().value_counts().head(40).index
    ]
    packages = [
        {"id": int(p), "label": f"Package {int(p)} ({int(p)*2 if int(p)<=4 else int(p)} hrs / {(int(p)*20 if int(p)<=4 else int(p)*10)} km)"}
        for p in sorted(data_clean['package_id'].dropna().unique())
    ]

    for t_id in [1, 2, 3]:
        t_name = travel_type_labels[t_id]
        print(f"\n--- Training Models for Travel Type {t_id}: {t_name} ---")
        
        # Filter travel type
        sub = data_clean[data_clean['travel_type_id'] == t_id].copy()
        
        # Outlier removal on time_diff as done in notebooks
        Q1 = sub['time_diff'].quantile(0.25)
        Q3 = sub['time_diff'].quantile(0.75)
        IQR = Q3 - Q1
        lower = Q1 - 1.5 * IQR
        upper = Q3 + 1.5 * IQR
        sub = sub[(sub['time_diff'] >= lower) & (sub['time_diff'] <= upper)]
        
        if t_id == 1:
            drop_cols = ['travel_type_id', 'package_id', 'to_area_id', 'from_date', 'booking_created',
                         'from_lat', 'from_long', 'to_lat', 'to_long', 'time_diff', 'channel',
                         'from_date_dt', 'booking_created_dt', 'pickup_hour', 'pickup_dayofweek', 'pickup_month']
        elif t_id == 2:
            drop_cols = ['travel_type_id', 'package_id', 'from_date', 'booking_created',
                         'from_lat', 'from_long', 'to_lat', 'to_long', 'time_diff', 'channel',
                         'from_date_dt', 'booking_created_dt', 'pickup_hour', 'pickup_dayofweek', 'pickup_month']
        elif t_id == 3:
            drop_cols = ['travel_type_id', 'from_area_id', 'to_area_id', 'from_city_id', 'to_city_id',
                         'from_date', 'booking_created', 'from_lat', 'from_long', 'to_lat', 'to_long',
                         'time_diff', 'channel', 'from_date_dt', 'booking_created_dt', 'pickup_hour',
                         'pickup_dayofweek', 'pickup_month']
            
        drop_cols_present = [c for c in drop_cols if c in sub.columns]
        sub = sub.drop(columns=drop_cols_present).fillna(0)
        
        X = sub.drop(columns=['Car_Cancellation'])
        y = sub['Car_Cancellation'].astype(int)
        feature_names = list(X.columns)
        
        print(f"Features ({len(feature_names)}): {feature_names}")
        print(f"Target distribution: {dict(y.value_counts())}")
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.25, random_state=42, stratify=y
        )
        
        # 1. Decision Tree (Primary)
        tree = DecisionTreeClassifier(
            max_depth=4,
            class_weight='balanced',
            random_state=42
        )
        tree.fit(X_train, y_train)
        y_tree_pred = tree.predict(X_test)
        y_tree_prob = tree.predict_proba(X_test)[:, 1] if hasattr(tree, "predict_proba") else y_tree_pred
        
        # 2. Logistic Regression
        lr = LogisticRegression(class_weight='balanced', max_iter=1000, random_state=42)
        lr.fit(X_train, y_train)
        y_lr_pred = lr.predict(X_test)
        y_lr_prob = lr.predict_proba(X_test)[:, 1] if hasattr(lr, "predict_proba") else y_lr_pred
        
        # 3. Random Forest
        rf = RandomForestClassifier(n_estimators=50, max_depth=4, class_weight='balanced', random_state=42)
        rf.fit(X_train, y_train)
        y_rf_pred = rf.predict(X_test)
        y_rf_prob = rf.predict_proba(X_test)[:, 1] if hasattr(rf, "predict_proba") else y_rf_pred
        
        def calc_metrics(y_true, y_pred, y_prob):
            cm = confusion_matrix(y_true, y_pred)
            return {
                "accuracy": round(float(accuracy_score(y_true, y_pred)) * 100, 2),
                "precision": round(float(precision_score(y_true, y_pred, zero_division=0)) * 100, 2),
                "recall": round(float(recall_score(y_true, y_pred, zero_division=0)) * 100, 2),
                "f1": round(float(f1_score(y_true, y_pred, zero_division=0)) * 100, 2),
                "roc_auc": round(float(roc_auc_score(y_true, y_prob)) * 100, 2) if len(np.unique(y_true)) > 1 else 100.0,
                "confusion_matrix": {
                    "tn": int(cm[0, 0]) if cm.shape == (2, 2) else int(cm[0, 0]),
                    "fp": int(cm[0, 1]) if cm.shape == (2, 2) else 0,
                    "fn": int(cm[1, 0]) if cm.shape == (2, 2) else 0,
                    "tp": int(cm[1, 1]) if cm.shape == (2, 2) else 0
                }
            }
            
        tree_metrics = calc_metrics(y_test, y_tree_pred, y_tree_prob)
        lr_metrics = calc_metrics(y_test, y_lr_pred, y_lr_prob)
        rf_metrics = calc_metrics(y_test, y_rf_pred, y_rf_prob)
        
        # Feature Importance from Decision Tree
        importances = [
            {"feature": f, "importance": round(float(imp) * 100, 2)}
            for f, imp in zip(feature_names, tree.feature_importances_)
        ]
        importances.sort(key=lambda x: x['importance'], reverse=True)
        
        # Export Tree Rules as JSON
        tree_dict = tree_to_dict(tree, feature_names)
        
        models_output[str(t_id)] = {
            "travel_type_id": t_id,
            "name": t_name,
            "feature_names": feature_names,
            "tree_json": tree_dict,
            "feature_importances": importances,
            "models_comparison": {
                "decision_tree": tree_metrics,
                "logistic_regression": lr_metrics,
                "random_forest": rf_metrics
            },
            "sample_counts": {
                "train_samples": len(X_train),
                "test_samples": len(X_test),
                "cancel_ratio": round(float(y.mean()) * 100, 2)
            }
        }
        
    # Build complete consolidated payload
    export_payload = {
        "metadata": {
            "project_name": "RidePredict",
            "subtitle": "Cab Cancellation Prediction & Analysis System",
            "total_records": total_raw_records,
            "overall_cancellation_rate": round(overall_cancel_rate * 100, 2),
            "overall_cancel_count": overall_cancel_count,
            "overall_completed_count": overall_completed_count,
            "defaults": {
                "from_city_mode": from_city_mode,
                "to_city_mode": to_city_mode,
                "from_area_mode": from_area_mode,
                "to_area_mode": to_area_mode
            }
        },
        "eda": {
            "travel_type_stats": travel_type_stats,
            "channel_stats": channel_stats,
            "hourly_stats": hourly_stats,
            "day_stats": day_stats,
            "lead_time_stats": lead_time_stats,
            "hotspots": hotspots
        },
        "dropdown_options": {
            "top_from_areas": top_from_areas,
            "top_to_areas": top_to_areas,
            "packages": packages,
            "area_cat_dict": area_cat_dict
        },
        "models": models_output
    }
    
    os.makedirs('app/data', exist_ok=True)
    out_path = 'app/data/model_data.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(export_payload, f, indent=2)
        
    print(f"\nSuccessfully generated {out_path} ({os.path.getsize(out_path):,} bytes)")

if __name__ == '__main__':
    main()
