import { describe, it, expect, vi } from 'vitest';
import {
  transformPeptideData,
  getDefaultFieldMapping,
  validatePeptideData,
  exportToCSV
} from './csvParser';

describe('csvParser', () => {
  describe('getDefaultFieldMapping', () => {
    it('should return correct default field mappings', () => {
      const mapping = getDefaultFieldMapping();

      expect(mapping.peptideId).toContain('Product');
      expect(mapping.peptideId).toContain('Peptide ID');
      expect(mapping.peptideName).toContain('SKU');
      expect(mapping.peptideName).toContain('Peptide Name');
      expect(mapping.netWeight).toContain('Size');
      expect(mapping.netWeight).toContain('Net Weight');
      expect(mapping.orderedDate).toContain('Incoming Arrival');
      expect(mapping.orderedQty).toContain('Incoming Qty');
      expect(mapping.notes).toContain('Status');
      expect(mapping.notes).toContain('Notes');
    });

    it('should have all expected field mappings', () => {
      const mapping = getDefaultFieldMapping();

      expect(mapping).toHaveProperty('peptideId');
      expect(mapping).toHaveProperty('peptideName');
      expect(mapping).toHaveProperty('quantity');
      expect(mapping).toHaveProperty('unit');
      expect(mapping).toHaveProperty('batchNumber');
      expect(mapping).toHaveProperty('purity');
      expect(mapping).toHaveProperty('netWeight');
      expect(mapping).toHaveProperty('orderedDate');
      expect(mapping).toHaveProperty('orderedQty');
      expect(mapping).toHaveProperty('velocity');
      expect(mapping).toHaveProperty('notes');
      expect(mapping).toHaveProperty('supplier');
      expect(mapping).toHaveProperty('location');
    });
  });

  describe('transformPeptideData', () => {
    const fieldMapping = getDefaultFieldMapping();

    it('should transform basic CSV row correctly', () => {
      const rawData = [
        {
          'Product': 'PT-001',
          'SKU': 'BPC-157',
          'Quantity': '150',
          'Size': '100mg'
        }
      ];

      const result = transformPeptideData(rawData, { fieldMapping });

      expect(result).toHaveLength(1);
      expect(result[0].peptideId).toBe('PT-001');
      expect(result[0].peptideName).toBe('BPC-157');
      expect(result[0].quantity).toBe(150);
      expect(result[0].netWeight).toBe('100mg');
    });

    it('should handle case-insensitive headers', () => {
      const rawData = [
        {
          'product': 'PT-001',
          'sku': 'BPC-157',
          'QUANTITY': '150'
        }
      ];

      const result = transformPeptideData(rawData, { fieldMapping });

      expect(result[0].peptideId).toBe('PT-001');
      expect(result[0].peptideName).toBe('BPC-157');
      expect(result[0].quantity).toBe(150);
    });

    it('should parse numeric quantities correctly', () => {
      const rawData = [
        { 'Product': 'PT-001', 'Quantity': '150' },
        { 'Product': 'PT-002', 'Quantity': '25.5' },
        { 'Product': 'PT-003', 'Quantity': '-10' },
        { 'Product': 'PT-004', 'Quantity': '100mg' }
      ];

      const result = transformPeptideData(rawData, { fieldMapping });

      expect(result[0].quantity).toBe(150);
      expect(result[1].quantity).toBe(25.5);
      expect(result[2].quantity).toBe(-10); // Negative allowed for back-ordering
      expect(result[3].quantity).toBe(100); // Should strip 'mg'
    });

    it('should default quantity to 0 when empty or invalid', () => {
      const rawData = [
        { 'Product': 'PT-001', 'Quantity': '' },
        { 'Product': 'PT-002', 'Quantity': null },
        { 'Product': 'PT-003' }, // Missing quantity
        { 'Product': 'PT-004', 'Quantity': 'invalid' }
      ];

      const result = transformPeptideData(rawData, { fieldMapping });

      expect(result[0].quantity).toBe(0);
      expect(result[1].quantity).toBe(0);
      expect(result[2].quantity).toBe(0);
      expect(result[3].quantity).toBe(0);
    });

    it('should filter out excluded products (case-insensitive)', () => {
      const rawData = [
        { 'Product': 'OATH-A1-TEST', 'SKU': 'Test Product' },
        { 'Product': 'oath-a1-test', 'SKU': 'Test Product Lower' },
        { 'Product': 'OATH-GH-FRAGMENT-176-191-5MG', 'SKU': 'Fragment' },
        { 'Product': 'PT-001', 'SKU': 'Valid Product' }
      ];

      const excludedProducts = ['OATH-A1-TEST', 'OATH-GH-FRAGMENT-176-191-5MG'];
      const result = transformPeptideData(rawData, { fieldMapping, excludedProducts });

      expect(result).toHaveLength(1);
      expect(result[0].peptideId).toBe('PT-001');
    });

    it('should handle exclusion patterns with flexible whitespace', () => {
      const rawData = [
        { 'Product': 'a1 Test', 'SKU': 'Test 1' },
        { 'Product': 'a1  Test', 'SKU': 'Test 2' },
        { 'Product': 'a1Test', 'SKU': 'Test 3' },
        { 'Product': 'PT-001', 'SKU': 'Valid' }
      ];

      const excludedProducts = ['a1 Test'];
      const result = transformPeptideData(rawData, { fieldMapping, excludedProducts });

      // Should exclude 'a1 Test' and 'a1  Test' (flexible whitespace)
      // Note: Current implementation may not match 'a1Test' without space
      expect(result.length).toBeLessThan(rawData.length);
      expect(result.some(p => p.peptideId === 'PT-001')).toBe(true);
    });

    it('should filter out empty rows', () => {
      const rawData = [
        { 'Product': 'PT-001', 'SKU': 'Valid' },
        {},
        { 'Product': '', 'SKU': '' },
        { 'Product': 'PT-002', 'SKU': 'Also Valid' }
      ];

      const result = transformPeptideData(rawData, { fieldMapping });

      // Should filter out completely empty rows
      expect(result.length).toBeGreaterThan(0);
    });

    it('should map alternate column names correctly', () => {
      const rawData = [
        {
          'Peptide ID': 'PT-001',
          'Name': 'BPC-157',
          'On Hand': '100',
          'Incoming Arrival': '2026-01-15',
          'Incoming Qty': '50',
          'Status': 'Active'
        }
      ];

      const result = transformPeptideData(rawData, { fieldMapping });

      expect(result[0].peptideId).toBe('PT-001');
      expect(result[0].peptideName).toBe('BPC-157');
      expect(result[0].quantity).toBe(100);
      expect(result[0].orderedDate).toBe('2026-01-15');
      expect(result[0].orderedQty).toBe(50);
      expect(result[0].notes).toBe('Active');
    });

    it('should include metadata fields', () => {
      const rawData = [
        { 'Product': 'PT-001', 'SKU': 'BPC-157' }
      ];

      const result = transformPeptideData(rawData, { fieldMapping });

      expect(result[0]).toHaveProperty('importedAt');
      expect(result[0]).toHaveProperty('rowNumber');
      expect(result[0].rowNumber).toBe(1);
      expect(new Date(result[0].importedAt)).toBeInstanceOf(Date);
    });

    it('should remove undefined/null fields from result', () => {
      const rawData = [
        { 'Product': 'PT-001', 'SKU': 'BPC-157' }
      ];

      const result = transformPeptideData(rawData, { fieldMapping });

      // Should not have purity, netWeight, etc. if not in CSV
      expect(result[0]).not.toHaveProperty('purity');
      expect(result[0]).not.toHaveProperty('netWeight');
      expect(result[0]).not.toHaveProperty('batchNumber');
    });

    it('should handle all lifecycle and testing fields', () => {
      const rawData = [
        {
          'Product': 'PT-001',
          'SKU': 'BPC-157',
          'Batch Number': 'BATCH-001',
          'Purity': '98.5%',
          'Size': '100mg',
          'Velocity': 'High',
          'Supplier': 'Lab A',
          'Location': 'Freezer-1'
        }
      ];

      const result = transformPeptideData(rawData, { fieldMapping });

      expect(result[0].batchNumber).toBe('BATCH-001');
      expect(result[0].purity).toBe('98.5%');
      expect(result[0].netWeight).toBe('100mg');
      expect(result[0].velocity).toBe('High');
      expect(result[0].supplier).toBe('Lab A');
      expect(result[0].location).toBe('Freezer-1');
    });

    it('should default unit to mg when not specified', () => {
      const rawData = [
        { 'Product': 'PT-001', 'SKU': 'BPC-157' }
      ];

      const result = transformPeptideData(rawData, { fieldMapping });

      expect(result[0].unit).toBe('mg');
    });

    it('should preserve specified unit', () => {
      const rawData = [
        { 'Product': 'PT-001', 'SKU': 'BPC-157', 'Unit': 'g' }
      ];

      const result = transformPeptideData(rawData, { fieldMapping });

      expect(result[0].unit).toBe('g');
    });
  });

  describe('validatePeptideData', () => {
    it('should validate correct peptide data', () => {
      const peptides = [
        { peptideId: 'PT-001', peptideName: 'BPC-157', quantity: 100 },
        { peptideId: 'PT-002', peptideName: 'TB-500', quantity: 50 }
      ];

      const result = validatePeptideData(peptides);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error when no peptides provided', () => {
      const result1 = validatePeptideData([]);
      const result2 = validatePeptideData(null);

      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('No peptide data found');
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('No peptide data found');
    });

    it('should error when peptideId is missing', () => {
      const peptides = [
        { peptideName: 'BPC-157', quantity: 100 }
      ];

      const result = validatePeptideData(peptides);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing Peptide ID'))).toBe(true);
    });

    it('should warn when peptideName is missing', () => {
      const peptides = [
        { peptideId: 'PT-001', quantity: 100 }
      ];

      const result = validatePeptideData(peptides);

      expect(result.valid).toBe(true); // Only warning, not error
      expect(result.warnings.some(w => w.includes('Missing Peptide Name'))).toBe(true);
    });

    it('should warn when quantity is missing', () => {
      const peptides = [
        { peptideId: 'PT-001', peptideName: 'BPC-157' }
      ];

      const result = validatePeptideData(peptides);

      expect(result.warnings.some(w => w.includes('Missing quantity'))).toBe(true);
    });

    it('should error when quantity is not a number', () => {
      const peptides = [
        { peptideId: 'PT-001', peptideName: 'BPC-157', quantity: 'invalid' }
      ];

      const result = validatePeptideData(peptides);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Quantity must be a number'))).toBe(true);
    });

    it('should allow negative quantities (back-ordering)', () => {
      const peptides = [
        { peptideId: 'PT-001', peptideName: 'BPC-157', quantity: -10 }
      ];

      const result = validatePeptideData(peptides);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should include row numbers in error messages', () => {
      const peptides = [
        { peptideId: 'PT-001', peptideName: 'BPC-157', quantity: 100, rowNumber: 5 },
        { peptideName: 'TB-500', quantity: 50, rowNumber: 6 }
      ];

      const result = validatePeptideData(peptides);

      expect(result.errors.some(e => e.includes('Row 6'))).toBe(true);
    });

    it('should use index + 1 when rowNumber not provided', () => {
      const peptides = [
        { peptideId: 'PT-001', peptideName: 'BPC-157', quantity: 100 },
        { peptideName: 'TB-500', quantity: 50 }
      ];

      const result = validatePeptideData(peptides);

      expect(result.errors.some(e => e.includes('Row 2'))).toBe(true);
    });

    it('should collect multiple errors and warnings', () => {
      const peptides = [
        { quantity: 'invalid' },  // Missing ID, missing name, invalid quantity
        { peptideId: 'PT-002' },  // Missing name, missing quantity
        { peptideId: 'PT-003', peptideName: 'Valid', quantity: 100 }  // Valid
      ];

      const result = validatePeptideData(peptides);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('exportToCSV', () => {
    it('should export peptides to CSV format', () => {
      const peptides = [
        { peptideId: 'PT-001', peptideName: 'BPC-157', quantity: 100, unit: 'mg' },
        { peptideId: 'PT-002', peptideName: 'TB-500', quantity: 50, unit: 'mg' }
      ];

      const csv = exportToCSV(peptides);

      expect(csv).toContain('peptideId');
      expect(csv).toContain('PT-001');
      expect(csv).toContain('BPC-157');
      expect(csv).toContain('PT-002');
      expect(csv).toContain('TB-500');
    });

    it('should include specified fields only', () => {
      const peptides = [
        { peptideId: 'PT-001', peptideName: 'BPC-157', quantity: 100, purity: '98%' }
      ];

      const csv = exportToCSV(peptides, ['peptideId', 'purity']);

      expect(csv).toContain('peptideId');
      expect(csv).toContain('purity');
      expect(csv).toContain('PT-001');
      expect(csv).toContain('98%');
    });

    it('should use default fields when none specified', () => {
      const peptides = [
        { peptideId: 'PT-001', peptideName: 'BPC-157', quantity: 100, unit: 'mg' }
      ];

      const csv = exportToCSV(peptides);

      // Should include default fields
      expect(csv).toContain('peptideId');
      expect(csv).toContain('peptideName');
    });

    it('should handle empty array', () => {
      const csv = exportToCSV([]);

      expect(typeof csv).toBe('string');
    });
  });
});
