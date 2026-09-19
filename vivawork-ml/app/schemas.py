from pydantic import BaseModel, Field
from typing import List, Optional, Dict


# ============================================================
# JOB MODEL
# Used when loading jobs into the ML recommendation system
# ============================================================

class Job(BaseModel):
    id: str
    title: str
    description: str
    skills: List[str]
    required_level: List[str]


# ============================================================
# WITHDRAWAL RISK
# Request from Node.js when a user requests a withdrawal
# ============================================================

class WithdrawalRequest(BaseModel):
    user_id: str
    amount: float
    currency: str = "USD"

    # Only the last 4 digits should be sent to the ML service
    bank_account_last4: str

    user_country: str
    account_age_days: int
    total_earnings: float
    withdrawal_count_30d: int
    avg_withdrawal_amount: float

    # Optional fraud/risk signals
    device_fingerprint: Optional[str] = None
    ip_address: Optional[str] = None


# ============================================================
# JOB RECOMMENDATION REQUEST
# Sent when a freelancer wants personalized job recommendations
# ============================================================

class JobRecommendationRequest(BaseModel):
    user_id: str

    # Skills the freelancer has
    skills: List[str]

    # Freelancer profile description
    profile_bio: str

    # Categories the freelancer prefers
    preferred_categories: List[str]

    # beginner / intermediate / expert
    experience_level: str

    # Job titles the freelancer has completed before
    past_jobs: List[str] = Field(default_factory=list)


# ============================================================
# RISK ASSESSMENT RESPONSE
# Returned by the withdrawal/account risk system
# ============================================================

class RiskAssessment(BaseModel):
    risk_score: float

    # auto_approve / requires_review / block
    decision: str

    flags: List[str]

    reasoning: str


# ============================================================
# JOB RECOMMENDATION RESPONSE
# Returned for each recommended job
# ============================================================

class JobRecommendation(BaseModel):
    job_id: str
    title: str
    match_score: float
    match_reasons: List[str]


# ============================================================
# HUMAN REVIEW CASE
# Used when an AI decision needs human review
# ============================================================

class ReviewCaseCreate(BaseModel):
    case_type: str
    user_id: str
    risk_score: float
    ai_reasoning: str
    evidence: Dict


# ============================================================
# HUMAN REVIEW DECISION
# ============================================================

class ReviewDecision(BaseModel):
    case_id: int
    reviewer_id: str

    # approve / reject / escalate
    decision: str

    notes: Optional[str] = None