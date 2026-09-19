from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import recommendations, risk, review, verification, feed

app = FastAPI(
    title="VivaWork ML Service",
    description="AI models for job matching, risk assessment, ID verification, and feed ranking",
    version="1.1.0"
)

# Allow your Node.js app to call this (adjust port as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],  # Your Node.js ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(recommendations.router, prefix="/ml", tags=["recommendations"])
app.include_router(risk.router, prefix="/ml/risk", tags=["risk"])
app.include_router(review.router, prefix="/ml/review", tags=["human-review"])
app.include_router(verification.router, prefix="/ml/verify", tags=["verification"])
app.include_router(feed.router, prefix="/ml/feed", tags=["feed"])

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "vivawork-ml", "version": "1.1.0"}