from fastapi import APIRouter, HTTPException
from typing import List, Dict
from pydantic import BaseModel

# FIXED IMPORT: Points to the correct app.models path
from app.models.freelancer_recommender import freelancer_recommender

router = APIRouter()

class FreelancerPayload(BaseModel):
    query: str
    freelancers: List[Dict]

@router.post("/freelancers/recommend")
def recommend_freelancers(payload: FreelancerPayload):
    try:
        ranked = freelancer_recommender.rank_freelancers(payload.query, payload.freelancers)
        return {"status": "success", "recommendations": ranked}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))