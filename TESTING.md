# Testing Documentation

## Overview

The Oath Research Peptide Inventory System includes a comprehensive test suite built with Vitest and React Testing Library. All 111 tests are passing, providing confidence in the core business logic, data layer, and UI components.

## Test Infrastructure

### Technology Stack

- **Vitest**: Fast, modern test framework compatible with Vite
- **React Testing Library**: Testing utilities for React components
- **@testing-library/jest-dom**: Custom matchers for DOM assertions
- **happy-dom**: Lightweight DOM environment for faster tests

### Configuration

- **vitest.config.js**: Main configuration file
- **src/test/setup.js**: Test setup with mocks for localStorage and matchMedia
- Coverage provider: v8
- Test environment: happy-dom

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once (CI mode)
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Coverage

### Unit Tests (111 tests total)

#### 1. Stock Status (19 tests)
**File**: `src/utils/stockStatus.test.js`

Tests the color-coded stock status system:
- Status calculation based on quantity thresholds
- ON_ORDER status when hasActiveOrder flag is true
- Support for negative quantities (back-ordering)
- Custom threshold configurations
- Status priority sorting
- Default threshold values

**Coverage**:
- `calculateStockStatus()`: All edge cases including negative quantities
- `getStatusConfig()`: Valid and invalid status codes
- `needsOrdering()`: All stock statuses
- `sortByStatusPriority()`: Array sorting and immutability

#### 2. Sales Readiness (20 tests)
**File**: `src/utils/salesReadiness.test.js`

Tests the three-point validation system (Purity + Net Weight + Label):
- Individual requirement checks
- Combined validation logic
- Missing requirement detection
- Filtering by readiness status
- Statistics calculation

**Coverage**:
- `checkSalesReadiness()`: All combinations of missing requirements
- `getReadinessConfig()`: Both READY and BLOCKED states
- `filterByReadiness()`: ALL, READY, and BLOCKED filters
- `getReadinessStats()`: Comprehensive statistics

#### 3. CSV Parser (29 tests)
**File**: `src/utils/csvParser.test.js`

Tests the flexible CSV import system:
- Field mapping with multiple column name variations
- Case-insensitive header matching
- Numeric quantity parsing (including negatives)
- Product exclusion with regex patterns
- Empty row filtering
- Metadata field generation
- CSV export functionality

**Coverage**:
- `transformPeptideData()`: All field mappings and transformations
- `getDefaultFieldMapping()`: Complete field mapping structure
- `validatePeptideData()`: Required fields, warnings, and errors
- `exportToCSV()`: Export with default and custom fields

**Key Features Tested**:
- Product → Peptide ID mapping
- SKU → Name mapping
- Size → Net Weight mapping
- Status → Notes mapping
- Incoming Arrival → Ordered Date mapping
- Case-insensitive exclusion patterns (e.g., "a1 Test" matches "A1 TEST")
- Negative quantities for back-ordering

#### 4. Database Layer (26 tests)
**File**: `src/lib/db.test.js`

Tests the IndexedDB abstraction layer structure:
- All four stores (peptides, orders, labels, settings)
- CRUD operations availability
- Specialized methods (bulkImport, getByPeptideId)
- Store structure validation

**Coverage**:
- `db.peptides`: getAll, get, set, update, delete, clear, bulkImport
- `db.orders`: getAll, get, set, update, delete, clear, getByPeptideId
- `db.labels`: getInventory, setInventory, getLabeled, markLabeled, isLabeled, clear
- `db.settings`: get, set, getAll, getStockThresholds, setStockThresholds

**Note**: These tests verify the API structure. Full integration testing with actual IndexedDB operations would require browser environment.

#### 5. Dark Mode Hook (8 tests)
**File**: `src/hooks/useDarkMode.test.js`

Tests the dark mode functionality:
- Initialization from localStorage
- System preference fallback
- Toggle functionality
- DOM class manipulation
- localStorage persistence

**Coverage**:
- Initial state management
- Toggle state changes
- Document class list updates
- localStorage read/write operations

#### 6. Toast Component (9 tests)
**File**: `src/components/Toast.test.jsx`

Tests the toast notification system:
- Provider initialization
- Context availability
- Toast display for all types (success, error, warning, info)
- Error handling when used without provider

**Coverage**:
- `ToastProvider`: Rendering and context provision
- `useToast`: All toast methods (success, error, warning, info)
- Error boundary behavior

## Test Results

```
Test Files: 6 passed (6)
Tests:      111 passed (111)
Duration:   ~3.5s
```

### Breakdown by File

| File | Tests | Status |
|------|-------|--------|
| stockStatus.test.js | 19 | ✓ All passing |
| salesReadiness.test.js | 20 | ✓ All passing |
| csvParser.test.js | 29 | ✓ All passing |
| db.test.js | 26 | ✓ All passing |
| useDarkMode.test.js | 8 | ✓ All passing |
| Toast.test.jsx | 9 | ✓ All passing |

## Testing Best Practices

### 1. Test Organization
- Each test file mirrors the source file structure
- Tests are grouped by describe blocks for logical organization
- Test names clearly describe what is being tested

### 2. Test Isolation
- Each test is independent and can run in any order
- beforeEach/afterEach hooks ensure clean state
- No shared mutable state between tests

### 3. Edge Cases
- Negative quantities (back-ordering)
- Null/undefined values
- Empty arrays and objects
- Invalid inputs
- Case-insensitive matching

### 4. Real-World Scenarios
- Multiple field name variations for CSV columns
- Complex product exclusion patterns
- Three-point validation with partial requirements
- Status transitions with active orders

## Continuous Integration

Tests are designed to run in CI/CD pipelines:

```bash
# CI mode (exits with code 0 or 1)
npm run test:run
```

## End-to-End Tests (Playwright)

### Test Infrastructure

E2E tests are built with Playwright and cover all critical user workflows across multiple browsers and devices.

**Configuration**: `playwright.config.js`

**Test Files** (in `e2e/` directory):
- `navigation.spec.js` - Tab navigation, dark mode, state persistence
- `dashboard.spec.js` - Dashboard display and status legend
- `csv-import.spec.js` - CSV import workflow
- `inventory.spec.js` - Inventory management and quick edit
- `labeling.spec.js` - Label management and priority queue
- `sales-ready.spec.js` - Sales readiness validation
- `reports.spec.js` - Reports and analytics

### Running E2E Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

### Browser Coverage

E2E tests run on:
- Desktop Chrome
- Desktop Firefox
- Desktop Safari
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)
- iPad Pro

### What's Tested

#### Navigation Tests
- Application loads correctly
- All tabs are accessible
- Active tab highlighting
- Dark mode toggle and persistence
- Version display
- Footer content

#### Dashboard Tests
- Stock status legend display
- Quick stats accuracy
- Action items vs getting started
- All 5 status types visible

#### CSV Import Tests
- Import UI components
- Field mapping guide
- Import mode selection
- Exclusion manager
- Data persistence

#### Inventory Tests
- Table display and controls
- Search functionality
- Column management
- Quick edit modal
- Order workflow
- Export functionality

#### Label Management Tests
- Label inventory display
- Priority queue algorithm
- Apply/remove labels
- Labeled peptides list

#### Sales Ready Tests
- Three-point validation
- Filter options (All/Ready/Blocked)
- Status indicators
- Missing requirements display

#### Reports Tests
- All report sections
- Export buttons
- Operational metrics
- Stock breakdown
- Low stock items

### User Acceptance Testing

A comprehensive UAT checklist is available in `UAT-CHECKLIST.md` covering:
- All features and workflows
- Cross-browser compatibility
- Mobile/tablet testing
- Performance validation
- Error handling
- Edge cases
- Business logic verification

The checklist includes 200+ test cases organized into 15 categories.

## Debugging Tests

### Run specific test file
```bash
npx vitest src/utils/stockStatus.test.js
```

### Run tests in watch mode
```bash
npm test
```

### Run tests with UI
```bash
npm run test:ui
```

### View coverage report
```bash
npm run test:coverage
# Open coverage/index.html in browser
```

## Known Limitations

1. **Database Tests**: Current tests verify API structure only. Full integration tests with actual IndexedDB require browser environment.

2. **Timer Tests**: Toast auto-dismiss tests are simplified due to timer complexity in test environment. Functionality works correctly in production.

3. **LocalStorage Mocking**: Some tests use simplified localStorage mocks. Full E2E tests would verify actual browser storage.

## Contributing

When adding new features:

1. Write tests first (TDD approach when possible)
2. Ensure all existing tests pass: `npm run test:run`
3. Aim for >80% code coverage
4. Include edge cases and error scenarios
5. Document complex test scenarios

## Support

For questions about testing:
- Review existing test files for examples
- Check Vitest documentation: https://vitest.dev
- Check React Testing Library docs: https://testing-library.com/react
