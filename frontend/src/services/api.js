// API client for backend communication with authentication
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const TOKEN_KEY = 'oath_auth_token';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ========== TOKEN MANAGEMENT ==========

export const authStorage = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  isAuthenticated() {
    return !!this.getToken();
  }
};

// ========== HTTP HELPERS ==========

function getAuthHeaders() {
  const token = authStorage.getToken();
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

async function handleResponse(response) {
  if (!response.ok) {
    // Handle 401 Unauthorized - clear token and redirect to login
    if (response.status === 401) {
      authStorage.clearToken();
      // Dispatch custom event to notify app of auth failure
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(error.error || 'Request failed', response.status);
  }
  return response.json();
}

// ========== AUTHENTICATION API ==========

export const authApi = {
  // Login with password
  async login(password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await handleResponse(response);
    if (data.token) {
      authStorage.setToken(data.token);
    }
    return data;
  },

  // Verify current token
  async verify() {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Change password
  async changePassword(currentPassword, newPassword) {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return handleResponse(response);
  },

  // Logout (client-side only)
  logout() {
    authStorage.clearToken();
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }
};

// ========== PEPTIDES API ==========

export const peptidesApi = {
  // Get all peptides
  async getAll() {
    const response = await fetch(`${API_BASE_URL}/peptides`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Get single peptide
  async get(peptideId) {
    const response = await fetch(`${API_BASE_URL}/peptides/${encodeURIComponent(peptideId)}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Create new peptide
  async create(peptide) {
    const response = await fetch(`${API_BASE_URL}/peptides`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(peptide),
    });
    return handleResponse(response);
  },

  // Update peptide
  async update(peptideId, peptide) {
    const response = await fetch(`${API_BASE_URL}/peptides/${encodeURIComponent(peptideId)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(peptide),
    });
    return handleResponse(response);
  },

  // Delete peptide
  async delete(peptideId) {
    const response = await fetch(`${API_BASE_URL}/peptides/${encodeURIComponent(peptideId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Bulk import peptides
  async bulkImport(peptides) {
    const response = await fetch(`${API_BASE_URL}/peptides/bulk`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ peptides }),
    });
    return handleResponse(response);
  },
};

// ========== EXCLUSIONS API ==========

export const exclusionsApi = {
  // Get all exclusions
  async getAll() {
    const response = await fetch(`${API_BASE_URL}/exclusions`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Add exclusion
  async add(pattern) {
    const response = await fetch(`${API_BASE_URL}/exclusions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pattern }),
    });
    return handleResponse(response);
  },

  // Delete exclusion
  async delete(pattern) {
    const response = await fetch(`${API_BASE_URL}/exclusions/${encodeURIComponent(pattern)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Bulk set exclusions
  async bulkSet(patterns) {
    const response = await fetch(`${API_BASE_URL}/exclusions/bulk`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ patterns }),
    });
    return handleResponse(response);
  },
};

// ========== LABEL HISTORY API ==========

export const labelHistoryApi = {
  // Get label history for a peptide
  async get(peptideId) {
    const response = await fetch(`${API_BASE_URL}/label-history/${encodeURIComponent(peptideId)}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Add label history entry
  async add(peptideId, quantity, action, notes = '') {
    const response = await fetch(`${API_BASE_URL}/label-history`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ peptideId, quantity, action, notes }),
    });
    return handleResponse(response);
  },
};

// ========== HEALTH CHECK ==========

export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return handleResponse(response);
  } catch (error) {
    throw new ApiError('Cannot connect to server', 0);
  }
}

export { ApiError };
