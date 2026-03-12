import { describe, it, expect } from 'vitest';
import { db } from './db';

describe('Database Layer', () => {
  describe('peptides store', () => {
    it('should have getAll method', () => {
      expect(typeof db.peptides.getAll).toBe('function');
    });

    it('should have get method', () => {
      expect(typeof db.peptides.get).toBe('function');
    });

    it('should have set method', () => {
      expect(typeof db.peptides.set).toBe('function');
    });

    it('should have update method', () => {
      expect(typeof db.peptides.update).toBe('function');
    });

    it('should have delete method', () => {
      expect(typeof db.peptides.delete).toBe('function');
    });

    it('should have clear method', () => {
      expect(typeof db.peptides.clear).toBe('function');
    });

    it('should have bulkImport method', () => {
      expect(typeof db.peptides.bulkImport).toBe('function');
    });
  });

  describe('orders store', () => {
    it('should have getAll method', () => {
      expect(typeof db.orders.getAll).toBe('function');
    });

    it('should have getByPeptideId method', () => {
      expect(typeof db.orders.getByPeptideId).toBe('function');
    });

    it('should have all required order methods', () => {
      expect(db.orders).toHaveProperty('getAll');
      expect(db.orders).toHaveProperty('getByPeptideId');
      expect(db.orders).toHaveProperty('get');
      expect(db.orders).toHaveProperty('set');
      expect(db.orders).toHaveProperty('update');
      expect(db.orders).toHaveProperty('delete');
      expect(db.orders).toHaveProperty('clear');
    });
  });

  describe('labels store', () => {
    it('should have getInventory method', () => {
      expect(typeof db.labels.getInventory).toBe('function');
    });

    it('should have setInventory method', () => {
      expect(typeof db.labels.setInventory).toBe('function');
    });

    it('should have getLabeled method', () => {
      expect(typeof db.labels.getLabeled).toBe('function');
    });

    it('should have markLabeled method', () => {
      expect(typeof db.labels.markLabeled).toBe('function');
    });

    it('should have isLabeled method', () => {
      expect(typeof db.labels.isLabeled).toBe('function');
    });

    it('should have clear method', () => {
      expect(typeof db.labels.clear).toBe('function');
    });

    it('should have all required label methods', () => {
      expect(db.labels).toHaveProperty('getInventory');
      expect(db.labels).toHaveProperty('setInventory');
      expect(db.labels).toHaveProperty('getLabeled');
      expect(db.labels).toHaveProperty('markLabeled');
      expect(db.labels).toHaveProperty('isLabeled');
      expect(db.labels).toHaveProperty('clear');
    });
  });

  describe('settings store', () => {
    it('should have get method', () => {
      expect(typeof db.settings.get).toBe('function');
    });

    it('should have set method', () => {
      expect(typeof db.settings.set).toBe('function');
    });

    it('should have getAll method', () => {
      expect(typeof db.settings.getAll).toBe('function');
    });

    it('should have getStockThresholds method', () => {
      expect(typeof db.settings.getStockThresholds).toBe('function');
    });

    it('should have setStockThresholds method', () => {
      expect(typeof db.settings.setStockThresholds).toBe('function');
    });

    it('should have all required settings methods', () => {
      expect(db.settings).toHaveProperty('get');
      expect(db.settings).toHaveProperty('set');
      expect(db.settings).toHaveProperty('getAll');
      expect(db.settings).toHaveProperty('getStockThresholds');
      expect(db.settings).toHaveProperty('setStockThresholds');
    });
  });

  describe('database structure', () => {
    it('should expose all four stores', () => {
      expect(db).toHaveProperty('peptides');
      expect(db).toHaveProperty('orders');
      expect(db).toHaveProperty('labels');
      expect(db).toHaveProperty('settings');
    });

    it('should have CRUD operations for peptides', () => {
      const operations = ['getAll', 'get', 'set', 'update', 'delete', 'clear'];
      operations.forEach(op => {
        expect(db.peptides).toHaveProperty(op);
        expect(typeof db.peptides[op]).toBe('function');
      });
    });

    it('should have bulkImport for peptides', () => {
      expect(db.peptides).toHaveProperty('bulkImport');
      expect(typeof db.peptides.bulkImport).toBe('function');
    });
  });
});
