from sentence_transformers import SentenceTransformer, util
from typing import List, Dict


class FreelancerRecommender:
    # Similarity threshold for the skill gate (0.0 - 1.0)
    # Higher = stricter. 0.40 is a good starting point.
    SKILL_MATCH_THRESHOLD = 0.40

    def __init__(self):
        print("Loading freelancer recommendation model...")
        self.model = SentenceTransformer('all-MiniLM-L6-v2')

    # ────────────────────────── helpers ──────────────────────────

    @staticmethod
    def _skill_name(skill) -> str:
        """Skills may be strings or dicts like {'name': 'Python'}."""
        if isinstance(skill, dict):
            return str(skill.get('name', '') or skill.get('title', ''))
        return str(skill)

    def _freelancer_text(self, f: Dict) -> str:
        """Combine profile data for rich semantic matching."""
        skills = [self._skill_name(s) for s in (f.get('skills') or [])]
        portfolio = f.get('portfolio_items') or []
        portfolio_titles = ' '.join(str(p.get('title', '')) for p in portfolio)
        return f"{f.get('title', '')} {f.get('bio', '')} {' '.join(skills)} {portfolio_titles}"

    # ─────────────────────── skill gate ───────────────────────

    def _semantic_skill_filter(self, query: str, freelancers: List[Dict]) -> List[Dict]:
        """
        Keep only freelancers who have at least one skill that is
        semantically similar to the search query.

        'web developer' matches React / Node.js / HTML,
        but NOT 'video editing' or 'content creation'.
        """
        # Collect every unique skill name across all candidates (encode once)
        unique_skills = list({
            name
            for f in freelancers
            for name in (self._skill_name(s) for s in (f.get('skills') or []))
            if name.strip()
        })

        if not unique_skills:
            return []

        query_emb = self.model.encode(query, convert_to_tensor=True)
        skill_embs = self.model.encode(unique_skills, convert_to_tensor=True)
        sims = util.cos_sim(query_emb, skill_embs)[0]

        # skill name -> similarity score with the query
        skill_sim = dict(zip(unique_skills, sims.cpu().tolist()))

        qualified = []
        for f in freelancers:
            skills = [self._skill_name(s) for s in (f.get('skills') or [])]
            if not skills:
                continue
            best = max(skill_sim.get(s, 0.0) for s in skills)
            if best >= self.SKILL_MATCH_THRESHOLD:
                f["_best_skill_sim"] = round(best, 3)  # debug/calibration info
                qualified.append(f)

        return qualified

    # ────────────────────────── ranking ──────────────────────────

    def rank_freelancers(
        self,
        query: str,
        freelancers: List[Dict],
        require_skill_match: bool = True,
    ) -> List[Dict]:
        if not freelancers:
            return []

        # ── HARD GATE: drop off-topic freelancers BEFORE scoring ──
        if require_skill_match:
            candidates = self._semantic_skill_filter(query, freelancers)
            if not candidates:
                return []  # nobody qualified → honest empty result
        else:
            candidates = freelancers

        # Encode search query
        query_embedding = self.model.encode(query, convert_to_tensor=True)

        # Encode only the qualified profiles
        freelancer_texts = [self._freelancer_text(f) for f in candidates]
        freelancer_embeddings = self.model.encode(freelancer_texts, convert_to_tensor=True)

        # Base semantic similarity
        similarities = util.cos_sim(query_embedding, freelancer_embeddings)[0]
        sim_values = similarities.cpu().numpy()

        ranked = []
        for i, f in enumerate(candidates):
            base_score = float(sim_values[i])

            # Normalize factors to 0.0 - 1.0 scale
            rating = min(f.get('rating', 0) / 5.0, 1.0)
            completed_jobs = min(f.get('completed_jobs', 0) / 50.0, 1.0)  # caps at 50 jobs
            response_rate = min(f.get('response_rate', 0) / 100.0, 1.0)
            profile_completeness = min(f.get('profile_completeness', 0) / 100.0, 1.0)
            is_available = 1.0 if f.get('is_available', False) else 0.0
            recent_activity = 1.0 if f.get('is_active', False) else 0.0
            reliability = min(f.get('reliability_score', 0) / 100.0, 1.0)

            # Weighted final score
            final_score = (
                base_score * 0.40 +           # Skill & Portfolio match
                rating * 0.15 +               # Reviews and rating
                completed_jobs * 0.10 +       # Job history
                response_rate * 0.05 +        # Response rate
                profile_completeness * 0.05 + # Profile completeness
                is_available * 0.10 +         # Availability
                recent_activity * 0.05 +      # Recent activities
                reliability * 0.10            # Reliability
            )

            ranked.append({
                "id": f['id'],
                "match_score": round(final_score, 3),
                "base_similarity": round(base_score, 3),
                "best_skill_similarity": f.get("_best_skill_sim"),
            })

        ranked.sort(key=lambda x: x['match_score'], reverse=True)
        return ranked


# Singleton instance
freelancer_recommender = FreelancerRecommender()