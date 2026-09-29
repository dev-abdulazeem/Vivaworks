from datetime import datetime, timezone
from typing import List, Dict
import numpy as np

class FeedRanker:
    def __init__(self):
        # Weights for ranking factors (tune these based on your metrics)
        self.weights = {
            "relevance": 0.35,      # How well job matches user skills
            "freshness": 0.25,      # Newer jobs rank higher
            "engagement": 0.20,     # Client history, job fill rate
            "budget": 0.15,         # Higher budget = more visibility
            "user_history": 0.05    # Based on past clicks/applications
        }
    
    def rank_feed(self, user_id: str, jobs: List[Dict], user_context: Dict) -> List[Dict]:
        """
        Rank jobs/posts for user's feed
        jobs: list of dicts with title, skills, posted_date and either
              job fields (budget, client_rating, ...) or post fields
              (engagement_score, author_verified)
        user_context: user skills, past clicks, saved jobs, etc.
        """
        scored_jobs = []
        
        for job in jobs:
            score = 0
            
            # 1. Relevance score (skills match)
            relevance = self._calculate_relevance(user_context.get("skills", []), job.get("skills", []))
            score += relevance * self.weights["relevance"]
            
            # 2. Freshness (decay over 7 days)
            days_old = self._get_days_old(job.get("posted_date", datetime.now(timezone.utc)))
            freshness = max(0, 1 - (days_old / 7))
            score += freshness * self.weights["freshness"]
            
            # 3. Engagement (client quality / post engagement)
            engagement = self._calculate_engagement(job)
            score += engagement * self.weights["engagement"]
            
            # 4. Budget attractiveness
            budget_score = min((job.get("budget") or 0) / 1000, 1.0)  # Normalize to 0-1
            score += budget_score * self.weights["budget"]
            
            # 5. Collaborative filtering (users like you liked this)
            collab_score = user_context.get("collaborative_scores", {}).get(job.get("id"), 0.5)
            score += collab_score * self.weights["user_history"]
            
            scored_jobs.append({
                **job,
                "feed_score": round(score, 3),
                "breakdown": {
                    "relevance": round(relevance, 2),
                    "freshness": round(freshness, 2),
                    "engagement": round(engagement, 2),
                    "budget": round(budget_score, 2)
                }
            })
        
        # Sort by score descending
        ranked = sorted(scored_jobs, key=lambda x: x["feed_score"], reverse=True)
        return ranked
    
    def _calculate_relevance(self, user_skills: List[str], job_skills: List[str]) -> float:
        """Calculate skill overlap (hashtags like #React match the skill React)"""
        if not user_skills or not job_skills:
            return 0.5
        
        user_set = set(str(s).lstrip("#").lower() for s in user_skills)
        job_set = set(str(s).lstrip("#").lower() for s in job_skills)
        
        intersection = len(user_set & job_set)
        union = len(user_set | job_set)
        
        return intersection / union if union > 0 else 0
    
    def _get_days_old(self, posted_date) -> float:
        """Calculate days since posted (timezone-safe)"""
        if isinstance(posted_date, str):
            posted_date = datetime.fromisoformat(posted_date.replace('Z', '+00:00'))
        # Treat naive datetimes as UTC so they can be compared
        if posted_date.tzinfo is None:
            posted_date = posted_date.replace(tzinfo=timezone.utc)
        return max(0, (datetime.now(timezone.utc) - posted_date).days)
    
    def _calculate_engagement(self, job: Dict) -> float:
        """Client quality score for jobs, or engagement score for posts"""
        # Post items (sent from the Node feed controller)
        if "engagement_score" in job or "author_verified" in job:
            engagement = min((job.get("engagement_score") or 0) / 10, 1.0)
            verified_bonus = 0.2 if job.get("author_verified") else 0
            return min(engagement + verified_bonus, 1.0)
        
        # Job items
        client_rating = job.get("client_rating", 3.0)  # Default 3 stars
        hire_rate = job.get("client_hire_rate", 0.5)   # Default 50%
        
        # Normalize rating to 0-1
        rating_score = (client_rating / 5.0)
        
        # Penalize jobs with many proposals (competition)
        proposals = job.get("proposal_count", 0)
        competition_penalty = min(proposals / 50, 0.3)  # Max 30% penalty
        
        return (rating_score * 0.6 + hire_rate * 0.4) - competition_penalty

# Singleton
feed_ranker = FeedRanker()