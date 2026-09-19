import xgboost as xgb
import numpy as np
from typing import Dict, List
import joblib
import os

class RiskEngine:
    def __init__(self):
        self.model = None
        self.model_path = "risk_model.json"
        self._load_or_create_model()
        
    def _load_or_create_model(self):
        """Load existing model or create fresh one"""
        if os.path.exists(self.model_path):
            self.model = xgb.Booster()
            self.model.load_model(self.model_path)
            print("Loaded existing risk model")
        else:
            # Create model with default parameters (you'll train it later with real data)
            params = {
                'max_depth': 6,
                'learning_rate': 0.1,
                'objective': 'binary:logistic',
                'eval_metric': 'auc'
            }
            self.model = xgb.Booster(params=params)
            # Initialize with dummy data structure
            dtrain = xgb.DMatrix(np.random.rand(10, 8), label=np.random.randint(0, 2, 10))
            self.model = xgb.train(params, dtrain, num_boost_round=10)
            self.model.save_model(self.model_path)
            print("Initialized new risk model")
    
    def calculate_withdrawal_risk(self, data: Dict) -> Dict:
        """
        Analyze withdrawal request for fraud signals
        Returns risk score and flags
        """
        flags = []
        
        # Feature engineering (convert user data to model features)
        features = self._extract_features(data)
        
        # Rule-based checks (fast, interpretable)
        if data['amount'] > 1000 and data['account_age_days'] < 30:
            flags.append("HIGH_AMOUNT_NEW_ACCOUNT")
            
        if data['withdrawal_count_30d'] > 5:
            flags.append("VELOCITY_EXCEEDED")
            
        if data['amount'] > (data['avg_withdrawal_amount'] * 3):
            flags.append("AMOUNT_ANOMALY")
            
        if data['account_age_days'] < 7:
            flags.append("VERY_NEW_ACCOUNT")
        
        # ML prediction (catches complex patterns)
        dmatrix = xgb.DMatrix(np.array([features]))
        ml_risk = float(self.model.predict(dmatrix)[0])
        
        # Combine rules + ML (weighted)
        rule_risk = min(len(flags) * 0.2, 0.8)  # Each flag adds 20% risk, max 80%
        final_risk = (ml_risk * 0.6) + (rule_risk * 0.4)  # ML weighted higher
        
        # Decision logic
        if final_risk > 0.8 or "HIGH_AMOUNT_NEW_ACCOUNT" in flags:
            decision = "block"  # Hard block, requires manual review
        elif final_risk > 0.5 or flags:
            decision = "requires_review"  # Human must approve
        else:
            decision = "auto_approve"
            
        return {
            "risk_score": round(final_risk, 3),
            "decision": decision,
            "flags": flags,
            "reasoning": self._explain_risk(final_risk, flags, data)
        }
    
    def _extract_features(self, data: Dict) -> List[float]:
        """Convert raw data to model features"""
        return [
            data['amount'],
            data['account_age_days'],
            data['total_earnings'],
            data['withdrawal_count_30d'],
            data['avg_withdrawal_amount'],
            data['amount'] / max(data['total_earnings'], 1),  # Withdrawal ratio
            data['account_age_days'] / 365,  # Normalized age
            1.0 if data['currency'] != 'USD' else 0.0,  # Foreign currency flag
        ]
    
    def _explain_risk(self, score: float, flags: List[str], data: Dict) -> str:
        """Generate human-readable explanation"""
        if score < 0.3:
            return "Low risk: Normal withdrawal pattern"
        
        explanations = []
        if "HIGH_AMOUNT_NEW_ACCOUNT" in flags:
            explanations.append(f"Large withdrawal (${data['amount']}) from new account ({data['account_age_days']} days old)")
        if "VELOCITY_EXCEEDED" in flags:
            explanations.append(f"High frequency: {data['withdrawal_count_30d']} withdrawals in 30 days")
        if "AMOUNT_ANOMALY" in flags:
            explanations.append(f"Amount ${data['amount']} is 3x higher than usual ${data['avg_withdrawal_amount']}")
            
        return "Risk factors: " + "; ".join(explanations) if explanations else f"ML model detected anomalies (score: {score})"

# Singleton
risk_engine = RiskEngine()