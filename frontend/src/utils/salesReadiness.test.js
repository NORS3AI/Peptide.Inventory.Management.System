import { describe, it, expect } from 'vitest';
import {
  READINESS_STATUS,
  checkSalesReadiness,
  getReadinessConfig,
  filterByReadiness,
  getReadinessStats
} from './salesReadiness';

describe('salesReadiness', () => {
  describe('checkSalesReadiness', () => {
    it('should return isReady: true when all three requirements are met', () => {
      const peptide = {
        purity: '95%',
        netWeight: '100mg',
        isLabeled: true
      };

      const result = checkSalesReadiness(peptide);
      expect(result.isReady).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should detect missing purity', () => {
      const peptide = {
        purity: '',
        netWeight: '100mg',
        isLabeled: true
      };

      const result = checkSalesReadiness(peptide);
      expect(result.isReady).toBe(false);
      expect(result.missing).toContain('Purity');
    });

    it('should detect missing net weight', () => {
      const peptide = {
        purity: '95%',
        netWeight: '',
        isLabeled: true
      };

      const result = checkSalesReadiness(peptide);
      expect(result.isReady).toBe(false);
      expect(result.missing).toContain('Net Weight');
    });

    it('should detect missing label', () => {
      const peptide = {
        purity: '95%',
        netWeight: '100mg',
        isLabeled: false
      };

      const result = checkSalesReadiness(peptide);
      expect(result.isReady).toBe(false);
      expect(result.missing).toContain('Label');
    });

    it('should detect multiple missing requirements', () => {
      const peptide = {
        purity: '',
        netWeight: '',
        isLabeled: false
      };

      const result = checkSalesReadiness(peptide);
      expect(result.isReady).toBe(false);
      expect(result.missing).toEqual(['Purity', 'Net Weight', 'Label']);
    });

    it('should treat whitespace-only values as missing', () => {
      const peptide = {
        purity: '   ',
        netWeight: '\t\n',
        isLabeled: true
      };

      const result = checkSalesReadiness(peptide);
      expect(result.isReady).toBe(false);
      expect(result.missing).toContain('Purity');
      expect(result.missing).toContain('Net Weight');
    });

    it('should treat null/undefined as missing', () => {
      const peptide = {
        purity: null,
        netWeight: undefined,
        isLabeled: false
      };

      const result = checkSalesReadiness(peptide);
      expect(result.isReady).toBe(false);
      expect(result.missing).toEqual(['Purity', 'Net Weight', 'Label']);
    });

    it('should handle missing isLabeled field (defaults to falsy)', () => {
      const peptide = {
        purity: '95%',
        netWeight: '100mg'
      };

      const result = checkSalesReadiness(peptide);
      expect(result.isReady).toBe(false);
      expect(result.missing).toContain('Label');
    });
  });

  describe('getReadinessConfig', () => {
    it('should return READY config when isReady is true', () => {
      const config = getReadinessConfig(true);

      expect(config.status).toBe(READINESS_STATUS.READY);
      expect(config.label).toBe('Sales Ready');
      expect(config.className).toContain('green');
      expect(config.icon).toBe('CheckCircle');
      expect(config.description).toBe('All requirements met');
    });

    it('should return BLOCKED config when isReady is false', () => {
      const config = getReadinessConfig(false);

      expect(config.status).toBe(READINESS_STATUS.BLOCKED);
      expect(config.label).toBe('Blocked');
      expect(config.className).toContain('red');
      expect(config.icon).toBe('XCircle');
      expect(config.description).toBe('Missing requirements');
    });
  });

  describe('filterByReadiness', () => {
    const peptides = [
      { id: '1', purity: '95%', netWeight: '100mg', isLabeled: true },
      { id: '2', purity: '', netWeight: '100mg', isLabeled: true },
      { id: '3', purity: '98%', netWeight: '', isLabeled: true },
      { id: '4', purity: '97%', netWeight: '50mg', isLabeled: false },
      { id: '5', purity: '99%', netWeight: '200mg', isLabeled: true }
    ];

    it('should return all peptides with readiness info when status is ALL', () => {
      const result = filterByReadiness(peptides, 'ALL');

      expect(result).toHaveLength(5);
      expect(result[0]).toHaveProperty('readiness');
      expect(result[0].readiness.isReady).toBe(true);
      expect(result[1].readiness.isReady).toBe(false);
    });

    it('should filter to only ready peptides when status is READY', () => {
      const result = filterByReadiness(peptides, 'READY');

      expect(result).toHaveLength(2);
      expect(result.every(p => p.readiness.isReady)).toBe(true);
    });

    it('should filter to only blocked peptides when status is BLOCKED', () => {
      const result = filterByReadiness(peptides, 'BLOCKED');

      expect(result).toHaveLength(3);
      expect(result.every(p => !p.readiness.isReady)).toBe(true);
    });

    it('should default to ALL when no status provided', () => {
      const result = filterByReadiness(peptides);

      expect(result).toHaveLength(5);
    });

    it('should handle empty array', () => {
      expect(filterByReadiness([], 'ALL')).toEqual([]);
      expect(filterByReadiness([], 'READY')).toEqual([]);
      expect(filterByReadiness([], 'BLOCKED')).toEqual([]);
    });
  });

  describe('getReadinessStats', () => {
    it('should calculate correct statistics for mixed peptides', () => {
      const peptides = [
        { id: '1', purity: '95%', netWeight: '100mg', isLabeled: true },  // ready
        { id: '2', purity: '', netWeight: '100mg', isLabeled: true },      // missing purity
        { id: '3', purity: '98%', netWeight: '', isLabeled: true },        // missing net weight
        { id: '4', purity: '97%', netWeight: '50mg', isLabeled: false },   // missing label
        { id: '5', purity: '', netWeight: '', isLabeled: false }           // missing all three
      ];

      const stats = getReadinessStats(peptides);

      expect(stats.total).toBe(5);
      expect(stats.ready).toBe(1);
      expect(stats.blocked).toBe(4);
      expect(stats.missingPurity).toBe(2);
      expect(stats.missingNetWeight).toBe(2);
      expect(stats.missingLabel).toBe(2);
    });

    it('should return correct stats when all peptides are ready', () => {
      const peptides = [
        { id: '1', purity: '95%', netWeight: '100mg', isLabeled: true },
        { id: '2', purity: '98%', netWeight: '200mg', isLabeled: true }
      ];

      const stats = getReadinessStats(peptides);

      expect(stats.total).toBe(2);
      expect(stats.ready).toBe(2);
      expect(stats.blocked).toBe(0);
      expect(stats.missingPurity).toBe(0);
      expect(stats.missingNetWeight).toBe(0);
      expect(stats.missingLabel).toBe(0);
    });

    it('should return correct stats when all peptides are blocked', () => {
      const peptides = [
        { id: '1', purity: '', netWeight: '', isLabeled: false },
        { id: '2', purity: '', netWeight: '', isLabeled: false }
      ];

      const stats = getReadinessStats(peptides);

      expect(stats.total).toBe(2);
      expect(stats.ready).toBe(0);
      expect(stats.blocked).toBe(2);
      expect(stats.missingPurity).toBe(2);
      expect(stats.missingNetWeight).toBe(2);
      expect(stats.missingLabel).toBe(2);
    });

    it('should handle empty array', () => {
      const stats = getReadinessStats([]);

      expect(stats.total).toBe(0);
      expect(stats.ready).toBe(0);
      expect(stats.blocked).toBe(0);
      expect(stats.missingPurity).toBe(0);
      expect(stats.missingNetWeight).toBe(0);
      expect(stats.missingLabel).toBe(0);
    });

    it('should count peptides missing multiple requirements correctly', () => {
      const peptides = [
        { id: '1', purity: '', netWeight: '', isLabeled: false }
      ];

      const stats = getReadinessStats(peptides);

      expect(stats.blocked).toBe(1);
      expect(stats.missingPurity).toBe(1);
      expect(stats.missingNetWeight).toBe(1);
      expect(stats.missingLabel).toBe(1);
    });
  });
});
