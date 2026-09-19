from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.risk_engine import risk_engine
from app.database import get_db, ReviewCase, RiskLog
from app.schemas import WithdrawalRequest, RiskAssessment, ReviewCaseCreate
from datetime import datetime
import json

router = APIRouter()

@router.post("/withdrawal/assess", response_model=RiskAssessment)
async def assess_withdrawal(request: WithdrawalRequest, db: Session = Depends(get_db)):
    """
    Assess withdrawal risk. 
    - Low risk: Auto-approve
    - Medium/High risk: Create review case for human
    - Critical: Block pending immediate review
    """
    # Get risk assessment from engine
    assessment = risk_engine.calculate_withdrawal_risk(request.dict())
    
    # Log the decision
    log = RiskLog(
        user_id=request.user_id,
        action="withdrawal_request",
        risk_score=assessment["risk_score"],
        automated_action=assessment["decision"]
    )
    db.add(log)
    
    # If not auto-approve, create human review case
    if assessment["decision"] != "auto_approve":
        case = ReviewCase(
            case_type="withdrawal",
            user_id=request.user_id,
            risk_score=assessment["risk_score"],
            ai_reasoning=assessment["reasoning"],
            evidence=json.dumps({
                "amount": request.amount,
                "flags": assessment["flags"],
                "account_age": request.account_age_days
            }),
            status="pending"
        )
        db.add(case)
        db.commit()
        
        # Override decision for response — human must review
        if assessment["decision"] == "block":
            assessment["decision"] = "blocked_pending_review"
        else:
            assessment["decision"] = "pending_human_review"
            
    db.commit()
    return assessment

@router.post("/account/flag")
async def flag_account(user_id: str, reason: str, evidence: dict, db: Session = Depends(get_db)):
    """
    Flag suspicious account activity. NEVER auto-suspends.
    Always requires human verification.
    """
    # Calculate generic account risk
    risk_score = min(len(evidence.get("flags", [])) * 0.25, 0.95)
    
    case = ReviewCase(
        case_type="account_flag",
        user_id=user_id,
        risk_score=risk_score,
        ai_reasoning=f"Account flagged: {reason}",
        evidence=json.dumps(evidence),
        status="pending"
    )
    db.add(case)
    db.commit()
    
    return {
        "status": "flagged_for_review",
        "case_id": case.id,
        "message": "Account flagged. Human review required before any action."
    }