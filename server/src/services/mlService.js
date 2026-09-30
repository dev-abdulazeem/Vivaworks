const axios = require('axios');

// Configuration
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const mlApi = axios.create({
  baseURL: `${ML_SERVICE_URL}/ml`,
  timeout: 30000, // 30 seconds (ML models can be slow)
  headers: {
    'Content-Type': 'application/json'
  }
});

// Log requests in development
if (process.env.NODE_ENV === 'development') {
  mlApi.interceptors.request.use(request => {
    console.log(`[ML Request] ${request.method?.toUpperCase()} ${request.url}`);
    return request;
  });
}

class MLService {
  // ==========================================
  // JOB RECOMMENDATIONS
  // ==========================================
  async getJobRecommendations(userProfile) {
    try {
      const response = await mlApi.post('/jobs/recommend', {
        user_id: userProfile.id,
        skills: userProfile.skills || [],
        profile_bio: userProfile.bio || '',
        preferred_categories: userProfile.categories || [],
        experience_level: userProfile.experienceLevel || 'beginner',
        past_jobs: userProfile.completedJobs || []
      });
      return response.data.recommendations;
    } catch (error) {
      console.error('ML Recommendation Error:', error.message);
      return [];
    }
  }

  async loadJobs(jobs, replace = false) {
    try {
      const response = await mlApi.post('/jobs/load', jobs, {
        params: { replace }
      });
      return response.data;
    } catch (error) {
      console.error('ML Load Jobs Error:', error.message);
      throw error;
    }
  }

  // ==========================================
  // FREELANCER RECOMMENDATIONS (For Buyers)
  // ==========================================
  async getFreelancerRecommendations(query, freelancers) {
    try {
      const response = await mlApi.post('/freelancers/recommend', {
        query,
        freelancers
      });
      return response.data.recommendations || [];
    } catch (error) {
      console.error('ML Freelancer Recommendation Error:', error.message);
      return [];
    }
  }

  // ==========================================
  // RISK ASSESSMENT (Withdrawals)
  // ==========================================
  async assessWithdrawal(withdrawalData) {
    try {
      const response = await mlApi.post('/risk/withdrawal/assess', {
        user_id: withdrawalData.userId,
        amount: withdrawalData.amount,
        currency: withdrawalData.currency || 'USD',
        bank_account_last4: withdrawalData.bankLast4,
        user_country: withdrawalData.country,
        account_age_days: withdrawalData.accountAgeDays,
        total_earnings: withdrawalData.totalEarnings,
        withdrawal_count_30d: withdrawalData.recentWithdrawalCount,
        avg_withdrawal_amount: withdrawalData.avgWithdrawalAmount,
        hour_of_day: new Date().getHours()
      });
      const assessment = response.data;

      switch (assessment.decision) {
        case 'auto_approve':
          return { approved: true, autoProcess: true, riskScore: assessment.risk_score, message: 'Withdrawal approved by AI' };
        case 'requires_review':
        case 'pending_human_review':
          return { approved: false, autoProcess: false, requiresReview: true, riskScore: assessment.risk_score, reasoning: assessment.reasoning, message: 'Withdrawal queued for manual review' };
        case 'block':
        case 'blocked_pending_review':
          return { approved: false, autoProcess: false, blocked: true, riskScore: assessment.risk_score, reasoning: assessment.reasoning, flags: assessment.flags, message: 'Withdrawal blocked by security system' };
        default:
          return { approved: false, autoProcess: false, error: 'Unknown decision from ML service' };
      }
    } catch (error) {
      console.error('Risk Assessment Error:', error.message);
      return { approved: false, autoProcess: false, requiresReview: true, error: 'Security system temporarily unavailable', message: 'Withdrawal queued for manual review (system check failed)' };
    }
  }

  // ==========================================
  // ACCOUNT FLAGGING
  // ==========================================
  async flagAccount(userId, reason, evidence) {
    try {
      const response = await mlApi.post('/risk/account/flag', null, {
        params: { user_id: userId, reason: reason },
        data: evidence
      });
      return response.data;
    } catch (error) {
      console.error('Flag Account Error:', error.message);
      throw error;
    }
  }

  // ==========================================
  // ADMIN REVIEW
  // ==========================================
  async getPendingReviews() {
    try {
      const response = await mlApi.get('/review/cases/pending');
      return response.data;
    } catch (error) {
      console.error('Get Reviews Error:', error.message);
      return { count: 0, cases: [] };
    }
  }

  async submitReviewDecision(caseId, reviewerId, decision, notes = '') {
    try {
      const response = await mlApi.post('/review/cases/decide', {
        case_id: caseId,
        reviewer_id: reviewerId,
        decision: decision,
        notes: notes
      });
      return response.data;
    } catch (error) {
      console.error('Review Decision Error:', error.message);
      throw error;
    }
  }

  // ==========================================
  // ID VERIFICATION
  // ==========================================
  async verifyId(userId, idDocumentBuffer, selfieBuffer) {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('user_id', userId);
      form.append('id_document', idDocumentBuffer, { filename: 'id.jpg' });
      form.append('selfie', selfieBuffer, { filename: 'selfie.jpg' });
      const response = await mlApi.post('/verify/id', form, {
        headers: form.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('ID Verification Error:', error.message);
      throw error;
    }
  }

  // ==========================================
  // FEED ALGORITHM (UPDATED WITH RICH REAL-TIME CONTEXT)
  // ==========================================
  async getFeed(userProfile, posts, limit = 20) {
    try {
      const response = await mlApi.post('/feed', {
        // Foolproof user_id mapping to prevent 422 errors
        user_id: userProfile.user_id || userProfile.id,
        
        skills: userProfile.skills || [],
        headline: userProfile.headline || '',
        bio: userProfile.bio || userProfile.profile_bio || '',
        preferred_categories: userProfile.preferred_categories || userProfile.categories || [],
        experience_level: userProfile.experienceLevel || 'beginner',
        past_jobs: userProfile.completedJobs || userProfile.past_jobs || [],
        
        // Real-time behavioral context (Required by advanced feed_ranker.py)
        connection_ids: userProfile.connection_ids || [],
        session_views: userProfile.session_views || [],
        viewed_ids: userProfile.viewed_ids || [],
        saved_ids: userProfile.saved_ids || [],
        applied_ids: userProfile.applied_ids || [],
        dismissed_categories: userProfile.dismissed_categories || [],
        
        // Posts to rank
        posts: posts || []
      }, {
        params: { limit }
      });
      return response.data.feed;
    } catch (error) {
      console.error('Feed Ranking Error:', error.message);
      return posts; // Fail gracefully: return unranked posts
    }
  }

  // ==========================================
  // GEO INTELLIGENCE & NETWORK SECURITY
  // ==========================================
  async checkLogin(userId, ipAddress, deviceFingerprint = null, userAgent = null) {
    try {
      const response = await mlApi.post('/intel/login-check', {
        user_id: userId,
        ip_address: ipAddress,
        device_fingerprint: deviceFingerprint,
        user_agent: userAgent
      });
      return response.data;
    } catch (error) {
      console.error('Login Check Error:', error.message);
      return { login_allowed: true, security: { risk_score: 0, flags: ['ML_UNAVAILABLE'] }, currency: { local: 'USD', exchange_rate_to_usd: 1 } };
    }
  }

  async checkSignup(ipAddress, proposedUserId) {
    try {
      const response = await mlApi.post('/intel/signup-check', {
        ip_address: ipAddress,
        proposed_user_id: proposedUserId
      });
      return response.data;
    } catch (error) {
      console.error('Signup Check Error:', error.message);
      return { allowed: true };
    }
  }

  async getIpAnalysis(ipAddress) {
    try {
      const response = await mlApi.get(`/intel/ip-analysis/${ipAddress}`);
      return response.data;
    } catch (error) {
      console.error('IP Analysis Error:', error.message);
      throw error;
    }
  }

  async convertCurrency(amount, fromCurrency, toCurrency = 'USD') {
    try {
      const response = await mlApi.post('/intel/currency/convert', {
        amount: amount,
        from_currency: fromCurrency,
        to_currency: toCurrency
      });
      return response.data;
    } catch (error) {
      console.error('Currency Conversion Error:', error.message);
      return { original_amount: amount, original_currency: fromCurrency, converted_amount: amount, converted_currency: toCurrency, exchange_rate: 1, error: 'Conversion unavailable' };
    }
  }

  async getExchangeRates(baseCurrency = 'USD') {
    try {
      const response = await mlApi.get(`/intel/currency/rates/${baseCurrency}`);
      return response.data;
    } catch (error) {
      console.error('Exchange Rates Error:', error.message);
      return { base: baseCurrency, rates: {}, error: 'Rates unavailable' };
    }
  }

  async getLocationFromIp(ipAddress) {
    try {
      const response = await mlApi.post('/intel/login-check', {
        user_id: 'ip_lookup_only',
        ip_address: ipAddress
      });
      return response.data.geo;
    } catch (error) {
      console.error('Geo Lookup Error:', error.message);
      return { country_code: 'UNKNOWN', currency: 'USD' };
    }
  }

  // ==========================================
  // HEALTH CHECK
  // ==========================================
  async healthCheck() {
    try {
      const response = await axios.get(`${ML_SERVICE_URL}/health`);
      return response.data;
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = new MLService();