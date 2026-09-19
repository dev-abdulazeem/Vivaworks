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
    """Human makes final decision on a case"""
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