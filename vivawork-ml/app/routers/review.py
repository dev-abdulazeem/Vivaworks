from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db, ReviewCase
from app.schemas import ReviewDecision
from typing import List
from datetime import datetime

router = APIRouter()

@router.get("/cases/pending")
async def get_pending_cases(db: Session = Depends(get_db)):
    """Get all cases waiting for human review"""
    cases = db.query(ReviewCase).filter(ReviewCase.status == "pending").all()
    return {
        "count": len(cases),
        "cases": [
            {
                "id": c.id,
                "type": c.case_type,
                "user_id": c.user_id,
                "risk_score": c.risk_score,
                "ai_reasoning": c.ai_reasoning,
                "created_at": c.created_at,
                "evidence": c.evidence
            }
            for c in cases
        ]
    }

@router.post("/cases/decide")
async def make_decision(decision: ReviewDecision, db: Session = Depends(get_db)):
    """Human makes final decision — and teaches the model in the process"""
    case = db.query(ReviewCase).filter(ReviewCase.id == decision.case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    if case.status != "pending":
        raise HTTPException(status_code=400, detail="Case already reviewed")
    
    # Update case with human decision
    case.status = decision.decision  # approve, reject, escalate
    case.reviewer_id = decision.reviewer_id
    case.reviewed_at = datetime.utcnow()
    case.final_decision = decision.notes
    
    db.commit()
    
    # ⬇️ NEW: Every decision becomes training data for future retraining
    log_decision_for_training(case, decision)
    
    return {
        "status": "success",
        "case_id": case.id,
        "decision": decision.decision,
        "next_steps": "Execute action in Node.js backend based on decision"
    }

@router.get("/cases/history/{user_id}")
async def get_user_history(user_id: str, db: Session = Depends(get_db)):
    """Get all past cases for a user (for pattern analysis)"""
    cases = db.query(ReviewCase).filter(ReviewCase.user_id == user_id).all()
    return {
        "user_id": user_id,
        "total_cases": len(cases),
        "pending": len([c for c in cases if c.status == "pending"]),
        "history": [
            {
                "id": c.id,
                "type": c.case_type,
                "status": c.status,
                "risk_score": c.risk_score
            }
            for c in cases
        ]
    }

def log_decision_for_training(case: ReviewCase, decision: ReviewDecision):
    """
    Appends human decisions to training_data.csv.
    Over time this REAL data replaces the synthetic data.
    """
    import csv, os, json
    
    # Only withdrawal cases produce useful training rows for now
    if case.case_type != "withdrawal":
        return
    
    if not os.path.exists("training_data.csv"):
        return
    
    try:
        evidence = json.loads(case.evidence) if case.evidence else {}
    except json.JSONDecodeError:
        evidence = {}
    
    # Human verdict becomes the label: approve = legit (0), reject = fraud (1)
    if decision.decision == "approve":
        label = 0
    elif decision.decision == "reject":
        label = 1
    else:  # escalate — not sure, don't train on uncertainty
        return
    
    earnings = evidence.get('total_earnings', 100)
    amount = evidence.get('amount', 0)
    
    new_row = {
        'amount': amount,
        'account_age_days': evidence.get('account_age', 0),
        'total_earnings': earnings,
        'withdrawal_count_30d': evidence.get('withdrawal_count_30d', 1),
        'avg_withdrawal_amount': evidence.get('avg_withdrawal_amount', 100),
        'amount_vs_earnings_ratio': amount / max(earnings, 1),
        'hour_of_day': evidence.get('hour_of_day', 12),
        'is_fraud': label
    }
    
    with open("training_data.csv", "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=new_row.keys())
        writer.writerow(new_row)
    
    print(f"📝 Training data updated: case {case.id} labeled as {'FRAUD' if label else 'LEGIT'}")