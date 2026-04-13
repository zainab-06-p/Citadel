/**
 * Validate Algorand address
 * @param {string} address
 * @returns {boolean}
 */
function isValidAlgorandAddress(address) {
  if (!address || typeof address !== 'string') return false;
  
  // Algorand addresses are 58 characters
  if (address.length !== 58) return false;
  
  // Should only contain alphanumeric characters
  return /^[A-Z2-7]+$/i.test(address);
}

/**
 * Validate milestone array
 * @param {Array} milestones
 * @returns {boolean}
 */
function isValidMilestones(milestones) {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return false;
  }
  
  for (const milestone of milestones) {
    if (!milestone.amount || typeof milestone.amount !== 'number' || milestone.amount <= 0) {
      return false;
    }
    
    if (!milestone.description || typeof milestone.description !== 'string') {
      return false;
    }
  }
  
  return true;
}

/**
 * Sanitize string input
 * @param {string} str
 * @returns {string}
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
}

module.exports = {
  isValidAlgorandAddress,
  isValidMilestones,
  sanitizeString
};
