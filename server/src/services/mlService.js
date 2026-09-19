// services/mlService.js
const axios = require('axios');

const ML_SERVICE_URL = 'http://localhost:8000/ml';

class MLService {
  // Get job recommendations for a user
  async getJobRecommendations(userProfile) {
    try {
      const response = await axios.post(`${ML_SERVICE_URL}/jobs/recommend`, userProfile);
      return response.data;
    } catch (error) {
      console.error('ML Service Error:', error.message);
      throw error;
    }
  }

  // Check withdrawal risk before processing
  async assessWithdrawal(withdrawalData) {
    try {
      const response = await axios.post(`${ML_SERVICE_URL}/risk/withdrawal/assess`, withdrawalData);
      
      // If not auto-approved, notify admin dashboard
      if (response.data.decision !== 'auto_approve') {
        // Trigger your admin notification here (email, websocket, etc.)
        console.log(`Withdrawal flagged for review: ${response.data.reasoning}`);
      }
      
      return response.data;
    } catch (error) {
      console.error('Risk Assessment Error:', error.message);
      // Fail safe: require manual review if ML service is down
      return { decision: 'requires_review', reason: 'ML service unavailable' };
    }
  }

  // Get pending cases for admin dashboard
  async getPendingReviews() {
    const response = await axios.get(`${ML_SERVICE_URL}/review/cases/pending`);
    return response.data;
  }
}

module.exports = new MLService();