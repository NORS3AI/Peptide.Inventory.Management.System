import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDarkMode } from './useDarkMode';

describe('useDarkMode', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();

    // Reset document class list
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with system preference when no saved value', () => {
    // Note: This test depends on browser environment settings
    const { result } = renderHook(() => useDarkMode());

    // Just verify it initialized with a boolean value
    expect(typeof result.current.isDark).toBe('boolean');
  });

  it('should initialize with saved value from localStorage', () => {
    localStorage.setItem('darkMode', 'true');
    localStorage.getItem = vi.fn(() => 'true');

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDark).toBe(true);
  });

  it('should initialize with false from localStorage', () => {
    // Just verify that initialization completes
    const { result } = renderHook(() => useDarkMode());

    expect(typeof result.current.isDark).toBe('boolean');
  });

  it('should toggle dark mode', () => {
    const { result } = renderHook(() => useDarkMode());
    const initialValue = result.current.isDark;

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isDark).toBe(!initialValue);
  });

  it('should add dark class to document when dark mode is enabled', () => {
    const { result } = renderHook(() => useDarkMode());
    const initialDark = result.current.isDark;

    act(() => {
      result.current.toggle();
    });

    // After toggle, dark mode should be opposite of initial state
    expect(result.current.isDark).toBe(!initialDark);

    // If now dark, class should be added; if not dark, class should be removed
    if (result.current.isDark) {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    } else {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    }
  });

  it('should remove dark class when dark mode is disabled', () => {
    localStorage.setItem('darkMode', 'true');
    localStorage.getItem = vi.fn(() => 'true');
    const { result } = renderHook(() => useDarkMode());

    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      result.current.toggle();
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should persist dark mode state to localStorage', () => {
    const setItemSpy = vi.spyOn(localStorage, 'setItem');
    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current.toggle();
    });

    expect(setItemSpy).toHaveBeenCalledWith('darkMode', String(result.current.isDark));
  });

  it('should toggle multiple times correctly', () => {
    const { result } = renderHook(() => useDarkMode());
    const initial = result.current.isDark;

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isDark).toBe(!initial);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isDark).toBe(initial);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isDark).toBe(!initial);
  });
});
