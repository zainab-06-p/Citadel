/**
 * Exchange Rate Service
 * Fetches live ALGO/INR rates from CoinGecko API
 */

const FALLBACK_RATE = 58;
const RATE_CACHE_TTL_MS = 60 * 1000;

let cachedRate = null;
let cachedAt = 0;

const exchangeRateService = {
  /**
   * Get current ALGO price in INR
   * @returns {Promise<number>} ALGO price in INR
   */
  async getAlgoToINRRate() {
    const now = Date.now();
    if (cachedRate && (now - cachedAt) < RATE_CACHE_TTL_MS) {
      return cachedRate;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=algorand&vs_currencies=inr',
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Rate provider returned ${response.status}`);
      }

      const data = await response.json();
      const rate = Number(data.algorand?.inr);
      
      if (!Number.isFinite(rate) || rate <= 0) {
        console.warn('Could not fetch ALGO/INR rate, using fallback');
        return cachedRate || FALLBACK_RATE;
      }

      cachedRate = rate;
      cachedAt = Date.now();
      return rate;
    } catch (error) {
      console.error('Exchange rate fetch failed:', error?.message || error);
      return cachedRate || FALLBACK_RATE;
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
