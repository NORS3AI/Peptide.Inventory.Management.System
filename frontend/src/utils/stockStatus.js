/**
 * Stock status utilities for Oath Inventory System
 * Determines color-coded status based on inventory levels
 */

export const STOCK_STATUS = {
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  NEARLY_OUT: 'NEARLY_OUT',
  LOW_STOCK: 'LOW_STOCK',
  GOOD_STOCK: 'GOOD_STOCK',
  ON_ORDER: 'ON_ORDER'
};

export const STATUS_CONFIG = {
  [STOCK_STATUS.OUT_OF_STOCK]: {
    label: 'Out of Stock',
    color: 'red',
    className: 'status-out-of-stock',
    priority: 1,
    action: 'Order Immediately'
  },
  [STOCK_STATUS.NEARLY_OUT]: {
    label: 'Nearly Out',
    color: 'orange',
    className: 'status-nearly-out',
    priority: 2,
    action: 'Order Urgently'
  },
  [STOCK_STATUS.LOW_STOCK]: {
    label: 'Low Stock',
    color: 'yellow',
    className: 'status-low-stock',
    priority: 3,
    action: 'Order Soon'
  },
  [STOCK_STATUS.GOOD_STOCK]: {
    label: 'Good Stock',
    color: 'green',
    className: 'status-good-stock',
    priority: 4,
    action: 'No Action Needed'
  },
  [STOCK_STATUS.ON_ORDER]: {
    label: 'On Order',
    color: 'teal',
    className: 'status-on-order',
    priority: 5,
    action: 'Monitor Delivery'
  }
};

/**
 * Calculate stock status based on current quantity and thresholds
 * @param {number} quantity - Current quantity in stock
 * @param {object} thresholds - Stock level thresholds
 * @param {boolean} hasActiveOrder - Whether there's an active order for this peptide
 * @returns {string} Stock status constant
 */
export function calculateStockStatus(quantity, thresholds, hasActiveOrder = false) {
  // If there's an active order, show ON_ORDER status
  if (hasActiveOrder) {
    return STOCK_STATUS.ON_ORDER;
  }

  const qty = Number(quantity) || 0;

  if (qty <= thresholds.outOfStock) {
    return STOCK_STATUS.OUT_OF_STOCK;
  } else if (qty <= thresholds.nearlyOut) {
    return STOCK_STATUS.NEARLY_OUT;
  } else if (qty <= thresholds.lowStock) {
    return STOCK_STATUS.LOW_STOCK;
  } else {
    return STOCK_STATUS.GOOD_STOCK;
  }
}

/**
 * Get status configuration for display
 * @param {string} status - Stock status constant
 * @returns {object} Status configuration
 */
export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG[STOCK_STATUS.OUT_OF_STOCK];
}

/**
 * Check if a peptide needs ordering based on status
 * @param {string} status - Stock status constant
 * @returns {boolean} Whether the peptide needs to be ordered
 */
export function needsOrdering(status) {
  return [
    STOCK_STATUS.OUT_OF_STOCK,
    STOCK_STATUS.NEARLY_OUT,
    STOCK_STATUS.LOW_STOCK
  ].includes(status);
}

/**
 * Get default stock thresholds
 * @returns {object} Default thresholds
 */
export function getDefaultThresholds() {
  return {
    outOfStock: 0,
    nearlyOut: 10,
    lowStock: 25,
    goodStock: 50
  };
}

/**
 * Sort peptides by stock status priority (most urgent first)
 * @param {array} peptides - Array of peptides with status
 * @returns {array} Sorted peptides
 */
export function sortByStatusPriority(peptides) {
  return [...peptides].sort((a, b) => {
    const priorityA = getStatusConfig(a.status).priority;
    const priorityB = getStatusConfig(b.status).priority;
    return priorityA - priorityB;
  });
}
