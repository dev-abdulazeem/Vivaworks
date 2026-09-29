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

    def _job_text(self, job: Dict) -> str:
        """Combine title + description + skills for rich matching"""
        skills = job.get('skills') or []
        return f"{job.get('title', '')} {job.get('description', '')} {' '.join(str(s) for s in skills)}"

    def encode_jobs(self, jobs: List[Dict]):
        """
        REPLACE the whole job pool with these jobs and pre-compute embeddings.
        Use this for a full sync (e.g. all currently open jobs).
        """
        if not jobs:
            self.job_embeddings = None
            self.jobs_cache = []
            print("Cleared job pool (0 jobs)")
            return

        job_texts = [self._job_text(job) for job in jobs]
        self.job_embeddings = self.model.encode(job_texts, convert_to_tensor=True)
        self.jobs_cache = jobs
        print(f"Encoded {len(jobs)} jobs")

    def add_jobs(self, new_jobs: List[Dict]):
        """
        MERGE new/updated jobs into the existing pool (matched by id),
        then re-encode. Use this when a single job is posted.
        """
        merged = {j['id']: j for j in self.jobs_cache}
        for job in new_jobs:
            merged[job['id']] = job
        self.encode_jobs(list(merged.values()))

    def get_recommendations(self, user_profile: Dict, top_k: int = 10) -> List[Dict]:
        """Find best matching jobs for a user"""
        if self.job_embeddings is None or not self.jobs_cache:
            return []

        skills = user_profile.get('skills') or []
        categories = user_profile.get('preferred_categories') or []
        past_jobs = user_profile.get('past_jobs') or []

        # Create user profile text
        user_text = f"""
        Skills: {' '.join(str(s) for s in skills)}
        Bio: {user_profile.get('profile_bio', '')}
        Experience: {user_profile.get('experience_level', '')}
        Categories: {' '.join(str(c) for c in categories)}
        Past work: {' '.join(str(p) for p in past_jobs)}
        """

        # Encode user profile
        user_embedding = self.model.encode(user_text, convert_to_tensor=True)

        # Calculate similarity (cosine similarity)
        similarities = util.cos_sim(user_embedding, self.job_embeddings)[0]
        sim_values = similarities.cpu().numpy()

        # Get top matches (never ask for more than we have)
        top_k = max(1, min(top_k, len(self.jobs_cache)))
        top_indices = np.argsort(sim_values)[::-1][:top_k]

        recommendations = []
        for idx in top_indices:
            job = self.jobs_cache[int(idx)]
            score = float(sim_values[int(idx)])

            # Generate human-readable reasons
            reasons = self._explain_match(user_profile, job, score)

            recommendations.append({
                "job_id": job['id'],
                "title": job.get('title', ''),
                "match_score": round(score, 3),
                "match_reasons": reasons
            })

        return recommendations

    def _explain_match(self, user: Dict, job: Dict, score: float) -> List[str]:
        """Explain why this job matches (for transparency)"""
        reasons = []

        # Check skill overlap
        user_skills = set(str(s).lower() for s in (user.get('skills') or []))
        job_skills = set(str(s).lower() for s in (job.get('skills') or []))
        overlap = user_skills & job_skills

        if overlap:
            reasons.append(f"Skill match: {', '.join(list(overlap)[:3])}")

        if score > 0.7:
            reasons.append("Strong profile alignment")
        elif score > 0.5:
            reasons.append("Good category fit")

        required_level = job.get('required_level') or []
        if isinstance(required_level, str):
            required_level = [required_level]
        if user.get('experience_level') in required_level:
            reasons.append("Experience level match")

        return reasons if reasons else ["General profile relevance"]

# Singleton instance
recommender = JobRecommender()