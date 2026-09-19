import xgboost as xgb
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.model_selection import train_test_split
import joblib
import json

# Features we use (hour_of_day is new!)
FEATURES = [
    'amount',
    'account_age_days',
    'total_earnings',
    'withdrawal_count_30d',
    'avg_withdrawal_amount',
    'amount_vs_earnings_ratio',
    'hour_of_day'
]

def train_with_synthetic_data(csv_path="training_data.csv"):
    """
    TRAINING MODE 1: You have synthetic/labeled data
    Uses XGBoost supervised learning
    """
    print("=" * 50)
    print("MODE 1: Supervised training (with labels)")
    print("=" * 50)
    
    df = pd.read_csv(csv_path)
    X = df[FEATURES]
    y = df['is_fraud']
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    model = xgb.XGBClassifier(
        max_depth=6,
        learning_rate=0.1,
        n_estimators=150,
        scale_pos_weight=len(y_train[y_train==0]) / len(y_train[y_train==1]),  # Handle imbalance
        random_state=42
    )
    model.fit(X_train, y_train)
    
    test_acc = model.score(X_test, y_test)
    print(f"✅ Test accuracy: {test_acc:.2%}")
    
    model.save_model("risk_model.json")
    
    # Save feature list (risk engine needs this)
    with open("model_features.json", "w") as f:
        json.dump(FEATURES, f)
    
    print_feature_importance(model)
    return model

def train_anomaly_only(csv_path="training_data.csv"):
    """
    TRAINING MODE 2: No labels? Only normal data? Use this.
    Isolation Forest learns 'normal' and flags outliers.
    """
    print("=" * 50)
    print("MODE 2: Anomaly detection (no labels needed)")
    print("=" * 50)
    
    df = pd.read_csv(csv_path)
    # Train ONLY on normal transactions
    normal_data = df[df['is_fraud'] == 0][FEATURES]
    
    iso_forest = IsolationForest(
        contamination=0.05,  # Expect ~5% of transactions to be anomalies
        random_state=42,
        n_estimators=200
    )
    iso_forest.fit(normal_data)
    
    joblib.dump(iso_forest, "anomaly_model.pkl")
    print("✅ Anomaly model saved to anomaly_model.pkl")
    
    # Test how well it catches the synthetic fraud
    X_test = df[FEATURES]
    predictions = iso_forest.predict(X_test)  # -1 = anomaly, 1 = normal
    detected = (predictions[df['is_fraud'] == 1] == -1).mean()
    print(f"🎯 Caught {detected:.1%} of fraud cases in test data")
    
    return iso_forest

def print_feature_importance(model):
    importance = pd.DataFrame({
        'feature': FEATURES,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\n📊 What the model cares about most:")
    for _, row in importance.iterrows():
        bar = "█" * int(row['importance'] * 50)
        print(f"  {row['feature']:30s} {bar} {row['importance']:.3f}")

if __name__ == "__main__":
    import os
    if not os.path.exists("training_data.csv"):
        print("No data found. Generating synthetic data first...")
        from app.models.generate_data import generate_realistic_data
        generate_realistic_data()
    
    # Train BOTH - we'll combine them in the risk engine
    train_with_synthetic_data()
    train_anomaly_only()