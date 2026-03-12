/**
 * Sales Readiness Validation
 *
 * Two-point check system:
 * 1. Purity must be recorded
 * 2. Net Weight must be recorded
 */

export const READINESS_STATUS = {
  READY: 'READY',
  BLOCKED: 'BLOCKED'
};

/**
 * Check if a peptide is sales-ready
 * @param {Object} peptide - The peptide object
 * @returns {Object} { isReady: boolean, missing: string[] }
 */
export function checkSalesReadiness(peptide) {
  const missing = [];

  // Check 1: Purity
  if (!peptide.purity || peptide.purity.trim() === '') {
    missing.push('Purity');
  }

  // Check 2: Net Weight
  if (!peptide.netWeight || peptide.netWeight.trim() === '') {
    missing.push('Net Weight');
  }

  return {
    isReady: missing.length === 0,
    missing
  };
}

/**
 * Get sales readiness status configuration
 * @param {boolean} isReady - Whether the peptide is sales-ready
 * @returns {Object} Configuration for display
 */
export function getReadinessConfig(isReady) {
  if (isReady) {
    return {
      status: READINESS_STATUS.READY,
      label: 'Sales Ready',
      className: 'bg-green-100 text-green-800 border border-green-200',
      icon: 'CheckCircle',
      description: 'All requirements met'
    };
  }

  return {
    status: READINESS_STATUS.BLOCKED,
    label: 'Blocked',
    className: 'bg-red-100 text-red-800 border border-red-200',
    icon: 'XCircle',
    description: 'Missing requirements'
  };
}

/**
 * Filter peptides by readiness status
 * @param {Array} peptides - Array of peptides
 * @param {string} status - 'READY' or 'BLOCKED' or 'ALL'
 * @returns {Array} Filtered peptides with readiness info
 */
export function filterByReadiness(peptides, status = 'ALL') {
  const peptidesWithReadiness = peptides.map(peptide => ({
    ...peptide,
    readiness: checkSalesReadiness(peptide)
  }));

  if (status === 'ALL') {
    return peptidesWithReadiness;
  }

  return peptidesWithReadiness.filter(p =>
    status === 'READY' ? p.readiness.isReady : !p.readiness.isReady
  );
}

/**
 * Get readiness statistics
 * @param {Array} peptides - Array of peptides
 * @returns {Object} Statistics
 */
export function getReadinessStats(peptides) {
  const stats = {
    total: peptides.length,
    ready: 0,
    blocked: 0,
    missingPurity: 0,
    missingNetWeight: 0
  };

  peptides.forEach(peptide => {
    const readiness = checkSalesReadiness(peptide);

    if (readiness.isReady) {
      stats.ready++;
    } else {
      stats.blocked++;

      if (readiness.missing.includes('Purity')) stats.missingPurity++;
      if (readiness.missing.includes('Net Weight')) stats.missingNetWeight++;
    }
  });

  return stats;
}
