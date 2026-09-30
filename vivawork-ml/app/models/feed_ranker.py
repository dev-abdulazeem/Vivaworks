from datetime import datetime, timezone
from typing import List, Dict, Set
import numpy as np
from sentence_transformers import SentenceTransformer, util
import random

class FeedRanker:
    def __init__(self):
        print("🔄 [FeedRanker] Loading real-time adaptive ranking model...")
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        print("✅ [FeedRanker] Model loaded successfully!")
        
        # Dynamic weights that adjust based on user engagement patterns
        self.base_weights = {
            "semantic_relevance": 0.25,
            "skill_overlap": 0.15,
            "behavioral_match": 0.20,
            "network_boost": 0.15,      # NEW: Content from connections
            "trending_velocity": 0.10,  # NEW: Real-time engagement speed
            "freshness": 0.08,
            "quality": 0.07
        }
        
        # Diversity control: max items per category to prevent filter bubbles
        self.max_per_category = 3
        self.exploration_rate = 0.15  # 15% random exploration

    def rank_feed(self, user_id: str, items: List[Dict], user_context: Dict) -> List[Dict]:
        print(f"\n{'='*70}")
        print(f"🚀 [FeedRanker] Real-time ranking for User: {user_id}")
        print(f"📦 [FeedRanker] Received {len(items)} items to rank")
        
        if not items:
            print("⚠️ [FeedRanker] No items provided. Returning empty list.")
            return []

        # Extract user context
        user_skills_list = user_context.get('skills', [])
        connection_ids = set(str(c) for c in user_context.get("connection_ids", []))
        session_views = user_context.get("session_views", [])  # Views in current session
        viewed_ids = set(str(v) for v in user_context.get("viewed_ids", []))
        saved_ids = set(str(s) for s in user_context.get("saved_ids", []))
        applied_ids = set(str(a) for a in user_context.get("applied_ids", []))
        dismissed_cats = set(str(c).lower() for c in user_context.get("dismissed_categories", []))
        user_skills = set(str(s).lstrip("#").lower() for s in user_skills_list)
        
        print(f"👤 [FeedRanker] Context -> Skills: {len(user_skills)} | Connections: {len(connection_ids)} | Session Views: {len(session_views)}")

        # Pre-compute embeddings
        user_text = f"{user_context.get('headline', '')} {user_context.get('bio', '')} {' '.join(user_skills_list)}"
        user_embedding = self.model.encode(user_text, convert_to_tensor=True)
        
        item_texts = [
            f"{item.get('title', '')} {item.get('description', '')} {' '.join(item.get('skills', []))}" 
            if item.get('type') == 'job' 
            else f"{item.get('content', '')} {' '.join(item.get('hashtags', []))}"
            for item in items
        ]
        item_embeddings = self.model.encode(item_texts, convert_to_tensor=True)
        semantic_similarities = util.cos_sim(user_embedding, item_embeddings)[0].cpu().numpy()

        # Calculate trending velocity for all items (real-time engagement speed)
        trending_scores = self._calculate_trending_velocity(items)
        
        # Calculate category fatigue (penalize if user keeps seeing same category)
        category_fatigue = self._calculate_category_fatigue(session_views, items)

        scored_items = []
        category_counts = {}  # Track items per category for diversity

        for idx, item in enumerate(items):
            item_id = str(item.get("id"))
            item_type = item.get("type", "job")
            item_category = str(item.get("category", "general")).lower()
            author_id = str(item.get("author_id", ""))
            
            # Hard filter: dismissed categories
            if item_category in dismissed_cats:
                continue
            
            # Diversity control: skip if we already have max items from this category
            if category_counts.get(item_category, 0) >= self.max_per_category:
                # Allow 20% chance to still include for exploration
                if random.random() > 0.2:
                    continue

            score = 0.0
            breakdown = {}

            # 1. SEMANTIC RELEVANCE
            sem_score = float(semantic_similarities[idx])
            sem_score = (sem_score + 1) / 2  # Normalize to [0, 1]
            score += sem_score * self.base_weights["semantic_relevance"]
            breakdown["semantic"] = round(sem_score, 3)

            # 2. SKILL OVERLAP
            item_skills = set(str(s).lstrip("#").lower() for s in item.get("skills", []))
            if user_skills and item_skills:
                intersection = len(user_skills & item_skills)
                union = len(user_skills | item_skills)
                skill_score = intersection / union if union > 0 else 0.0
            else:
                skill_score = 0.0
            score += skill_score * self.base_weights["skill_overlap"]
            breakdown["skills"] = round(skill_score, 3)

            # 3. BEHAVIORAL MATCH (Session-aware)
            behavior_score = self._calculate_behavioral_score(
                item_id, viewed_ids, saved_ids, applied_ids, session_views
            )
            score += behavior_score * self.base_weights["behavioral_match"]
            breakdown["behavior"] = round(behavior_score, 3)

            # 4. NETWORK BOOST (Real-time: content from connections ranks higher)
            network_score = 1.0 if author_id in connection_ids else 0.0
            score += network_score * self.base_weights["network_boost"]
            breakdown["network"] = round(network_score, 3)

            # 5. TRENDING VELOCITY (Real-time engagement speed)
            trending_score = trending_scores.get(item_id, 0.0)
            score += trending_score * self.base_weights["trending_velocity"]
            breakdown["trending"] = round(trending_score, 3)

            # 6. FRESHNESS (Time decay)
            days_old = self._get_days_old(item.get("posted_date", datetime.now(timezone.utc)))
            freshness = max(0.0, 1.0 - (days_old / 14.0))
            score += freshness * self.base_weights["freshness"]
            breakdown["freshness"] = round(freshness, 3)

            # 7. QUALITY
            if item_type == "job":
                client_rating = item.get("client_rating", 3.0)
                rating_score = min(client_rating / 5.0, 1.0)
                verified_bonus = 0.15 if item.get("client_verified") else 0.0
                quality_score = min(rating_score + verified_bonus, 1.0)
            else:
                engagement = min((item.get("engagement_score") or 0) / 10, 1.0)
                verified_bonus = 0.25 if item.get("author_verified") else 0.0
                quality_score = min(engagement + verified_bonus, 1.0)
            score += quality_score * self.base_weights["quality"]
            breakdown["quality"] = round(quality_score, 3)

            # 8. CATEGORY FATIGUE PENALTY (Real-time: reduce if user keeps seeing same type)
            fatigue_penalty = category_fatigue.get(item_category, 0.0)
            score -= fatigue_penalty * 0.15  # Max 15% penalty
            breakdown["fatigue"] = round(-fatigue_penalty * 0.15, 3)

            # 9. EXPLORATION (Epsilon-greedy: 15% chance for random boost)
            if random.random() < self.exploration_rate:
                exploration_bonus = random.uniform(0.05, 0.15)
                score += exploration_bonus
                breakdown["exploration"] = round(exploration_bonus, 3)

            scored_items.append({
                **item,
                "feed_score": round(score, 4),
                "score_breakdown": breakdown,
                "_category": item_category  # For diversity tracking
            })
            
            category_counts[item_category] = category_counts.get(item_category, 0) + 1

        # Sort by score
        ranked = sorted(scored_items, key=lambda x: x["feed_score"], reverse=True)
        
        # Remove internal tracking field
        for item in ranked:
            item.pop("_category", None)

        # Print top 5 for debugging
        print(f"\n🏆 [FeedRanker] Top 5 Ranked Items:")
        for i, top_item in enumerate(ranked[:5]):
            item_preview = top_item.get('content', top_item.get('title', ''))[:50]
            print(f"   #{i+1} | Score: {top_item['feed_score']:.4f} | ID: {top_item.get('id')}")
            print(f"        ↳ Preview: '{item_preview}...'")
            print(f"        ↳ Breakdown: {top_item['score_breakdown']}")
        print(f"{'='*70}\n")
        
        return ranked

    def _calculate_behavioral_score(self, item_id: str, viewed_ids: Set, saved_ids: Set, 
                                     applied_ids: Set, session_views: List) -> float:
        """Session-aware behavioral scoring with time decay"""
        score = 0.0
        
        # Base behavioral score
        if item_id in applied_ids:
            score = 1.0
        elif item_id in saved_ids:
            score = 0.9
        elif item_id in viewed_ids:
            score = 0.6
        
        # Session boost: if viewed in current session, boost based on recency
        session_view_times = [v for v in session_views if str(v.get('item_id')) == item_id]
        if session_view_times:
            # More recent views in session = higher boost
            session_bonus = 0.2 * len(session_view_times)  # Max 0.6 for 3+ views
            score = min(score + session_bonus, 1.0)
        
        return score

    def _calculate_trending_velocity(self, items: List[Dict]) -> Dict[str, float]:
        """Calculate real-time engagement velocity (likes/comments per hour)"""
        trending_scores = {}
        
        for item in items:
            item_id = str(item.get("id"))
            posted_date = item.get("posted_date", datetime.now(timezone.utc))
            
            if isinstance(posted_date, str):
                posted_date = datetime.fromisoformat(posted_date.replace('Z', '+00:00'))
            if posted_date.tzinfo is None:
                posted_date = posted_date.replace(tzinfo=timezone.utc)
            
            hours_old = max(1, (datetime.now(timezone.utc) - posted_date).total_seconds() / 3600)
            
            # Calculate engagement velocity
            engagement = (
                item.get("likes", 0) + 
                item.get("comments", 0) * 2 +  # Comments weight more
                item.get("shares", 0) * 3      # Shares weight most
            )
            
            velocity = engagement / hours_old  # Engagements per hour
            
            # Normalize to [0, 1] (assume 10 engagements/hour is max trending)
            trending_scores[item_id] = min(velocity / 10.0, 1.0)
        
        return trending_scores

    def _calculate_category_fatigue(self, session_views: List, items: List[Dict]) -> Dict[str, float]:
        """Detect if user is seeing too much of same category in current session"""
        category_counts = {}
        
        # Count categories viewed in current session
        for view in session_views:
            category = str(view.get('category', 'general')).lower()
            category_counts[category] = category_counts.get(category, 0) + 1
        
        # Calculate fatigue score (more views = more fatigue)
        fatigue_scores = {}
        for category, count in category_counts.items():
            # After 3 views of same category, start penalizing
            if count > 3:
                fatigue_scores[category] = min((count - 3) * 0.2, 1.0)
        
        return fatigue_scores

    def _get_days_old(self, posted_date) -> float:
        if isinstance(posted_date, str):
            posted_date = datetime.fromisoformat(posted_date.replace('Z', '+00:00'))
        if posted_date.tzinfo is None:
            posted_date = posted_date.replace(tzinfo=timezone.utc)
        return max(0.0, (datetime.now(timezone.utc) - posted_date).days)

# Singleton
feed_ranker = FeedRanker()