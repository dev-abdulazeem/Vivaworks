from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session
from app.models.verifier import verifier
from app.database import get_db, ReviewCase
import json

router = APIRouter()

@router.post("/verify/id")
async def verify_id(
    user_id: str,
    id_document: UploadFile = File(...),
    selfie: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Verify user ID:
    1. Check document authenticity
    2. Match face to selfie
    3. Flag for human review if uncertain
    """
    # Save uploaded files (in production, use cloud storage)
    id_path = f"temp/{user_id}_id.jpg"
    selfie_path = f"temp/{user_id}_selfie.jpg"
    
    with open(id_path, "wb") as f:
        f.write(await id_document.read())
    with open(selfie_path, "wb") as f:
        f.write(await selfie.read())
    
    # Run verification
    doc_result = verifier.verify_document(id_path)
    face_result = verifier.match_faces(id_path, selfie_path)
    
    # Combine scores
    overall_score = (doc_result["authenticity_score"] + face_result["match_confidence"]) / 2
    needs_review = doc_result["needs_human_review"] or face_result["needs_human_review"]
    
    # Create review case if needed
    if needs_review:
        case = ReviewCase(
            case_type="verification",
            user_id=user_id,
            risk_score=1 - overall_score,  # Invert: high score = high risk
            ai_reasoning=f"Doc: {doc_result['flags']}, Face: {face_result['flags']}",
            evidence=json.dumps({
                "doc_auth": doc_result["authenticity_score"],
                "face_match": face_result["match_confidence"],
                "liveness": face_result["liveness_passed"]
            }),
            status="pending"
        )
        db.add(case)
        db.commit()
        
        return {
            "status": "pending_review",
            "verification_score": overall_score,
            "message": "Documents submitted. Manual review required within 24 hours."
        }
    
    return {
        "status": "verified",
        "verification_score": overall_score,
        "document_type": doc_result["document_type"],
        "extracted_name": doc_result["extracted_data"].get("full_name")
    }