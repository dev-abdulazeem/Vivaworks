from sentence_transformers import SentenceTransformer, util
import numpy as np
from typing import List, Dict

class JobRecommender:
    def __init__(self):
        # Load pre-trained model (downloads ~80MB first time)
        print("Loading recommendation model...")
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.job_embeddings = None
        self.jobs_cache = []
        
    def encode_jobs(self, jobs: List[Dict]):
        """Pre-compute job embeddings for fast matching"""
        # Combine title + description + skills for rich matching
        job_texts = [
            f"{job['title']} {job['description']} {' '.join(job.get('skills', []))}" 
            for job in jobs
        ]
        self.job_embeddings = self.model.encode(job_texts, convert_to_tensor=True)
        self.jobs_cache = jobs
        print(f"Encoded {len(jobs)} jobs")
        
    def get_recommendations(self, user_profile: Dict, top_k: int = 10) -> List[Dict]:
        """Find best matching jobs for a user"""
        if self.job_embeddings is None:
            return []
            
        # Create user profile text
        user_text = f"""
        Skills: {' '.join(user_profile['skills'])}
        Bio: {user_profile['profile_bio']}
        Experience: {user_profile['experience_level']}
        Categories: {' '.join(user_profile['preferred_categories'])}
        Past work: {' '.join(user_profile.get('past_jobs', []))}
        """
        
        # Encode user profile
        user_embedding = self.model.encode(user_text, convert_to_tensor=True)
        
        # Calculate similarity (cosine similarity)
        similarities = util.cos_sim(user_embedding, self.job_embeddings)[0]
        
        # Get top matches
        top_indices = np.argsort(similarities.cpu().numpy())[::-1][:top_k]
        
        recommendations = []
        for idx in top_indices:
            job = self.jobs_cache[idx]
            score = float(similarities[idx])
            
            # Generate human-readable reasons
            reasons = self._explain_match(user_profile, job, score)
            
            recommendations.append({
                "job_id": job['id'],
                "title": job['title'],
                "match_score": round(score, 3),
                "match_reasons": reasons
            })
            
        return recommendations
    
    def _explain_match(self, user: Dict, job: Dict, score: float) -> List[str]:
        """Explain why this job matches (for transparency)"""
        reasons = []
        
        # Check skill overlap
        user_skills = set([s.lower() for s in user['skills']])
        job_skills = set([s.lower() for s in job.get('skills', [])])
        overlap = user_skills & job_skills
        
        if overlap:
            reasons.append(f"Skill match: {', '.join(list(overlap)[:3])}")
            
        if score > 0.7:
            reasons.append("Strong profile alignment")
        elif score > 0.5:
            reasons.append("Good category fit")
            
        if user['experience_level'] in job.get('required_level', []):
            reasons.append("Experience level match")
            
        return reasons if reasons else ["General profile relevance"]

# Singleton instance
recommender = JobRecommender()