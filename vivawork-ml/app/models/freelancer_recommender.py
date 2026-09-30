from sentence_transformers import SentenceTransformer, util
import numpy as np
from typing import List, Dict

class FreelancerRecommender:
    def __init__(self):
        print("Loading freelancer recommendation model...")
        self.model = SentenceTransformer('all-MiniLM-L6-v2')

    def _freelancer_text(self, f: Dict) -> str:
        """Combine profile data for rich semantic matching"""
        skills = f.get('skills') or []
        portfolio = f.get('portfolio_items') or []
        return f"{f.get('title', '')} {f.get('bio', '')} {' '.join(str(s) for s in skills)} {' '.join(str(p.get('title', '')) for p in portfolio)}"

    def rank_freelancers(self, query: str, freelancers: List[Dict]) -> List[Dict]:
        if not freelancers:
            return []
        
        # Encode search query
        query_embedding = self.model.encode(query, convert_to_tensor=True)
        
        # Encode freelancer profiles
        freelancer_texts = [self._freelancer_text(f) for f in freelancers]
        freelancer_embeddings = self.model.encode(freelancer_texts, convert_to_tensor=True)
        
        # Calculate base semantic similarity
        similarities = util.cos_sim(query_embedding, freelancer_embeddings)[0]
        sim_values = similarities.cpu().numpy()
        
        ranked = []
        for i, f in enumerate(freelancers):
            base_score = float(sim_values[i])
            
            # Normalize factors to 0.0 - 1.0 scale
            rating = min(f.get('rating', 0) / 5.0, 1.0)
            completed_jobs = min(f.get('completed_jobs', 0) / 50.0, 1.0) # Caps at 50 jobs
            response_rate = min(f.get('response_rate', 0) / 100.0, 1.0)
            profile_completeness = min(f.get('profile_completeness', 0) / 100.0, 1.0)
            is_available = 1.0 if f.get('is_available', False) else 0.0
            recent_activity = 1.0 if f.get('is_active', False) else 0.0
            reliability = min(f.get('reliability_score', 0) / 100.0, 1.0)
            
            # Weighted final score based on your requirements
            final_score = (
                base_score * 0.40 +          # Skill & Portfolio match
                rating * 0.15 +              # Reviews and rating
                completed_jobs * 0.10 +      # Job history
                response_rate * 0.05 +       # Response rate
                profile_completeness * 0.05 + # Profile completeness
                is_available * 0.10 +        # Availability
                recent_activity * 0.05 +     # Recent activities
                reliability * 0.10           # Reliability
            )
            
            ranked.append({
                "id": f['id'],
                "match_score": round(final_score, 3),
                "base_similarity": round(base_score, 3)
            })
            
        # Sort by final score descending
        ranked.sort(key=lambda x: x['match_score'], reverse=True)
        return ranked

# Singleton instance
freelancer_recommender = FreelancerRecommender()