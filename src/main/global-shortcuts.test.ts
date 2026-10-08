import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config-manager
const mockLoad = vi.fn();
vi.mock('./config-manager', () => ({
  configManager: { load: () => mockLoad() },
}));

// Mock electron globalShortcut
const mockRegister = vi.fn();
const mockUnregisterAll = vi.fn();
vi.mock('electron', () => ({
  globalShortcut: {
    register: (...args: any[]) => mockRegister(...args),
    unregisterAll: () => mockUnregisterAll(),
  },
}));

import { DEFAULT_CONFIG } from '../shared/constants';

// Helper to get a fresh module (resets module-level vars)
async function freshModule() {
  vi.resetModules();
  vi.doMock('./config-manager', () => ({
    configManager: { load: () => mockLoad() },
  }));
  vi.doMock('electron', () => ({
    globalShortcut: {
      register: (...args: any[]) => mockRegister(...args),
      unregisterAll: () => mockUnregisterAll(),
    },
  }));
  return import('./global-shortcuts');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRegister.mockReturnValue(true);
  mockLoad.mockReturnValue({
    localHotkeyAccelerator: 'CommandOrControl+Shift+E',
    undoHotkeyAccelerator: 'CommandOrControl+Shift+Z',
    apiHotkeyAccelerator: 'CommandOrControl+E',
  });
});

describe('registerGlobalShortcuts', () => {
  it('registers local, undo, and API shortcuts when all accelerators differ', async () => {
    const { registerGlobalShortcuts } = await freshModule();
    const localHandler = vi.fn();
    const undoHandler = vi.fn();
    const apiHandler = vi.fn();

    registerGlobalShortcuts(localHandler, undoHandler, undefined, apiHandler);

    expect(mockRegister).toHaveBeenCalledTimes(3);
    expect(mockRegister).toHaveBeenCalledWith('CommandOrControl+Shift+E', localHandler);
    expect(mockRegister).toHaveBeenCalledWith('CommandOrControl+Shift+Z', undoHandler);
    expect(mockRegister).toHaveBeenCalledWith('CommandOrControl+E', apiHandler);
  });

  it('registers the line shortcut when a line handler is provided', async () => {
    mockLoad.mockReturnValue({
      localHotkeyAccelerator: 'CommandOrControl+Shift+E',
      undoHotkeyAccelerator: 'CommandOrControl+Shift+Z',
      lineHotkeyAccelerator: 'CommandOrControl+L',
      apiHotkeyAccelerator: 'CommandOrControl+E',
    });
    const { registerGlobalShortcuts } = await freshModule();
    const lineHandler = vi.fn();

    registerGlobalShortcuts(vi.fn(), vi.fn(), lineHandler);

    expect(mockRegister).toHaveBeenCalledWith('CommandOrControl+L', lineHandler);
  });

  it('skips undo when its accelerator matches local', async () => {
    mockLoad.mockReturnValue({
      localHotkeyAccelerator: 'CommandOrControl+E',
      undoHotkeyAccelerator: 'CommandOrControl+E',
      apiHotkeyAccelerator: 'CommandOrControl+Alt+E',
    });
    const { registerGlobalShortcuts } = await freshModule();
    registerGlobalShortcuts(vi.fn(), vi.fn(), undefined, vi.fn());

    // local + api only
    expect(mockRegister).toHaveBeenCalledTimes(2);
    expect(mockRegister).toHaveBeenCalledWith('CommandOrControl+E', expect.any(Function));
    expect(mockRegister).toHaveBeenCalledWith('CommandOrControl+Alt+E', expect.any(Function));
  });

  it('uses DEFAULT_CONFIG accelerator when config value is empty', async () => {
    mockLoad.mockReturnValue({
      localHotkeyAccelerator: '',
      apiHotkeyAccelerator: '',
    });

    const { registerGlobalShortcuts } = await freshModule();
    registerGlobalShortcuts(vi.fn(), vi.fn(), undefined, vi.fn());

    // Falls back to the defaults (which differ), so both register
    expect(mockRegister).toHaveBeenCalledWith(DEFAULT_CONFIG.localHotkeyAccelerator, expect.any(Function));
    expect(mockRegister).toHaveBeenCalledWith(DEFAULT_CONFIG.apiHotkeyAccelerator, expect.any(Function));
  });

  it('captured local handler is invoked when shortcut fires', async () => {
    const { registerGlobalShortcuts } = await freshModule();
    const localHandler = vi.fn();
    registerGlobalShortcuts(localHandler, vi.fn());

    // Get the handler passed to register for the local shortcut
    const registeredHandler = mockRegister.mock.calls[0][1];
    registeredHandler();
    expect(localHandler).toHaveBeenCalledTimes(1);
  });

  it('captured undo handler is invoked when shortcut fires', async () => {
    const { registerGlobalShortcuts } = await freshModule();
    const undoHandler = vi.fn();
    registerGlobalShortcuts(vi.fn(), undoHandler);

    // Undo is the second call
    const registeredHandler = mockRegister.mock.calls[1][1];
    registeredHandler();
    expect(undoHandler).toHaveBeenCalledTimes(1);
  });

  it('registers and invokes the API handler when provided', async () => {
    const { registerGlobalShortcuts } = await freshModule();
    const apiHandler = vi.fn();

    registerGlobalShortcuts(vi.fn(), vi.fn(), undefined, apiHandler);

    expect(mockRegister).toHaveBeenCalledWith(DEFAULT_CONFIG.apiHotkeyAccelerator, apiHandler);
    const registeredHandler = mockRegister.mock.calls.find(([accelerator]) => accelerator === DEFAULT_CONFIG.apiHotkeyAccelerator)?.[1];
    registeredHandler();
    expect(apiHandler).toHaveBeenCalledTimes(1);
  });

  it('handles register() returning false (logs error, no crash)', async () => {
    mockRegister.mockReturnValue(false);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { registerGlobalShortcuts } = await freshModule();
    registerGlobalShortcuts(vi.fn(), vi.fn());

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to register'));
    errorSpy.mockRestore();
  });

  it('handles register() throwing (logs error, no crash)', async () => {
    mockRegister.mockImplementation(() => { throw new Error('boom'); });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { registerGlobalShortcuts } = await freshModule();
    registerGlobalShortcuts(vi.fn(), vi.fn());

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error registering'), expect.any(Error));
    errorSpy.mockRestore();
  });
});

describe('refreshGlobalShortcuts', () => {
  it('calls unregisterAll then re-registers', async () => {
    const { refreshGlobalShortcuts } = await freshModule();
    refreshGlobalShortcuts(vi.fn(), vi.fn());

    expect(mockUnregisterAll).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalled();
  });
});

describe('unregisterAll', () => {
  it('calls globalShortcut.unregisterAll()', async () => {
    const { unregisterAll } = await freshModule();
    unregisterAll();
    expect(mockUnregisterAll).toHaveBeenCalledTimes(1);
  });
});
