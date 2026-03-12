import { describe, it, expect } from 'vitest';
import {
  STOCK_STATUS,
  STATUS_CONFIG,
  calculateStockStatus,
  getStatusConfig,
  needsOrdering,
  getDefaultThresholds,
  sortByStatusPriority
} from './stockStatus';

describe('stockStatus', () => {
  const defaultThresholds = {
    outOfStock: 0,
    nearlyOut: 10,
    lowStock: 25,
    goodStock: 50
  };

  describe('calculateStockStatus', () => {
    it('should return ON_ORDER when hasActiveOrder is true regardless of quantity', () => {
      expect(calculateStockStatus(100, defaultThresholds, true)).toBe(STOCK_STATUS.ON_ORDER);
      expect(calculateStockStatus(0, defaultThresholds, true)).toBe(STOCK_STATUS.ON_ORDER);
      expect(calculateStockStatus(-5, defaultThresholds, true)).toBe(STOCK_STATUS.ON_ORDER);
    });

    it('should return OUT_OF_STOCK when quantity is at or below outOfStock threshold', () => {
      expect(calculateStockStatus(0, defaultThresholds)).toBe(STOCK_STATUS.OUT_OF_STOCK);
      expect(calculateStockStatus(-5, defaultThresholds)).toBe(STOCK_STATUS.OUT_OF_STOCK);
      expect(calculateStockStatus(-100, defaultThresholds)).toBe(STOCK_STATUS.OUT_OF_STOCK);
    });

    it('should return NEARLY_OUT when quantity is above outOfStock but at or below nearlyOut', () => {
      expect(calculateStockStatus(1, defaultThresholds)).toBe(STOCK_STATUS.NEARLY_OUT);
      expect(calculateStockStatus(5, defaultThresholds)).toBe(STOCK_STATUS.NEARLY_OUT);
      expect(calculateStockStatus(10, defaultThresholds)).toBe(STOCK_STATUS.NEARLY_OUT);
    });

    it('should return LOW_STOCK when quantity is above nearlyOut but at or below lowStock', () => {
      expect(calculateStockStatus(11, defaultThresholds)).toBe(STOCK_STATUS.LOW_STOCK);
      expect(calculateStockStatus(20, defaultThresholds)).toBe(STOCK_STATUS.LOW_STOCK);
      expect(calculateStockStatus(25, defaultThresholds)).toBe(STOCK_STATUS.LOW_STOCK);
    });

    it('should return GOOD_STOCK when quantity is above lowStock', () => {
      expect(calculateStockStatus(26, defaultThresholds)).toBe(STOCK_STATUS.GOOD_STOCK);
      expect(calculateStockStatus(50, defaultThresholds)).toBe(STOCK_STATUS.GOOD_STOCK);
      expect(calculateStockStatus(1000, defaultThresholds)).toBe(STOCK_STATUS.GOOD_STOCK);
    });

    it('should handle string quantities', () => {
      expect(calculateStockStatus('15', defaultThresholds)).toBe(STOCK_STATUS.LOW_STOCK);
      expect(calculateStockStatus('100', defaultThresholds)).toBe(STOCK_STATUS.GOOD_STOCK);
    });

    it('should handle null, undefined, or invalid quantities as 0', () => {
      expect(calculateStockStatus(null, defaultThresholds)).toBe(STOCK_STATUS.OUT_OF_STOCK);
      expect(calculateStockStatus(undefined, defaultThresholds)).toBe(STOCK_STATUS.OUT_OF_STOCK);
      expect(calculateStockStatus('invalid', defaultThresholds)).toBe(STOCK_STATUS.OUT_OF_STOCK);
    });

    it('should work with custom thresholds', () => {
      const customThresholds = {
        outOfStock: 5,
        nearlyOut: 20,
        lowStock: 50,
        goodStock: 100
      };

      expect(calculateStockStatus(3, customThresholds)).toBe(STOCK_STATUS.OUT_OF_STOCK);
      expect(calculateStockStatus(15, customThresholds)).toBe(STOCK_STATUS.NEARLY_OUT);
      expect(calculateStockStatus(35, customThresholds)).toBe(STOCK_STATUS.LOW_STOCK);
      expect(calculateStockStatus(75, customThresholds)).toBe(STOCK_STATUS.GOOD_STOCK);
    });
  });

  describe('getStatusConfig', () => {
    it('should return correct config for each status', () => {
      expect(getStatusConfig(STOCK_STATUS.OUT_OF_STOCK)).toEqual({
        label: 'Out of Stock',
        color: 'red',
        className: 'status-out-of-stock',
        priority: 1,
        action: 'Order Immediately'
      });

      expect(getStatusConfig(STOCK_STATUS.NEARLY_OUT)).toEqual({
        label: 'Nearly Out',
        color: 'orange',
        className: 'status-nearly-out',
        priority: 2,
        action: 'Order Urgently'
      });

      expect(getStatusConfig(STOCK_STATUS.LOW_STOCK)).toEqual({
        label: 'Low Stock',
        color: 'yellow',
        className: 'status-low-stock',
        priority: 3,
        action: 'Order Soon'
      });

      expect(getStatusConfig(STOCK_STATUS.GOOD_STOCK)).toEqual({
        label: 'Good Stock',
        color: 'green',
        className: 'status-good-stock',
        priority: 4,
        action: 'No Action Needed'
      });

      expect(getStatusConfig(STOCK_STATUS.ON_ORDER)).toEqual({
        label: 'On Order',
        color: 'teal',
        className: 'status-on-order',
        priority: 5,
        action: 'Monitor Delivery'
      });
    });

    it('should return OUT_OF_STOCK config for invalid status', () => {
      expect(getStatusConfig('INVALID_STATUS')).toEqual(STATUS_CONFIG[STOCK_STATUS.OUT_OF_STOCK]);
      expect(getStatusConfig(null)).toEqual(STATUS_CONFIG[STOCK_STATUS.OUT_OF_STOCK]);
    });
  });

  describe('needsOrdering', () => {
    it('should return true for statuses that need ordering', () => {
      expect(needsOrdering(STOCK_STATUS.OUT_OF_STOCK)).toBe(true);
      expect(needsOrdering(STOCK_STATUS.NEARLY_OUT)).toBe(true);
      expect(needsOrdering(STOCK_STATUS.LOW_STOCK)).toBe(true);
    });

    it('should return false for statuses that do not need ordering', () => {
      expect(needsOrdering(STOCK_STATUS.GOOD_STOCK)).toBe(false);
      expect(needsOrdering(STOCK_STATUS.ON_ORDER)).toBe(false);
    });

    it('should return false for invalid statuses', () => {
      expect(needsOrdering('INVALID_STATUS')).toBe(false);
      expect(needsOrdering(null)).toBe(false);
    });
  });

  describe('getDefaultThresholds', () => {
    it('should return correct default thresholds', () => {
      expect(getDefaultThresholds()).toEqual({
        outOfStock: 0,
        nearlyOut: 10,
        lowStock: 25,
        goodStock: 50
      });
    });

    it('should return a new object each time', () => {
      const thresholds1 = getDefaultThresholds();
      const thresholds2 = getDefaultThresholds();
      expect(thresholds1).not.toBe(thresholds2);
      expect(thresholds1).toEqual(thresholds2);
    });
  });

  describe('sortByStatusPriority', () => {
    it('should sort peptides by status priority (most urgent first)', () => {
      const peptides = [
        { id: '1', status: STOCK_STATUS.GOOD_STOCK },
        { id: '2', status: STOCK_STATUS.OUT_OF_STOCK },
        { id: '3', status: STOCK_STATUS.ON_ORDER },
        { id: '4', status: STOCK_STATUS.LOW_STOCK },
        { id: '5', status: STOCK_STATUS.NEARLY_OUT }
      ];

      const sorted = sortByStatusPriority(peptides);

      expect(sorted[0].status).toBe(STOCK_STATUS.OUT_OF_STOCK);
      expect(sorted[1].status).toBe(STOCK_STATUS.NEARLY_OUT);
      expect(sorted[2].status).toBe(STOCK_STATUS.LOW_STOCK);
      expect(sorted[3].status).toBe(STOCK_STATUS.GOOD_STOCK);
      expect(sorted[4].status).toBe(STOCK_STATUS.ON_ORDER);
    });

    it('should not mutate the original array', () => {
      const peptides = [
        { id: '1', status: STOCK_STATUS.GOOD_STOCK },
        { id: '2', status: STOCK_STATUS.OUT_OF_STOCK }
      ];

      const original = [...peptides];
      sortByStatusPriority(peptides);

      expect(peptides).toEqual(original);
    });

    it('should handle empty array', () => {
      expect(sortByStatusPriority([])).toEqual([]);
    });

    it('should handle single item array', () => {
      const peptides = [{ id: '1', status: STOCK_STATUS.GOOD_STOCK }];
      expect(sortByStatusPriority(peptides)).toEqual(peptides);
    });
  });
});
