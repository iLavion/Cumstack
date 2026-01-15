/**
 * cumstack Reactivity System
 * signal-based fine-grained reactivity (shared between client and server)
 */

let currentEffect = null;
const effectStack = [];
let batchDepth = 0;
let pending = null;
let schedule = null;

/**
 *  create a reactive signal
 * @template T
 * @param {T} initial - Initial value
 * @returns {[() => T, (next: T | ((prev: T) => T)) => void]} Tuple of [getter, setter]
 */
export function createMoan(initial) {
  let value = initial;
  const subscribers = new Set();
  const read = () => {
    if (currentEffect) subscribers.add(currentEffect);
    return value;
  };
  const write = (next) => {
    const newValue = typeof next === "function" ? next(value) : next;
    if (Object.is(value, newValue)) return;
    value = newValue;
    const effects = [...subscribers];
    for (const effect of effects) if (subscribers.has(effect)) (schedule || ((e) => e()))(effect);
  };
  return [read, write];
}

/**
 * create an effect that runs when dependencies change
 * @param {() => void} fn - Effect function
 * @returns {() => void} Dispose function to stop the effect
 */
export function onClimax(fn) {
  let disposed = false;
  const cleanup = [];
  const effect = () => {
    if (disposed) return;
    effectStack.push(effect);
    currentEffect = effect;
    try {
      // run any previous cleanup
      cleanup.forEach((c) => c());
      cleanup.length = 0;
      const result = fn();
      if (typeof result === "function") cleanup.push(result);
    } catch (err) {
      console.error("Effect error:", err);
    } finally {
      effectStack.pop();
      currentEffect = effectStack[effectStack.length - 1] || null;
    }
  };
  batch(effect);
  return () => {
    disposed = true;
    cleanup.forEach((c) => c());
    cleanup.length = 0;
  };
}

/**
 * create a computed value
 * @template T
 * @param {() => T} fn - Computation function
 * @returns {() => T} Getter for the computed value
 */
export function knotMemo(fn) {
  let initialized = false;
  let cached;
  const [signal, setSignal] = createMoan();
  onClimax(() => {
    const result = fn();
    if (!initialized || !Object.is(result, cached)) {
      cached = result;
      untrack(() => batch(() => setSignal(result)));
      initialized = true;
    }
  });
  return signal;
}

/**
 * create a resource for async data fetching
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} fetcher - Async function to fetch data
 * @param {(() => any) | null} deps - Optional signal to trigger refetch
 * @param {T | null} initialValue - Initial value before data loads
 * @returns {Object} Resource object with data, loading, error states and methods
 */
export function loadShot(fetcher, deps = null, initialValue = null) {
  const [data, setData] = createMoan(initialValue);
  const [loading, setLoading] = createMoan(false);
  const [error, setError] = createMoan(null);
  let controller = null;
  const refetch = async () => {
    if (controller) controller.abort();
    controller = new AbortController();
    const signal = controller.signal;
    batch(() => {
      setLoading(true);
      setError(null);
    });
    try {
      const result = await fetcher(signal);
      batch(() => {
        if (!signal.aborted) setData(result);
      });
    } catch (err) {
      batch(() => {
        if (!signal.aborted) setError(err);
      });
    } finally {
      batch(() => {
        if (!signal.aborted) setLoading(false);
      });
    }
  };
  if (deps) {
    onClimax(() => {
      const _ = deps();
      refetch();
    });
  } else queueMicrotask(refetch);
  const dispose = () => controller?.abort();
  return {
    data,
    loading,
    error,
    refetch,
    dispose,
    idle: () => !loading() && data() === initialValue,
    success: () => !loading() && !error(),
    hasError: () => !!error(),
  };
}

/**
 * batch multiple updates together
 * @param {Function} fn - Function to run in batch
 */
export function batch(fn) {
  if (batchDepth++ === 0) pending = new Set();
  const prev = schedule;
  schedule = (e) => pending.add(e);
  try {
    fn(schedule);
  } finally {
    schedule = prev;
    if (--batchDepth === 0) {
      const effects = pending;
      pending = null;
      for (const e of effects) e();
    }
  }
}

// external scheduling
batch.schedule = (fn) => {
  if (batchDepth > 0) pending.add(fn);
  else fn();
};

/**
 * run function without tracking dependencies
 * @template T
 * @param {() => T} fn - Function to run without tracking
 * @returns {T} Result of the function
 */
export const untrack = (fn) => {
  const prev = currentEffect;
  currentEffect = null;
  try {
    return fn();
  } finally {
    currentEffect = prev;
  }
};

/**
 * get current location (pathname, search, hash)
 * returns a reactive signal that updates on navigation
 * @returns {Object} Location object with location signal, active function, and dispose method
 */
let locationInstance = null;
export function useLocation() {
  if (typeof window === "undefined") {
    return {
      location: () => ({ pathname: "/", search: "", hash: "" }),
      active: () => false,
      dispose: () => {},
    };
  }

  // return singleton instance if already created
  if (locationInstance) {
    locationInstance.refCount++;
    return {
      location: locationInstance.location,
      active: locationInstance.active,
      dispose: () => {
        if (--locationInstance.refCount === 0) {
          locationInstance.dispose();
          locationInstance = null;
        }
      },
    };
  }

  // patch history methods once
  if (!window.__locationPatched) {
    ["pushState", "replaceState"].forEach((method) => {
      const orig = history[method];
      history[method] = function (...args) {
        const result = orig.apply(this, args);
        window.dispatchEvent(new Event(method.toLowerCase()));
        return result;
      };
    });
    window.__locationPatched = true;
  }

  const getLoc = () => ({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  });
  const [location, setLocation] = createMoan(getLoc());
  const update = () => batch(() => setLocation(getLoc()));
  const events = ["popstate", "pushstate", "replacestate"];
  events.forEach((e) => window.addEventListener(e, update));

  const active = (path) => location().pathname === path;
  const dispose = () => events.forEach((e) => window.removeEventListener(e, update));

  locationInstance = {
    location,
    active,
    dispose,
    refCount: 1,
  };

  return {
    location,
    active,
    dispose: () => {
      if (--locationInstance.refCount === 0) {
        locationInstance.dispose();
        locationInstance = null;
      }
    },
  };
}
