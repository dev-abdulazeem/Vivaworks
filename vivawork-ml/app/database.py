from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# SQLite database file
SQLALCHEMY_DATABASE_URL = "sqlite:///./viva_ml.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ReviewCase(Base):
    """Human review queue - AI creates cases, humans decide"""
    __tablename__ = "review_cases"
    
    id = Column(Integer, primary_key=True, index=True)
    case_type = Column(String, index=True)  # 'withdrawal', 'account_flag', 'verification'
    user_id = Column(String, index=True)    # Reference to your Node.js user ID
    risk_score = Column(Float)              # 0.0 to 1.0
    ai_reasoning = Column(Text)             # Why AI flagged this
    evidence = Column(Text)                 # JSON string of evidence
    status = Column(String, default="pending")  # pending, approved, rejected, escalated
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewer_id = Column(String, nullable=True)  # Which admin reviewed it
    final_decision = Column(String, nullable=True)  # Human's final call

class RiskLog(Base):
    """Audit trail for all AI decisions"""
    __tablename__ = "risk_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    action = Column(String)  # 'withdrawal_request', 'login', etc.
    risk_score = Column(Float)
    automated_action = Column(String)  # 'auto_approved', 'flagged_for_review', 'blocked'
    created_at = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()