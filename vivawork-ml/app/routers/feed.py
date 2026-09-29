from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter
from app.models.feed_ranker import feed_ranker

router = APIRouter()


class FeedRequest(BaseModel):
    user_id: str
    skills: List[str] = []
    profile_bio: str = ""
    preferred_categories: List[str] = []
    experience_level: str = "beginner"
    past_jobs: List[Any] = []
    posts: List[Dict[str, Any]] = []   # posts sent from Node


@router.post("")   # full path: /ml/feed
async def get_feed(request: FeedRequest, limit: int = 20):
    """
    Get personalized feed ranked from the posts sent by Node
    """
    user_context = {
        "skills": request.skills,
        "past_jobs": request.past_jobs,
        "collaborative_scores": {}
    }

    ranked_feed = feed_ranker.rank_feed(request.user_id, request.posts, user_context)

    return {
        "user_id": request.user_id,
        "feed": ranked_feed[:limit],
        "algorithm_version": "1.0"
    }