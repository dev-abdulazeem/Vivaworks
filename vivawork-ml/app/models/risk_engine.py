import xgboost as xgb
import numpy as np
import joblib
import json
import os
from typing import Dict, List
from datetime import datetime

class RiskEngine:
    def __init__(self):
        self.supervised_model = None
        self.anomaly_model = None
        self.features = [
            'amount', 'account_age_days', 'total_earnings',
            'withdrawal_count_30d', 'avg_withdrawal_amount',
            'amount_vs_earnings_ratio', 'hour_of_day'
        ]
        self._load_models()
    
    def _load_models(self):
        """Load whichever models exist"""
        # Supervised model (XGBoost)
        if os.path.exists("risk_model.json"):
            self.supervised_model = xgb.Booster()
            self.supervised_model.load_model("risk_model.json")
            print("✅ Loaded supervised fraud model")
        
        # Anomaly model (Isolation Forest)
        if os.path.exists("anomaly_model.pkl"):
            self.anomaly_model = joblib.load("anomaly_model.pkl")
            print("✅ Loaded anomaly detection model")
        
        # Feature list
        if os.path.exists("model_features.json"):
            with open("model_features.json") as f:
                self.features = json.load(f)
    
    def calculate_withdrawal_risk(self, data: Dict) -> Dict:
        """Full risk assessment combining all signals"""
        flags = []
        
        # ---- RULE-BASED CHECKS (always run, interpretable) ----
        amount = data['amount']
        earnings = max(data['total_earnings'], 1)
        ratio = amount / earnings
        
        if ratio > 0.9 and data['account_age_days'] < 30:
            flags.append("WITHDRAWING_NEAR_FULL_BALANCE_NEW_ACCOUNT")
        if data['account_age_days'] < 7 and amount > 100:
            flags.append("NEW_ACCOUNT_WITHDRAWAL")
        if data['withdrawal_count_30d'] > 5:
            flags.append("VELOCITY_EXCEEDED")
        if data.get('hour_of_day', 12) < 6:
            flags.append("SUSPICIOUS_HOUR")
        
        rule_risk = min(len(flags) * 0.15, 0.75)
        
        # ---- ML MODELS (if trained) ----
        ml_risk = 0.3  # Neutral default
        
        features = self._extract_features(data)
        
        if self.supervised_model:
            dmatrix = xgb.DMatrix(np.array([features]))
            ml_risk = float(self.supervised_model.predict(dmatrix)[0])
        
        # Anomaly model adds a boost if triggered
        anomaly_boost = 0.0
        if self.anomaly_model:
            prediction = self.anomaly_model.predict(np.array([features]))[0]
            if prediction == -1:  # Anomaly detected
                anomaly_boost = 0.3
                flags.append("ANOMALY_DETECTED")
        
        # ---- COMBINE ----
        final_risk = (ml_risk * 0.5) + (rule_risk * 0.3) + (anomaly_boost * 0.2)
        final_risk = min(final_risk, 1.0)
        
        # ---- DECISION ----
        if final_risk > 0.85:
            decision = "block"
        elif final_risk > 0.5 or flags:
            decision = "requires_review"
        else:
            decision = "auto_approve"
        
        return {
            "risk_score": round(final_risk, 3),
            "decision": decision,
            "flags": flags,
            "reasoning": self._explain(flags, data, ratio),
            "model_version": "hybrid_v2"
        }
    
    def _extract_features(self, data: Dict) -> List[float]:
        earnings = max(data['total_earnings'], 1)
        return [
            data['amount'],
            data['account_age_days'],
            data['total_earnings'],
            data['withdrawal_count_30d'],
            data['avg_withdrawal_amount'],
            data['amount'] / earnings,  # ratio feature
            data.get('hour_of_day', datetime.now().hour)
        ]
    
    def _explain(self, flags: List[str], data: Dict, ratio: float) -> str:
        if not flags:
            return "Normal withdrawal pattern detected"
        
        explanations = {
            "WITHDRAWING_NEAR_FULL_BALANCE_NEW_ACCOUNT": f"Withdrawing {ratio:.0%} of balance on a {data['account_age_days']}-day-old account",
            "NEW_ACCOUNT_WITHDRAWAL": f"Account only {data['account_age_days']} days old",
            "VELOCITY_EXCEEDED": f"{data['withdrawal_count_30d']} withdrawals in 30 days",
            "SUSPICIOUS_HOUR": "Withdrawal at unusual hour",
            "ANOMALY_DETECTED": "Behavior doesn't match typical patterns"
        }
        return "; ".join(explanations.get(f, f) for f in flags)

# Singleton
risk_engine = RiskEngine()