import localforage from 'localforage';

// Initialize IndexedDB stores
const peptideStore = localforage.createInstance({
  name: 'OathInventory',
  storeName: 'peptides',
  description: 'Peptide inventory data'
});

const orderStore = localforage.createInstance({
  name: 'OathInventory',
  storeName: 'orders',
  description: 'Peptide orders and lifecycle tracking'
});

const labelStore = localforage.createInstance({
  name: 'OathInventory',
  storeName: 'labels',
  description: 'Label inventory and tracking'
});

const settingsStore = localforage.createInstance({
  name: 'OathInventory',
  storeName: 'settings',
  description: 'Application settings and configuration'
});

const transactionStore = localforage.createInstance({
  name: 'OathInventory',
  storeName: 'transactions',
  description: 'Sales and usage transactions for velocity tracking'
});

const velocityHistoryStore = localforage.createInstance({
  name: 'OathInventory',
  storeName: 'velocityHistory',
  description: 'Historical velocity data for trend tracking'
});

const snapshotStore = localforage.createInstance({
  name: 'OathInventory',
  storeName: 'snapshots',
  description: 'Daily inventory snapshots for comparison'
});

const taskStore = localforage.createInstance({
  name: 'OathInventory',
  storeName: 'tasks',
  description: 'Daily and weekly task management with expiration dates'
});

const minutesStore = localforage.createInstance({
  name: 'OathInventory',
  storeName: 'minutes',
  description: 'Team meeting minutes and action items'
});

/**
 * Database service for Oath Inventory System
 * Uses IndexedDB via localforage for client-side data persistence
 */
export const db = {
  // Peptide operations
  peptides: {
    async getAll() {
      const peptides = [];
      await peptideStore.iterate((value) => {
        peptides.push(value);
      });
      return peptides.sort((a, b) => (a.nickname || a.peptideId).localeCompare(b.nickname || b.peptideId));
    },

    async get(id) {
      return await peptideStore.getItem(id);
    },

    async set(id, data) {
      return await peptideStore.setItem(id, {
        ...data,
        id,
        updatedAt: new Date().toISOString()
      });
    },

    async update(id, updates) {
      const existing = await peptideStore.getItem(id);
      if (!existing) throw new Error(`Peptide ${id} not found`);

      return await peptideStore.setItem(id, {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    },

    async delete(id) {
      return await peptideStore.removeItem(id);
    },

    async clear() {
      return await peptideStore.clear();
    },

    async bulkImport(peptides) {
      const results = [];
      for (const peptide of peptides) {
        const id = peptide.peptideId || peptide.id;
        // Preserve labeledCount from existing peptide if present
        const existing = await this.get(id);
        const mergedData = {
          ...peptide,
          labeledCount: existing?.labeledCount ?? (peptide.labeledCount || 0)
        };
        results.push(await this.set(id, mergedData));
      }
      return results;
    }
  },

  // Order/Lifecycle operations
  orders: {
    async getAll() {
      const orders = [];
      await orderStore.iterate((value) => {
        orders.push(value);
      });
      return orders.sort((a, b) =>
        new Date(b.dateOrdered || 0) - new Date(a.dateOrdered || 0)
      );
    },

    async getByPeptideId(peptideId) {
      const orders = [];
      await orderStore.iterate((value) => {
        if (value.peptideId === peptideId) {
          orders.push(value);
        }
      });
      return orders;
    },

    async get(id) {
      return await orderStore.getItem(id);
    },

    async set(id, data) {
      return await orderStore.setItem(id, {
        ...data,
        id,
        updatedAt: new Date().toISOString()
      });
    },

    async update(id, updates) {
      const existing = await orderStore.getItem(id);
      if (!existing) throw new Error(`Order ${id} not found`);

      return await orderStore.setItem(id, {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    },

    async delete(id) {
      return await orderStore.removeItem(id);
    },

    async clear() {
      return await orderStore.clear();
    }
  },

  // Label operations
  labels: {
    async getInventory() {
      return await labelStore.getItem('inventory') || { count: 0, lastUpdated: null };
    },

    async setInventory(count) {
      return await labelStore.setItem('inventory', {
        count,
        lastUpdated: new Date().toISOString()
      });
    },

    async getLabeled() {
      const labeled = [];
      await labelStore.iterate((value, key) => {
        if (key !== 'inventory') {
          labeled.push(value);
        }
      });
      return labeled;
    },

    async markLabeled(peptideId, batchNumber, data = {}) {
      const id = `${peptideId}-${batchNumber}`;
      return await labelStore.setItem(id, {
        peptideId,
        batchNumber,
        dateLabeled: new Date().toISOString(),
        ...data
      });
    },

    async isLabeled(peptideId, batchNumber) {
      const id = `${peptideId}-${batchNumber}`;
      const labeled = await labelStore.getItem(id);
      return !!labeled;
    },

    async clear() {
      return await labelStore.clear();
    }
  },

  // Settings operations
  settings: {
    async get(key) {
      return await settingsStore.getItem(key);
    },

    async set(key, value) {
      return await settingsStore.setItem(key, value);
    },

    async getAll() {
      const settings = {};
      await settingsStore.iterate((value, key) => {
        settings[key] = value;
      });
      return settings;
    },

    async getStockThresholds() {
      return await settingsStore.getItem('stockThresholds') || {
        outOfStock: 0,
        nearlyOut: 10,
        lowStock: 25,
        goodStock: 50
      };
    },

    async setStockThresholds(thresholds) {
      return await settingsStore.setItem('stockThresholds', thresholds);
    }
  },

  // Transaction operations (for sales velocity tracking)
  transactions: {
    async getAll() {
      const transactions = [];
      await transactionStore.iterate((value) => {
        transactions.push(value);
      });
      return transactions.sort((a, b) =>
        new Date(b.date || 0) - new Date(a.date || 0)
      );
    },

    async getByPeptideId(peptideId) {
      const transactions = [];
      await transactionStore.iterate((value) => {
        if (value.peptideId === peptideId) {
          transactions.push(value);
        }
      });
      return transactions.sort((a, b) =>
        new Date(a.date || 0) - new Date(b.date || 0)
      );
    },

    async getByDateRange(startDate, endDate) {
      const transactions = [];
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();

      await transactionStore.iterate((value) => {
        const txDate = new Date(value.date).getTime();
        if (txDate >= start && txDate <= end) {
          transactions.push(value);
        }
      });
      return transactions.sort((a, b) =>
        new Date(a.date || 0) - new Date(b.date || 0)
      );
    },

    async record(peptideId, quantity, type = 'sale', notes = '') {
      const id = `${peptideId}-${Date.now()}`;
      const transaction = {
        id,
        peptideId,
        quantity: Number(quantity),
        type, // 'sale', 'adjustment', 'return', etc.
        date: new Date().toISOString(),
        notes,
        createdAt: new Date().toISOString()
      };

      return await transactionStore.setItem(id, transaction);
    },

    async delete(id) {
      return await transactionStore.removeItem(id);
    },

    async clear() {
      return await transactionStore.clear();
    }
  },

  // Velocity History operations
  velocityHistory: {
    /**
     * Get velocity history for a specific peptide
     * @param {string} peptideId - Peptide ID to get history for
     * @returns {Promise<array>} Array of velocity history entries
     */
    async get(peptideId) {
      const history = await velocityHistoryStore.getItem(peptideId);
      return history || [];
    },

    /**
     * Add velocity entry to history (only if changed)
     * Keeps up to 10 most recent entries
     * @param {string} peptideId - Peptide ID
     * @param {string} velocity - New velocity value
     * @returns {Promise<array>} Updated history
     */
    async add(peptideId, velocity) {
      if (!velocity) return await this.get(peptideId);

      const history = await this.get(peptideId);

      // Only add if velocity changed from the most recent entry
      if (history.length > 0 && history[history.length - 1].velocity === velocity) {
        return history; // No change, don't add duplicate
      }

      const entry = {
        velocity,
        timestamp: new Date().toISOString(),
        importDate: new Date().toISOString()
      };

      history.push(entry);

      // Keep only the last 10 entries
      const trimmedHistory = history.slice(-10);

      await velocityHistoryStore.setItem(peptideId, trimmedHistory);
      return trimmedHistory;
    },

    /**
     * Get the most recent velocity for a peptide
     * @param {string} peptideId - Peptide ID
     * @returns {Promise<string|null>} Most recent velocity or null
     */
    async getLatest(peptideId) {
      const history = await this.get(peptideId);
      if (history.length === 0) return null;
      return history[history.length - 1].velocity;
    },

    /**
     * Get velocity comparison between current and previous
     * @param {string} peptideId - Peptide ID
     * @returns {Promise<object>} Comparison object with current, previous, and changed flag
     */
    async getComparison(peptideId) {
      const history = await this.get(peptideId);
      if (history.length === 0) {
        return { current: null, previous: null, changed: false, trend: 'new' };
      }

      const current = history[history.length - 1].velocity;
      const previous = history.length > 1 ? history[history.length - 2].velocity : null;

      return {
        current,
        previous,
        changed: previous !== null && current !== previous,
        trend: this._analyzeTrend(current, previous),
        history: history.slice(-5) // Return last 5 for context
      };
    },

    /**
     * Analyze velocity trend
     * @private
     */
    _analyzeTrend(current, previous) {
      if (!previous) return 'new';
      if (!current) return 'unknown';

      // Simple trend analysis - you can enhance this based on your velocity format
      const currentLower = current.toLowerCase();
      const previousLower = previous.toLowerCase();

      if (currentLower === previousLower) return 'stable';

      // If velocity values are numeric, compare them
      const currentNum = parseFloat(current);
      const previousNum = parseFloat(previous);

      if (!isNaN(currentNum) && !isNaN(previousNum)) {
        if (currentNum > previousNum) return 'increasing';
        if (currentNum < previousNum) return 'decreasing';
        return 'stable';
      }

      return 'changed';
    },

    /**
     * Clear history for a specific peptide
     */
    async clear(peptideId) {
      return await velocityHistoryStore.removeItem(peptideId);
    },

    /**
     * Clear all velocity history
     */
    async clearAll() {
      return await velocityHistoryStore.clear();
    }
  },

  // Snapshot operations (for inventory comparison)
  snapshots: {
    async save(peptides, label = '') {
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const id = label || date;
      const snapshot = {
        id,
        date,
        timestamp: new Date().toISOString(),
        label: label || date,
        itemCount: peptides.length,
        items: peptides.map(p => ({
          peptideId: p.peptideId,
          peptideName: p.peptideName || '',
          nickname: p.nickname || '',
          batchNumber: p.batchNumber || '',
          quantity: Number(p.quantity) || 0,
          labeledCount: Number(p.labeledCount) || 0,
          purity: p.purity || '',
          netWeight: p.netWeight || ''
        }))
      };
      await snapshotStore.setItem(id, snapshot);
      return snapshot;
    },

    async getAll() {
      const snapshots = [];
      await snapshotStore.iterate((value) => {
        snapshots.push({ id: value.id, date: value.date, timestamp: value.timestamp, label: value.label, itemCount: value.itemCount });
      });
      return snapshots.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    },

    async get(id) {
      return await snapshotStore.getItem(id);
    },

    async delete(id) {
      return await snapshotStore.removeItem(id);
    },

    async saveDailyIfNeeded(peptides) {
      const today = new Date().toISOString().split('T')[0];
      const existing = await snapshotStore.getItem(today);
      if (!existing && peptides.length > 0) {
        await this.save(peptides, today);
        return true;
      }
      return false;
    },

    async clear() {
      return await snapshotStore.clear();
    }
  },

  // Task operations (for daily/weekly task management)
  tasks: {
    async getAll() {
      const tasks = [];
      await taskStore.iterate((value) => {
        tasks.push(value);
      });
      return tasks.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    },

    async getAllActive() {
      const tasks = [];
      await taskStore.iterate((value) => {
        if (!value.completed) {
          tasks.push(value);
        }
      });
      // Sort by urgency: critical first, then by expiration date
      return tasks.sort((a, b) => {
        // Critical tasks first
        if (a.priority === 'critical' && b.priority !== 'critical') return -1;
        if (b.priority === 'critical' && a.priority !== 'critical') return 1;

        // Then by expiration date (soonest first)
        const aExp = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
        const bExp = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
        return aExp - bExp;
      });
    },

    async get(id) {
      return await taskStore.getItem(id);
    },

    async create(taskData) {
      const id = `task-${Date.now()}`;
      const task = {
        id,
        title: taskData.title || '',
        description: taskData.description || '',
        type: taskData.type || 'daily', // 'daily' or 'weekly'
        priority: taskData.priority || 'normal', // 'critical', 'high', 'normal', 'low'
        expirationDate: taskData.expirationDate || null,
        completed: false,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await taskStore.setItem(id, task);
      return task;
    },

    async update(id, updates) {
      const existing = await taskStore.getItem(id);
      if (!existing) throw new Error(`Task ${id} not found`);

      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await taskStore.setItem(id, updated);
      return updated;
    },

    async complete(id) {
      return await this.update(id, {
        completed: true,
        completedAt: new Date().toISOString()
      });
    },

    async uncomplete(id) {
      return await this.update(id, {
        completed: false,
        completedAt: null
      });
    },

    async delete(id) {
      return await taskStore.removeItem(id);
    },

    async clear() {
      return await taskStore.clear();
    },

    // Get tasks that need attention (critical or expiring soon)
    async getUrgent() {
      const tasks = await this.getAllActive();
      const now = new Date().getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;

      return tasks.filter(task => {
        // Critical priority
        if (task.priority === 'critical') return true;

        // Expiring within 24 hours
        if (task.expirationDate) {
          const expTime = new Date(task.expirationDate).getTime();
          return expTime - now <= oneDayMs;
        }

        return false;
      });
    }
  },

  // Minutes operations (for team meeting minutes)
  minutes: {
    async getAll() {
      const minutes = [];
      await minutesStore.iterate((value) => {
        minutes.push(value);
      });
      return minutes.sort((a, b) => new Date(b.meetingDate || 0) - new Date(a.meetingDate || 0));
    },

    async get(id) {
      return await minutesStore.getItem(id);
    },

    async create(minuteData) {
      const id = `meeting-${Date.now()}`;
      const minute = {
        id,
        title: minuteData.title || '',
        meetingDate: minuteData.meetingDate || new Date().toISOString(),
        notes: minuteData.notes || '',
        attendees: minuteData.attendees || [],
        actionItems: minuteData.actionItems || [], // Array of { member: string, task: string, completed: boolean }
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await minutesStore.setItem(id, minute);
      return minute;
    },

    async update(id, updates) {
      const existing = await minutesStore.getItem(id);
      if (!existing) throw new Error(`Meeting minute ${id} not found`);

      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await minutesStore.setItem(id, updated);
      return updated;
    },

    async delete(id) {
      return await minutesStore.removeItem(id);
    },

    async clear() {
      return await minutesStore.clear();
    }
  },

  // Utility operations
  async clearAll() {
    await peptideStore.clear();
    await orderStore.clear();
    await labelStore.clear();
    await settingsStore.clear();
    await transactionStore.clear();
    await velocityHistoryStore.clear();
    await snapshotStore.clear();
    await taskStore.clear();
    await minutesStore.clear();
  },

  async exportData() {
    const peptides = await this.peptides.getAll();
    const orders = await this.orders.getAll();
    const labels = await this.labels.getLabeled();
    const settings = await this.settings.getAll();
    const transactions = await this.transactions.getAll();
    const snapshots = await this.snapshots.getAll();
    const tasks = await this.tasks.getAll();
    const minutes = await this.minutes.getAll();

    // Export velocity history for all peptides
    const velocityHistory = {};
    for (const peptide of peptides) {
      const history = await this.velocityHistory.get(peptide.id);
      if (history && history.length > 0) {
        velocityHistory[peptide.id] = history;
      }
    }

    return {
      version: '2.0',
      exportDate: new Date().toISOString(),
      data: {
        peptides,
        orders,
        labels,
        settings,
        transactions,
        velocityHistory,
        snapshots,
        tasks,
        minutes
      }
    };
  },

  async importData(exportedData) {
    if (!exportedData.data) throw new Error('Invalid export data format');

    const { peptides, orders, labels, settings, transactions, velocityHistory, snapshots, tasks, minutes } = exportedData.data;

    // Import peptides
    if (peptides) {
      for (const peptide of peptides) {
        await this.peptides.set(peptide.id, peptide);
      }
    }

    // Import orders
    if (orders) {
      for (const order of orders) {
        await this.orders.set(order.id, order);
      }
    }

    // Import labels
    if (labels) {
      for (const label of labels) {
        const id = `${label.peptideId}-${label.batchNumber}`;
        await labelStore.setItem(id, label);
      }
    }

    // Import settings
    if (settings) {
      for (const [key, value] of Object.entries(settings)) {
        await this.settings.set(key, value);
      }
    }

    // Import transactions
    if (transactions) {
      for (const transaction of transactions) {
        await transactionStore.setItem(transaction.id, transaction);
      }
    }

    // Import velocity history
    if (velocityHistory) {
      for (const [peptideId, history] of Object.entries(velocityHistory)) {
        await velocityHistoryStore.setItem(peptideId, history);
      }
    }

    // Import snapshots
    if (snapshots) {
      for (const snapshot of snapshots) {
        await this.snapshots.save(snapshot.label || snapshot.date, snapshot.data, snapshot.date);
      }
    }

    // Import tasks
    if (tasks) {
      for (const task of tasks) {
        await taskStore.setItem(task.id, task);
      }
    }

    // Import meeting minutes
    if (minutes) {
      for (const minute of minutes) {
        await minutesStore.setItem(minute.id, minute);
      }
    }

    return true;
  }
};

export default db;
