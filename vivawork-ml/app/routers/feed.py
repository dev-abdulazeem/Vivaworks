from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter
from app.models.feed_ranker import feed_ranker

router = APIRouter()

class SessionView(BaseModel):
    item_id: str
    category: str = "general"
    viewed_at: str

class FeedRequest(BaseModel):
    user_id: str
    skills: List[str] = []
    headline: str = ""
    bio: str = ""
    preferred_categories: List[str] = []
    experience_level: str = "beginner"
    past_jobs: List[Any] = []
    
    # Real-time behavioral context
    connection_ids: List[str] = []
    session_views: List[SessionView] = []
    viewed_ids: List[str] = []
    saved_ids: List[str] = []
    applied_ids: List[str] = []
    dismissed_categories: List[str] = []
    
    # Posts to rank
    posts: List[Dict[str, Any]] = []

@router.post("")
async def get_feed(request: FeedRequest, limit: int = 20):
    """
    Get personalized feed ranked from the posts sent by Node.js
    """
    print(f"\n📥 [Feed API] Received feed request for User: {request.user_id}")
    print(f"   📊 Posts to rank: {len(request.posts)}")
    print(f"   🔗 Connections: {len(request.connection_ids)}")
    print(f"   👀 Session views: {len(request.session_views)}")
    
    # Convert Pydantic models to dicts for the ranker (supports both Pydantic v1 and v2)
    session_views_dicts = [
        v.model_dump() if hasattr(v, 'model_dump') else v.dict() 
        for v in request.session_views
    ]
    
    # Build rich user context exactly as the FeedRanker expects it
    user_context = {
        "skills": request.skills,
        "headline": request.headline,
        "bio": request.bio,
        "past_jobs": request.past_jobs,
        "connection_ids": request.connection_ids,
        "session_views": session_views_dicts,
        "viewed_ids": request.viewed_ids,
        "saved_ids": request.saved_ids,
        "applied_ids": request.applied_ids,
        "dismissed_categories": request.dismissed_categories,
        "preferred_categories": request.preferred_categories,
    }
    
    # Run the real-time adaptive ranking algorithm
    ranked_feed = feed_ranker.rank_feed(request.user_id, request.posts, user_context)
    
    print(f"✅ [Feed API] Returning {len(ranked_feed[:limit])} ranked items\n")
    
    return {
        "user_id": request.user_id,
        "feed": ranked_feed[:limit],
        "algorithm_version": "2.0-realtime",
        "features": [
            "semantic_relevance",
            "skill_overlap", 
            "session_aware_behavior",
            "network_boost",
            "trending_velocity",
            "freshness_decay",
            "quality_score",
            "category_fatigue",
            "diversity_control",
            "exploration_mechanism"
        ]
    }