import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/db';
import { calculateStockStatus, getDefaultThresholds } from '../utils/stockStatus';

// Default exclusions
const DEFAULT_EXCLUSIONS = [
  'OATH-A1-TEST',
  'a1 test',
  'OATH-GH-FRAGMENT-176-191-5MG',
  'OATH-GIFT-CARD',
  'gift card',
  'OATH-NAD+-1000MG',
  'OATH-SS-31-10MG',
  'OATH-TESA-IPA-10-5'
];

// Helper function to check if a peptide should be excluded
function isExcluded(peptide, exclusions) {
  if (!exclusions || exclusions.length === 0) return false;

  const peptideId = (peptide.peptideId || '').toLowerCase();
  const peptideName = (peptide.peptideName || '').toLowerCase();

  return exclusions.some(exclusion => {
    const exc = exclusion.toLowerCase();
    return peptideId.includes(exc) || peptideName.includes(exc);
  });
}

export function useInventory() {
  const [allPeptides, setAllPeptides] = useState([]);
  const [peptides, setPeptides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState(getDefaultThresholds());
  const [exclusions, setExclusions] = useState(DEFAULT_EXCLUSIONS);

  // Load exclusions from settings
  const loadExclusions = useCallback(async () => {
    try {
      const saved = await db.settings.get('exclusions');
      const exclusionList = saved && saved.length > 0 ? saved : DEFAULT_EXCLUSIONS;
      setExclusions(exclusionList);
      return exclusionList;
    } catch (error) {
      console.error('Failed to load exclusions:', error);
      setExclusions(DEFAULT_EXCLUSIONS);
      return DEFAULT_EXCLUSIONS;
    }
  }, []);

  // Load peptides from database
  const loadPeptides = useCallback(async () => {
    try {
      setLoading(true);
      const loadedPeptides = await db.peptides.getAll();
      setAllPeptides(loadedPeptides);

      // Load exclusions and filter
      const currentExclusions = await loadExclusions();
      const filtered = loadedPeptides.filter(p => !isExcluded(p, currentExclusions));
      setPeptides(filtered);
    } catch (error) {
      console.error('Failed to load peptides:', error);
      setAllPeptides([]);
      setPeptides([]);
    } finally {
      setLoading(false);
    }
  }, [loadExclusions]);

  // Load thresholds from settings
  const loadThresholds = useCallback(async () => {
    try {
      const saved = await db.settings.getStockThresholds();
      if (saved) {
        setThresholds(saved);
      } else {
        setThresholds(getDefaultThresholds());
      }
    } catch (error) {
      console.error('Failed to load thresholds:', error);
      setThresholds(getDefaultThresholds());
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadPeptides();
    loadThresholds();
  }, [loadPeptides, loadThresholds]);

  // Calculate statistics
  const stats = useCallback(() => {
    const statusCounts = {
      OUT_OF_STOCK: 0,
      NEARLY_OUT: 0,
      LOW_STOCK: 0,
      GOOD_STOCK: 0,
      ON_ORDER: 0
    };

    peptides.forEach(peptide => {
      const status = calculateStockStatus(peptide.quantity, thresholds, false);
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }
    });

    return {
      total: peptides.length,
      outOfStock: statusCounts.OUT_OF_STOCK,
      nearlyOut: statusCounts.NEARLY_OUT,
      lowStock: statusCounts.LOW_STOCK,
      goodStock: statusCounts.GOOD_STOCK,
      onOrder: statusCounts.ON_ORDER,
      needsOrdering: statusCounts.OUT_OF_STOCK + statusCounts.NEARLY_OUT + statusCounts.LOW_STOCK
    };
  }, [peptides, thresholds]);

  // Add or update peptide
  const savePeptide = useCallback(async (peptideData) => {
    try {
      const id = peptideData.peptideId || peptideData.id;
      const existing = await db.peptides.get(id);

      if (existing) {
        await db.peptides.update(id, peptideData);
      } else {
        await db.peptides.set(id, peptideData);
      }

      await loadPeptides();
      return { success: true };
    } catch (error) {
      console.error('Failed to save peptide:', error);
      return { success: false, error: error.message };
    }
  }, [loadPeptides]);

  // Delete peptide
  const deletePeptide = useCallback(async (id) => {
    try {
      await db.peptides.delete(id);
      await loadPeptides();
      return { success: true };
    } catch (error) {
      console.error('Failed to delete peptide:', error);
      return { success: false, error: error.message };
    }
  }, [loadPeptides]);

  // Update quantity
  const updateQuantity = useCallback(async (id, quantity) => {
    try {
      await db.peptides.update(id, { quantity: Number(quantity) });
      await loadPeptides();
      return { success: true };
    } catch (error) {
      console.error('Failed to update quantity:', error);
      return { success: false, error: error.message };
    }
  }, [loadPeptides]);

  // Clear all data
  const clearAll = useCallback(async () => {
    try {
      await db.peptides.clear();
      await loadPeptides();
      return { success: true };
    } catch (error) {
      console.error('Failed to clear peptides:', error);
      return { success: false, error: error.message };
    }
  }, [loadPeptides]);

  // Update thresholds
  const updateThresholds = useCallback(async (newThresholds) => {
    try {
      await db.settings.setStockThresholds(newThresholds);
      setThresholds(newThresholds);
      return { success: true };
    } catch (error) {
      console.error('Failed to update thresholds:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Bulk exclude products
  const bulkExclude = useCallback(async (peptideIds) => {
    try {
      const newExclusions = [...new Set([...exclusions, ...peptideIds])];
      await db.settings.set('exclusions', newExclusions);
      setExclusions(newExclusions);

      // Re-filter peptides
      const filtered = allPeptides.filter(p => !isExcluded(p, newExclusions));
      setPeptides(filtered);

      return { success: true };
    } catch (error) {
      console.error('Failed to bulk exclude:', error);
      return { success: false, error: error.message };
    }
  }, [exclusions, allPeptides]);

  return {
    peptides,
    allPeptides,
    loading,
    thresholds,
    exclusions,
    stats: stats(),
    refresh: loadPeptides,
    savePeptide,
    deletePeptide,
    updateQuantity,
    clearAll,
    updateThresholds,
    bulkExclude
  };
}
