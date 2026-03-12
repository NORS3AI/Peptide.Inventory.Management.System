// Backward compatibility wrapper for transitioning from localforage to API
import { peptidesApi, exclusionsApi } from '../services/api';

// Labels are stored in localStorage since they're just a simple counter
const labelsStore = {
  async getInventory() {
    const stored = localStorage.getItem('label_inventory');
    return stored ? parseInt(stored, 10) : 0;
  },

  async setInventory(count) {
    localStorage.setItem('label_inventory', count.toString());
    return count;
  }
};

// Settings are stored in localStorage for UI preferences
const settingsStore = {
  async get(key) {
    const stored = localStorage.getItem(`setting_${key}`);
    return stored ? JSON.parse(stored) : null;
  },

  async set(key, value) {
    localStorage.setItem(`setting_${key}`, JSON.stringify(value));
    return value;
  },

  async getStockThresholds() {
    const stored = localStorage.getItem('stockThresholds');
    if (stored) {
      return JSON.parse(stored);
    }
    // Return defaults
    return {
      nearlyOut: 5,
      lowStock: 10,
      goodStock: 25
    };
  },

  async setStockThresholds(thresholds) {
    localStorage.setItem('stockThresholds', JSON.stringify(thresholds));
    return thresholds;
  }
};

// Peptides now use the API
const peptidesStore = {
  async getAll() {
    return await peptidesApi.getAll();
  },

  async get(id) {
    try {
      return await peptidesApi.get(id);
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  },

  async set(id, data) {
    try {
      await peptidesApi.get(id);
      // Exists, update
      return await peptidesApi.update(id, data);
    } catch (error) {
      if (error.status === 404) {
        // Doesn't exist, create
        return await peptidesApi.create(data);
      }
      throw error;
    }
  },

  async update(id, partialData) {
    // Get current data and merge
    const current = await peptidesApi.get(id);
    return await peptidesApi.update(id, { ...current, ...partialData });
  },

  async delete(id) {
    return await peptidesApi.delete(id);
  },

  async clear() {
    const all = await peptidesApi.getAll();
    for (const peptide of all) {
      await peptidesApi.delete(peptide.peptideId);
    }
  },

  async bulkImport(peptides) {
    return await peptidesApi.bulkImport(peptides);
  }
};

// Velocity history - store in localStorage for now
const velocityHistoryStore = {
  async add(peptideId, velocity) {
    const key = `velocity_${peptideId}`;
    const history = JSON.parse(localStorage.getItem(key) || '[]');
    history.push({
      velocity,
      timestamp: new Date().toISOString()
    });
    // Keep only last 30 entries
    if (history.length > 30) {
      history.shift();
    }
    localStorage.setItem(key, JSON.stringify(history));
  },

  async get(peptideId) {
    const key = `velocity_${peptideId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
};

export const db = {
  peptides: peptidesStore,
  settings: settingsStore,
  labels: labelsStore,
  velocityHistory: velocityHistoryStore
};
