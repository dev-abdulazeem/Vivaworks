from fastapi import APIRouter, HTTPException
from typing import List, Dict
from pydantic import BaseModel

from app.models.freelancer_recommender import freelancer_recommender

router = APIRouter()


class FreelancerPayload(BaseModel):
    query: str
    freelancers: List[Dict]
    require_skill_match: bool = True  # set False to allow relaxed search mode


@router.post("/freelancers/recommend")
def recommend_freelancers(payload: FreelancerPayload):
    try:
        ranked = freelancer_recommender.rank_freelancers(
            payload.query,
            payload.freelancers,
            require_skill_match=payload.require_skill_match,
        )
        return {
            "status": "success",
            "count": len(ranked),
            "recommendations": ranked,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))