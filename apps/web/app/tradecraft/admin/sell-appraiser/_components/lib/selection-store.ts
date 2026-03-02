export type SelectionStore = {
  subscribe: (listener: () => void) => () => void;
  getVersion: () => number;
  get: (key: string) => boolean;
  toggle: (key: string) => void;
  setMany: (keys: string[], checked: boolean) => void;
};

export function createSelectionStore(): SelectionStore {
  const state: { selected: Record<string, boolean> } = { selected: {} };
  const listeners = new Set<() => void>();
  let version = 0;

  const notify = () => {
    version += 1;
    for (const l of Array.from(listeners)) l();
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getVersion: () => version,
    get: (key) => !!state.selected[key],
    toggle: (key) => {
      state.selected[key] = !state.selected[key];
      notify();
    },
    setMany: (keys, checked) => {
      for (const k of keys) state.selected[k] = checked;
      notify();
    },
  };
}
