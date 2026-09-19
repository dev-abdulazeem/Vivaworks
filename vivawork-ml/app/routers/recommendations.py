from fastapi import APIRouter, HTTPException
from typing import List

from app.models.recommender import recommender
from app.schemas import Job, JobRecommendationRequest

router = APIRouter()


@router.post("/jobs/load")
async def load_jobs(jobs: List[Job]):
    """
    Load jobs into memory for matching.
    Call this whenever the available jobs are updated.
    """

    try:
        # Convert Pydantic models to dictionaries
        job_data = [
            job.model_dump() if hasattr(job, "model_dump") else job.dict()
            for job in jobs
        ]

        recommender.encode_jobs(job_data)

        return {
            "status": "success",
            "jobs_loaded": len(job_data)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.post("/jobs/recommend")
async def get_recommendations(request: JobRecommendationRequest):
    """
    Get personalized job recommendations for a user.
    """

    try:
        # Support both Pydantic v1 and v2
        if hasattr(request, "model_dump"):
            user_profile = request.model_dump()
        else:
            user_profile = request.dict()

        recommendations = recommender.get_recommendations(
            user_profile,
            top_k=10
        )

        return {
            "user_id": request.user_id,
            "recommendations": recommendations,
            "count": len(recommendations)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )