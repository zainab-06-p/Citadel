/**
 * Exchange Rate Service
 * Fetches live ALGO/INR rates from CoinGecko API
 */

const exchangeRateService = {
  /**
   * Get current ALGO price in INR
   * @returns {Promise<number>} ALGO price in INR
   */
  async getAlgoToINRRate() {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=algorand&vs_currencies=inr'
      );
      const data = await response.json();
      const rate = data.algorand?.inr;
      
      if (!rate) {
        console.warn('Could not fetch ALGO/INR rate, using fallback');
        return 58; // Fallback rate
      }
      
      console.log(`💱 ALGO/INR rate: ₹${rate}`);
      return rate;
    } catch (error) {
      console.error('Exchange rate fetch failed:', error);
      return 58; // Fallback to 1 ALGO = 58 INR
    }
  },

  /**
   * Convert INR to ALGO amount
   * @param {number} inrAmount - Amount in INR
   * @returns {Promise<number>} Amount in ALGO
   */
  async convertINRToAlgo(inrAmount) {
    const rate = await this.getAlgoToINRRate();
    return inrAmount / rate;
  },

  /**
   * Convert ALGO to INR amount
   * @param {number} algoAmount - Amount in ALGO
   * @returns {Promise<number>} Amount in INR
   */
  async convertAlgoToINR(algoAmount) {
    const rate = await this.getAlgoToINRRate();
    return algoAmount * rate;
  }
};

module.exports = exchangeRateService;
