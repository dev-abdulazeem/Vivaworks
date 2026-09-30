// freelancer.controller.js
const { prisma } = require('../config/database');
const mlService = require('../services/mlService');

const searchFreelancers = async (req, res) => {
  try {
    const { query, skills, maxRate, page = 1, limit = 20 } = req.query;

    // 1. FIX: Exclude admins from freelancer search results
    const where = { 
      isFreelancer: true,
      isAdmin: false 
    };

    if (skills) {
      const skillArray = Array.isArray(skills) ? skills : skills.split(',');
      where.skills = { hasSome: skillArray };
    }
    
    if (maxRate) {
      where.hourlyRate = { lte: parseFloat(maxRate) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch freelancers using ONLY fields confirmed to exist in your Prisma schema
    const freelancers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        headline: true,
        bio: true,
        skills: true,
        hourlyRate: true,
        isOnline: true,
        lastActive: true,
        updatedAt: true,
        profile: {
          select: {
            portfolio: true,
          }
        },
        reviewsReceived: {
          select: {
            rating: true,
          }
        },
        _count: {
          select: {
            contracts: { where: { status: 'completed' } },
          }
        }
      },
      skip,
      take: parseInt(limit) * 2, // Fetch extra to allow ML to rank and slice
    });

    if (freelancers.length === 0) {
      return res.status(200).json({ freelancers: [], total: 0, ml_powered: false });
    }

    // Format data for the Python ML service with smart, schema-accurate calculations
    const freelancersForML = freelancers.map(f => {
      // 1. Calculate dynamic rating from actual reviews (fallback to 4.5 if none)
      const reviews = f.reviewsReceived || [];
      const rating = reviews.length > 0 
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
        : 4.5;

      // 2. Calculate profile completeness dynamically based on existing fields
      let profileCompleteness = 0;
      if (f.headline) profileCompleteness += 20;
      if (f.bio) profileCompleteness += 20;
      if (f.avatar) profileCompleteness += 20;
      if (f.skills && f.skills.length > 0) profileCompleteness += 20;
      if (f.hourlyRate) profileCompleteness += 20;

      // 3. Determine availability and activity based on real timestamps
      const lastActiveDate = f.lastActive ? new Date(f.lastActive) : new Date(f.updatedAt);
      const isActive = f.isOnline || ((new Date() - lastActiveDate) < 7 * 24 * 60 * 60 * 1000);
      const isAvailable = f.isOnline || true; 

      // 4. Calculate reliability score based on completed contracts
      const completedJobs = f._count?.contracts || 0;
      const reliabilityScore = Math.min(70 + (completedJobs * 3), 100); // Base 70, +3 per completed job, max 100

      return {
        id: f.id,
        title: f.headline || '',
        bio: f.bio || '',
        skills: f.skills || [],
        portfolio_items: f.profile?.portfolio || [],
        rating: parseFloat(rating.toFixed(1)),
        completed_jobs: completedJobs,
        response_rate: 90, // Safe fallback
        profile_completeness: profileCompleteness,
        is_available: isAvailable,
        is_active: isActive,
        reliability_score: reliabilityScore,
      };
    });

    let rankedFreelancers = [];
    let mlPowered = false;

    // 2. FIX: Only run ML semantic matching if the user ACTUALLY searched for something
    const hasSearchIntent = (query && query.trim().length > 0) || (skills && skills.trim().length > 0);

    if (hasSearchIntent) {
      // User searched: Use ML to rank based on query + all other factors
      const searchQuery = query || skills.replace(/,/g, ' ');
      
      const mlRankings = await mlService.getFreelancerRecommendations(searchQuery, freelancersForML);
      const rankMap = new Map(mlRankings.map(r => [r.id, r]));

      rankedFreelancers = freelancers
        .map(f => {
          const mlData = freelancersForML.find(ml => ml.id === f.id) || {};
          return { 
            ...f, 
            match_score: rankMap.get(f.id)?.match_score || 0, // Real match score
            rating: mlData.rating || 4.5,
            responseRate: 90,
            reliabilityScore: mlData.reliability_score || 85,
            portfolio: f.profile?.portfolio || null,
            completedJobsCount: f._count?.contracts || 0,
          };
        })
        .filter(f => rankMap.has(f.id))
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, parseInt(limit));
        
      mlPowered = true;
    } else {
      // NO search intent: Sort by default "Top Freelancers" logic
      // and set match_score to null so the frontend DOES NOT show a fake percentage badge
      rankedFreelancers = freelancers
        .map(f => {
          const mlData = freelancersForML.find(ml => ml.id === f.id) || {};
          return { 
            ...f, 
            match_score: null, // <-- FIX: Hides the match badge in the UI
            rating: mlData.rating || 4.5,
            responseRate: 90,
            reliabilityScore: mlData.reliability_score || 85,
            portfolio: f.profile?.portfolio || null,
            completedJobsCount: f._count?.contracts || 0,
          };
        })
        .sort((a, b) => {
          // 1. Online status first
          if (a.isOnline !== b.isOnline) return b.isOnline ? 1 : -1;
          // 2. Then by rating
          if (b.rating !== a.rating) return b.rating - a.rating;
          // 3. Then by completed jobs (experience)
          return b.completedJobsCount - a.completedJobsCount;
        })
        .slice(0, parseInt(limit));
        
      mlPowered = false;
    }

    return res.status(200).json({
      freelancers: rankedFreelancers,
      total: rankedFreelancers.length,
      ml_powered: mlPowered
    });

  } catch (error) {
    console.error('Search freelancers error:', error);
    return res.status(500).json({ message: 'Failed to search freelancers', code: 'SEARCH_ERROR' });
  }
};

module.exports = { searchFreelancers };