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
        console.log(`🤖 ML Request: ${request.method?.toUpperCase()} ${request.url}`);
        return request;
    });
}

class MLService {
    
    // ==========================================
    // JOB RECOMMENDATIONS
    // ==========================================
    
    /**
     * Get personalized job recommendations for a user
     * Call this when user visits job feed or dashboard
     */
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
            console.error('❌ ML Recommendation Error:', error.message);
            // Fail gracefully - return empty array, don't crash the app
            return [];
        }
    }

    /**
     * Load jobs into ML model (call when new job posted or cache refresh)
     */
    async loadJobs(jobs, replace = false) {
        try {
            const response = await mlApi.post('/jobs/load', jobs, {
                params: { replace }  // false = merge (single job), true = full sync
            });
            return response.data;
        } catch (error) {
            console.error('❌ ML Load Jobs Error:', error.message);
            throw error;
        }
    }

    // ==========================================
    // RISK ASSESSMENT (Withdrawals)
    // ==========================================
    
    /**
     * Check if withdrawal is safe to process
     * CRITICAL: Always call this before processing withdrawal
     */
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
                hour_of_day: new Date().getHours() // Add current hour for ML model
            });
            
            const assessment = response.data;
            
            // Handle different decisions
            switch (assessment.decision) {
                case 'auto_approve':
                    return {
                        approved: true,
                        autoProcess: true,
                        riskScore: assessment.risk_score,
                        message: 'Withdrawal approved by AI'
                    };
                    
                case 'requires_review':
                case 'pending_human_review':
                    // Queue for admin review, don't process yet
                    return {
                        approved: false,
                        autoProcess: false,
                        requiresReview: true,
                        riskScore: assessment.risk_score,
                        reasoning: assessment.reasoning,
                        message: 'Withdrawal queued for manual review'
                    };
                    
                case 'block':
                case 'blocked_pending_review':
                    return {
                        approved: false,
                        autoProcess: false,
                        blocked: true,
                        riskScore: assessment.risk_score,
                        reasoning: assessment.reasoning,
                        flags: assessment.flags,
                        message: 'Withdrawal blocked by security system'
                    };
                    
                default:
                    return {
                        approved: false,
                        autoProcess: false,
                        error: 'Unknown decision from ML service'
                    };
            }
            
        } catch (error) {
            console.error('❌ Risk Assessment Error:', error.message);
            // FAIL SAFE: If ML is down, require manual review
            return {
                approved: false,
                autoProcess: false,
                requiresReview: true,
                error: 'Security system temporarily unavailable',
                message: 'Withdrawal queued for manual review (system check failed)'
            };
        }
    }

    // ==========================================
    // ACCOUNT FLAGGING
    // ==========================================
    
    /**
     * Flag suspicious account for human review
     * AI never auto-suspends - always human decision
     */
    async flagAccount(userId, reason, evidence) {
        try {
            const response = await mlApi.post('/risk/account/flag', null, {
                params: {
                    user_id: userId,
                    reason: reason
                },
                data: evidence
            });
            
            return response.data;
        } catch (error) {
            console.error('❌ Flag Account Error:', error.message);
            throw error;
        }
    }

    // ==========================================
    // ADMIN REVIEW (Human-in-the-loop)
    // ==========================================
    
    /**
     * Get pending cases for admin dashboard
     */
    async getPendingReviews() {
        try {
            const response = await mlApi.get('/review/cases/pending');
            return response.data;
        } catch (error) {
            console.error('❌ Get Reviews Error:', error.message);
            return { count: 0, cases: [] };
        }
    }

    /**
     * Admin makes final decision
     * This also trains the ML model!
     */
    async submitReviewDecision(caseId, reviewerId, decision, notes = '') {
        try {
            const response = await mlApi.post('/review/cases/decide', {
                case_id: caseId,
                reviewer_id: reviewerId,
                decision: decision, // 'approve', 'reject', 'escalate'
                notes: notes
            });
            
            return response.data;
        } catch (error) {
            console.error('❌ Review Decision Error:', error.message);
            throw error;
        }
    }

    // ==========================================
    // ID VERIFICATION
    // ==========================================
    
    /**
     * Verify user ID documents
     * Sends files to Python service for OCR + face match
     */
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
            console.error('❌ ID Verification Error:', error.message);
            throw error;
        }
    }

    // ==========================================
    // FEED ALGORITHM
    // ==========================================
    
    /**
     * Get ranked job feed for user
     * Pass the posts you want ranked; the ML service returns them ordered
     */
    async getFeed(userProfile, posts, limit = 20) {
        try {
            const response = await mlApi.post('/feed', {
                // User context in body
                user_id: userProfile.id,
                skills: userProfile.skills || [],
                profile_bio: userProfile.bio || '',
                preferred_categories: userProfile.categories || [],
                experience_level: userProfile.experienceLevel || 'beginner',
                past_jobs: userProfile.completedJobs || [],
                // Posts to rank in body (NEW!)
                posts: posts  // Pass the posts array here
            }, {
                params: { limit }  // limit stays as query param
            });
            
            return response.data.feed;
        } catch (error) {
            console.error('❌ Feed Error:', error.message);
            return posts; // Return unranked posts as fallback
        }
    }

    // ==========================================
    // GEO INTELLIGENCE & NETWORK SECURITY (NEW!)
    // ==========================================
    
    /**
     * Check login for geo-location, duplicate sessions, and account limits
     * Call this on EVERY login/signup
     */
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
            console.error('❌ Login Check Error:', error.message);
            // Fail open - allow login but log for review
            return { 
                login_allowed: true, 
                security: { risk_score: 0, flags: ['ML_UNAVAILABLE'] },
                currency: { local: 'USD', exchange_rate_to_usd: 1 }
            };
        }
    }

    /**
     * Check if signup is allowed (max 2 accounts per IP)
     * Call BEFORE creating account
     */
    async checkSignup(ipAddress, proposedUserId) {
        try {
            const response = await mlApi.post('/intel/signup-check', {
                ip_address: ipAddress,
                proposed_user_id: proposedUserId
            });
            return response.data;
        } catch (error) {
            console.error('❌ Signup Check Error:', error.message);
            return { allowed: true }; // Fail open
        }
    }

    /**
     * Get IP analysis (admin only)
     * See all accounts on an IP address
     */
    async getIpAnalysis(ipAddress) {
        try {
            const response = await mlApi.get(`/intel/ip-analysis/${ipAddress}`);
            return response.data;
        } catch (error) {
            console.error('❌ IP Analysis Error:', error.message);
            throw error;
        }
    }

    /**
     * Convert currency using real-time exchange rates
     * Auto-detects currency from country if not specified
     */
    async convertCurrency(amount, fromCurrency, toCurrency = 'USD') {
        try {
            const response = await mlApi.post('/intel/currency/convert', {
                amount: amount,
                from_currency: fromCurrency,
                to_currency: toCurrency
            });
            return response.data;
        } catch (error) {
            console.error('❌ Currency Conversion Error:', error.message);
            // Return original amount if conversion fails
            return {
                original_amount: amount,
                original_currency: fromCurrency,
                converted_amount: amount,
                converted_currency: toCurrency,
                exchange_rate: 1,
                error: 'Conversion unavailable'
            };
        }
    }

    /**
     * Get current exchange rates for a base currency
     */
    async getExchangeRates(baseCurrency = 'USD') {
        try {
            const response = await mlApi.get(`/intel/currency/rates/${baseCurrency}`);
            return response.data;
        } catch (error) {
            console.error('❌ Exchange Rates Error:', error.message);
            return { base: baseCurrency, rates: {}, error: 'Rates unavailable' };
        }
    }

    /**
     * Get location info from IP (convenience method)
     */
    async getLocationFromIp(ipAddress) {
        try {
            // Use login-check endpoint but don't register the login
            const response = await mlApi.post('/intel/login-check', {
                user_id: 'ip_lookup_only',
                ip_address: ipAddress
            });
            return response.data.geo;
        } catch (error) {
            console.error('❌ Geo Lookup Error:', error.message);
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