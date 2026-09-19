import xgboost as xgb
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
import joblib

def train_fraud_model(csv_path: str = "training_data.csv"):
    """
    Train XGBoost on historical withdrawal data
    CSV columns: amount, account_age_days, total_earnings, withdrawal_count_30d, 
                 avg_withdrawal_amount, is_fraud (0 or 1)
    """
    
    # Load your historical data
    df = pd.read_csv(csv_path)
    
    # Features (what the model looks at)
    features = ['amount', 'account_age_days', 'total_earnings', 
                'withdrawal_count_30d', 'avg_withdrawal_amount']
    
    X = df[features]
    y = df['is_fraud']  # 1 = fraud, 0 = legitimate
    
    # Split for training/testing
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Train
    model = xgb.XGBClassifier(
        max_depth=6,
        learning_rate=0.1,
        n_estimators=100,
        objective='binary:logistic'
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    accuracy = model.score(X_test, y_test)
    print(f"Model accuracy: {accuracy:.2%}")
    
    # Save for the risk engine to use
    model.save_model("risk_model.json")
    print("Model saved to risk_model.json")
    
    return model

if __name__ == "__main__":
    # Create sample training data if you don't have real data yet
    sample_data = {
        'amount': [100, 5000, 200, 50, 3000, 150, 8000, 75],
        'account_age_days': [365, 10, 200, 500, 5, 180, 15, 400],
        'total_earnings': [5000, 200, 3000, 8000, 100, 2500, 500, 6000],
        'withdrawal_count_30d': [2, 5, 1, 0, 8, 1, 6, 0],
        'avg_withdrawal_amount': [100, 1000, 200, 50, 500, 150, 2000, 75],
        'is_fraud': [0, 1, 0, 0, 1, 0, 1, 0]  # 1 = fraud
    }
    
    pd.DataFrame(sample_data).to_csv("training_data.csv", index=False)
    print("Created sample training_data.csv")
    
    # Train
    train_fraud_model()