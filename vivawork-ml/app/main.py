from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import recommendations, risk, review

app = FastAPI(
    title="VivaWork ML Service",
    description="AI models for job matching and risk assessment",
    version="1.0.0"
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

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "vivawork-ml"}