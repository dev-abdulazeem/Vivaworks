import pandas as pd
import numpy as np

def generate_realistic_data(n_normal=2000, n_fraud=200, output_path="training_data.csv"):
    """
    Generate realistic synthetic data based on real fraud patterns.
    This is TEMPORARY - once you have 2-3 months of real data, replace it!
    """
    np.random.seed(42)
    
    # ============================================
    # NORMAL USERS (legitimate withdrawals)
    # ============================================
    normal = pd.DataFrame({
        'amount': np.random.lognormal(mean=5.3, sigma=0.8, size=n_normal),  # ~$200 avg
        'account_age_days': np.random.gamma(shape=3, scale=200, size=n_normal),  # Most users 100-800 days old
        'total_earnings': np.random.lognormal(mean=8.2, sigma=1.0, size=n_normal),
        'withdrawal_count_30d': np.random.poisson(lam=2, size=n_normal),
        'avg_withdrawal_amount': np.random.lognormal(mean=5.2, sigma=0.5, size=n_normal),
        'hour_of_day': np.random.randint(8, 23, size=n_normal),  # Humans withdraw in waking hours
        'amount_vs_earnings_ratio': 0  # calculated below
    })
    
    # Normal users withdraw a small % of earnings
    normal['amount_vs_earnings_ratio'] = normal['amount'] / normal['total_earnings']
    normal['amount_vs_earnings_ratio'] = normal['amount_vs_earnings_ratio'].clip(0.001, 0.5)
    
    # ============================================
    # FRAUD PATTERNS (based on real fraud behavior)
    # ============================================
    fraud = pd.DataFrame({
        'amount': np.concatenate([
            np.random.lognormal(mean=8.0, sigma=0.5, size=n_fraud // 2),   # Large withdrawals
            np.random.lognormal(mean=4.5, sigma=0.3, size=n_fraud // 2)    # Many small (testing)
        ]),
        'account_age_days': np.concatenate([
            np.random.randint(1, 14, size=n_fraud // 2),    # Brand new accounts
            np.random.randint(15, 90, size=n_fraud // 2)    # Slightly aged (sleeper accounts)
        ]),
        'total_earnings': np.random.lognormal(mean=5.5, sigma=1.5, size=n_fraud),  # Low earnings
        'withdrawal_count_30d': np.random.poisson(lam=7, size=n_fraud),  # High velocity
        'avg_withdrawal_amount': np.random.lognormal(mean=5.0, sigma=0.8, size=n_fraud),
        'hour_of_day': np.concatenate([
            np.random.randint(0, 6, size=n_fraud // 2),     # 3am withdrawals (bots don't sleep)
            np.random.randint(0, 24, size=n_fraud // 2)     # Random (scripted)
        ]),
        'amount_vs_earnings_ratio': 0
    })
    
    # KEY FRAUD SIGNAL: withdrawing more than you earned!
    fraud['amount_vs_earnings_ratio'] = np.random.uniform(0.8, 5.0, size=n_fraud)
    
    # Combine
    normal['is_fraud'] = 0
    fraud['is_fraud'] = 1
    df = pd.concat([normal, fraud], ignore_index=True)
    
    # Shuffle
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # Round for realism
    df['amount'] = df['amount'].round(2)
    df['total_earnings'] = df['total_earnings'].round(2)
    df['avg_withdrawal_amount'] = df['avg_withdrawal_amount'].round(2)
    df['account_age_days'] = df['account_age_days'].astype(int)
    
    df.to_csv(output_path, index=False)
    
    print(f"✅ Generated {len(df)} samples: {n_normal} normal, {n_fraud} fraud")
    print(f"📁 Saved to {output_path}")
    print(f"\nFraud pattern examples:")
    print(df[df['is_fraud'] == 1].head(3).to_string())
    
    return df

if __name__ == "__main__":
    generate_realistic_data()