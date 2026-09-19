from fastapi import APIRouter
from app.models.feed_ranker import feed_ranker
from app.schemas import JobRecommendationRequest

router = APIRouter()

@router.post("/feed")
async def get_feed(request: JobRecommendationRequest, limit: int = 20):
    """
    Get personalized job feed
    """
    # In production, fetch jobs from your Node.js database
    # For now, using mock data
    mock_jobs = [
        {
            "id": "job1",
            "title": "React Developer",
            "skills": ["React", "JavaScript"],
            "budget": 500,
            "posted_date": "2026-09-18T09:00:00",
            "client_rating": 4.8,
            "client_hire_rate": 0.9,
            "proposal_count": 5
        },
        {
            "id": "job2", 
            "title": "Python Script",
            "skills": ["Python", "Automation"],
            "budget": 200,
            "posted_date": "2026-09-17T15:00:00",
            "client_rating": 3.5,
            "client_hire_rate": 0.6,
            "proposal_count": 12
        }
    ]
    
    user_context = {
        "skills": request.skills,
        "past_jobs": request.past_jobs,
        "collaborative_scores": {}  # From your Node.js user behavior tracking
    }
    
    ranked_feed = feed_ranker.rank_feed(request.user_id, mock_jobs, user_context)
    
    return {
        "user_id": request.user_id,
        "feed": ranked_feed[:limit],
        "algorithm_version": "1.0"
    }