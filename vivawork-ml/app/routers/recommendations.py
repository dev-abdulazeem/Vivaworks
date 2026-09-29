from fastapi import APIRouter, HTTPException, Body
from typing import List, Union, Optional

from pydantic import BaseModel

from app.models.recommender import recommender
from app.schemas import Job, JobRecommendationRequest

router = APIRouter()


class JobsPayload(BaseModel):
    """Wrapped format: {"jobs": [...]} """
    jobs: List[Job] = []


# NOTE: these routes use plain `def` (not `async def`) on purpose.
# Encoding embeddings is CPU-heavy and blocking; FastAPI runs plain `def`
# routes in a thread pool so other requests aren't stalled meanwhile.

@router.post("/jobs/load")
def load_jobs(
    body: Optional[Union[List[Job], JobsPayload]] = Body(default=None),
    replace: bool = False,
):
    """
    Load jobs into memory for matching.

    Accepts EITHER:
      - a bare JSON array:        [{...}, {...}]
      - a wrapped object:         {"jobs": [{...}, {...}]}
      - an empty body (clears pool when replace=true)

    replace=false (default): merge these jobs into the existing pool
        (use when a single job is posted/updated).
    replace=true: replace the whole pool with these jobs
        (use for a full sync of all currently open jobs).
    """

    # --- Normalize the body into a plain list of job dicts ---
    if body is None:
        job_data = []
    elif isinstance(body, list):
        job_data = [
            job.model_dump() if hasattr(job, "model_dump") else job.dict()
            for job in body
        ]
    else:  # JobsPayload
        job_data = [
            job.model_dump() if hasattr(job, "model_dump") else job.dict()
            for job in body.jobs
        ]

    # --- Validate: merging requires every job to have an id ---
    if not replace:
        missing_id = [i for i, j in enumerate(job_data) if not j.get("id")]
        if missing_id:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot merge: job(s) at index {missing_id} "
                       f"are missing the 'id' field. Use ?replace=true "
                       f"for a full sync instead."
            )

    try:
        if replace:
            recommender.encode_jobs(job_data)
        else:
            recommender.add_jobs(job_data)

        return {
            "status": "success",
            "mode": "replace" if replace else "merge",
            "jobs_loaded": len(job_data),
            "pool_size": len(recommender.jobs_cache)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/recommend")
def get_recommendations(request: JobRecommendationRequest, limit: int = 20):
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
            top_k=limit
        )

        return {
            "user_id": request.user_id,
            "recommendations": recommendations,
            "count": len(recommendations)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))