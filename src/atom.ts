// global state
const g_pendingAtoms: any[] = [];
let g_pendingErrors: any[] = [];
let g_batchCount = 0;
let g_currentObserver: _Atom<any> | null = null;
let g_runId = 1; // 1..0x7fff_ffff to fit SMI; for diff optimization
//

function enqueueError(e) {
  g_pendingErrors.push(e);
}

function enqueueAtom(a) {
  if (a.isPending) return;
  a.isPending = true;
  g_pendingAtoms.push(a);
}

function runPendingAtoms() {
  if (g_batchCount > 0) return;

  g_batchCount++;

  for (let i = 0; i < g_pendingAtoms.length; i++) {
    const a = g_pendingAtoms[i];
    a.actualize();
  }
  g_pendingAtoms.length = 0;

  g_batchCount--;

  runPendingErrors();
}

function runPendingErrors() {
  if (g_batchCount) return;

  if (g_pendingErrors.length) {
    const errors = g_pendingErrors;
    g_pendingErrors = [];

    if (errors.length === 1) {
      throw errors[0]; // to get better stacktrace
    } else {
      throw new AggregateError(errors, "First error: " + errors[0].toString());
    }
  }
}

// to run atom outside `runPendingAtoms` (deferred) and handle possible errors
function runAtom(a) {
  enqueueAtom(a);
  runPendingAtoms();
}

function removeChild(a, c) {
  a.children.delete(c);
  if (a.children.size === 0) a.unsubscribe();
}

const EMPTY_ARRAY = [];
function NOOP() {}

const ACTUAL = 0;
const CHECK = 1;
const DIRTY = 2;

// universal base atom: either value, or computed, or side-effect
export class _Atom<T> {
  parents: any[] = this.fn ? [] : EMPTY_ARRAY; // not used for value atoms
  prevParents: any[] = EMPTY_ARRAY; // for quick diff
  readonly children = new Set<_Atom<any>>(); // not used for side-effects
  readonly options;
  state = this.fn ? DIRTY : ACTUAL;
  isBeingObserved = false; // for onBecomeObserved/onBecomeUnobserved
  isDisposed = false; // only for side-effects
  isPending = false; // only for side-effects
  isError = false; // faster than `instanceof Error`
  pi = 0; // parents index
  si = 0; // parents/prevParents index of first divergent atom
  runId = 0; // for quick diff, id of g_currentObserver that tracks this
  last: _Atom<any> | null = null; // for quick diff g_currentObserver that tracks this, to overcome `g_runId` overflow

  constructor(
    public value: T,
    public readonly fn: (() => T) | undefined,
    public readonly isSideEffect: boolean,
    options: any
  ) {
    // do not mutate passed options object
    this.options = options = Object.assign({}, options);

    if (!options.eq) options.eq = Object.is;
    if (!options.onBecomeObserved) options.onBecomeObserved = NOOP;
    if (!options.onBecomeUnobserved) options.onBecomeUnobserved = NOOP;
    if (options.checkStale === undefined) options.checkStale = true;
    if (options.scheduler) {
      const _actualize = this.actualize.bind(this);
      this.actualize = () => {
        if (this.isDisposed) return;

        // custom `actualize` should not throw
        try {
          options.scheduler(() => {
            g_batchCount++;
            _actualize();
            g_batchCount--;
            runPendingAtoms();
          });
        } catch (e) {
          enqueueError(e);
          runPendingErrors();
        }
      };
    }
  }

  get() {
    this.actualize();

    if (g_currentObserver) {
      if (
        this.runId !== g_currentObserver.runId ||
        this.last !== g_currentObserver
      ) {
        this.runId = g_currentObserver.runId;
        this.last = g_currentObserver;

        if (
          g_currentObserver.pi === g_currentObserver.si &&
          g_currentObserver.si < g_currentObserver.prevParents.length &&
          g_currentObserver.prevParents[g_currentObserver.si] === this
        ) {
          g_currentObserver.parents[g_currentObserver.pi++] = this;
          g_currentObserver.si++;
        } else {
          const before = this.children.size;
          this.children.add(g_currentObserver);
          const after = this.children.size;
          if (before !== after) {
            g_currentObserver.parents[g_currentObserver.pi++] = this;
          }
        }
      }

      if (!this.isBeingObserved) {
        this.isBeingObserved = true;
        this.options.onBecomeObserved(); // may throw
      }
    }

    if (this.isError) throw this.value;
    return this.value;
  }

  set(newValue: T) {
    if (this.options.eq(this.value, newValue)) return false;

    this.value = newValue;

    this.children.forEach((a) => a.mark(DIRTY, this));

    if (!this.fn) runPendingAtoms();

    return true;
  }

  mark(state, sender) {
    // if sender is a value atom - always enqueue
    // if sender is a computed atom - check own state first
    if (this.isSideEffect && !sender.fn) enqueueAtom(this);

    if (this.state === DIRTY || this.state === state) return;

    this.state = this.state === DIRTY ? DIRTY : state;

    if (this.isSideEffect) enqueueAtom(this);

    this.children.forEach((a) => a.mark(CHECK, sender));
  }

  // remember to flush `g_pendingErrors`
  actualize() {
    if (this.state === ACTUAL || this.isDisposed) {
      this.isPending = false;
      return;
    }

    this.runId = 0;
    this.last = null;

    if (this.state === CHECK) {
      for (let i = 0, len = this.parents.length; i < len; ++i) {
        const p = this.parents[i];
        p.actualize();
        // @ts-ignore (state may change after actualize)
        if (this.state === DIRTY) break;
      }
    }

    this.isPending = false;

    // Either CHECK or DIRTY
    if (this.state === CHECK) {
      this.state = ACTUAL;
    } else {
      this.run();
    }
  }

  // only for computed & side effects
  run() {
    const prevParents = (this.prevParents = this.parents);
    this.parents = Array(prevParents.length + 100);
    this.pi = 0;
    this.si = 0;

    // If a computed atom is not tracked by anyone
    // it should not track its parents
    // and fall back to DIRTY state after evaluation.
    const isTracked =
      !!g_currentObserver || this.isBeingObserved || this.isSideEffect;

    const prevObserver = g_currentObserver;
    g_currentObserver = isTracked ? this : null;

    this.runId = g_runId++;
    if (g_runId === 0x7fff_ffff) g_runId = 1;

    let newValue;
    try {
      newValue = this.fn!();
      this.isError = false;
    } catch (e) {
      if (this.isSideEffect) {
        enqueueError(e);
      } else {
        newValue = e;
        this.isError = true;
      }
    }

    g_currentObserver = prevObserver;

    this.parents.length = this.pi;

    for (let i = this.si, len = prevParents.length; i < len; ++i) {
      const p = prevParents[i];
      if (p.runId !== this.runId || p.last !== this) removeChild(p, this);
    }

    this.prevParents = EMPTY_ARRAY;

    if (this.options.checkStale && isTracked && this.parents.length === 0) {
      const e = new Error(
        `${
          this.isSideEffect ? "Observed" : "Computed"
        } function didn't read any atoms, so it had became stale. It will never be called again.`
      );
      (e as any).atom = this;
      enqueueError(e);
      return;
    }

    // only for side-effects
    // could be disposed while run `fn`
    if (this.isDisposed) return;

    this.state = isTracked ? (this.isPending ? DIRTY : ACTUAL) : DIRTY;

    this.set(newValue);
  }

  // remember to flush `g_pendingErrors`
  unsubscribe() {
    if (this.isSideEffect && this.isDisposed) return;
    if (!this.isSideEffect && !this.isBeingObserved) return;

    this.isBeingObserved = false;

    for (let i = 0, len = this.parents.length; i < len; ++i) {
      removeChild(this.parents[i], this);
    }

    this.parents.length = 0;
    this.children.clear();
    this.state = this.fn ? DIRTY : ACTUAL;
    if (this.isSideEffect) this.isDisposed = true;

    try {
      this.options.onBecomeUnobserved(); // may throw
    } catch (e) {
      enqueueError(e);
    }
  }
}

// export const isAtom = (x: any) => x && x.atom instanceof _Atom;

// export const isValue = (x: any): x is Atom<any> => isAtom(x) && !x.atom.fn;

// export const isComputed = (x: any): x is Atom<any> =>
//   isAtom(x) && !!x.atom.fn && !x.atom.isSideEffect;

// export const isObserve = (x: any): x is Observer =>
//   isAtom(x) && !!x.atom.fn && x.atom.isSideEffect;

const id = (x) => x;

export function atom<T>(fn: () => T, options?: ComputedAtomOptions<T>): Atom<T>;
export function atom<T>(x: T, options?: AtomOptions<T>): WritableAtom<T>;
export function atom(arg, opts?) {
  const isComputed = typeof arg === "function";
  const a = isComputed
    ? new _Atom(undefined, arg, false, opts)
    : new _Atom(arg, undefined, false, opts);
  const self: any = a.get.bind(a);
  if (!isComputed) self.set = (opts?.setter || id)(a.set.bind(a));
  self.get = self.toString = self.toJSON = self.valueOf = self;
  self.atom = a; // for is...() checks
  return self;
}

export function observe(
  sideEffect: (self: Observer) => any,
  options?: ObserverOptions
): Observer;
export function observe(fn, opts?) {
  opts = Object.assign({}, opts, { eq: undefined });

  let isRunning = false;

  // dispose function
  const self = () => {
    self.isDisposed = true;

    if (isRunning) {
      a.isDisposed = true;
      enqueueAtom({
        actualize: () => a.unsubscribe(), // safe to skip runPendingErrors()
      });
    } else {
      a.unsubscribe();
      runPendingErrors();
    }
  };

  self.invalidate = (forceThroughBatches = false) => {
    a.state = DIRTY;

    if (forceThroughBatches) a.actualize();
    else runAtom(a);
  };

  self.isInitial = true;
  self.isDisposed = false;

  const effect = () => {
    isRunning = true;
    fn(self);
    isRunning = false;
    self.isInitial = false;
  };

  const a = new _Atom(undefined, effect, true, opts);
  self.atom = a; // for is...() checks

  // get tracked by parent observe, to be auto-disposed when parent will be disposed
  if (opts.attachToParent || opts.attachToParent === undefined) {
    g_batchCount++;
    a.get();
    g_batchCount--;
  }

  runAtom(a);

  return self;
}

export function untracked<T>(fn: () => T) {
  const prevObserver = g_currentObserver;
  g_currentObserver = null;

  try {
    return fn();
  } finally {
    g_currentObserver = prevObserver;
  }
}

export function runInAction<T>(fn: () => T) {
  g_batchCount++;
  const prevObserver = g_currentObserver;
  g_currentObserver = null;

  try {
    return fn();
  } finally {
    g_currentObserver = prevObserver;
    g_batchCount--;
    runPendingAtoms();
  }
}

// export function action<A extends unknown[], T>(fn: (...args: A) => T) {
//   return function (...args: A) {
//     return runInAction(() => fn(...args));
//   };
// }

export function atTransactionEnd(fn: (isInTransaction) => any): void {
  if (!g_batchCount) return fn(false);

  enqueueAtom({
    actualize: () => fn(true),
  });
}

export const deepReadonly = <T>(x: T) => x as DeepReadonly<T>;

export const asAtom = <T>(x: () => T): Atom<T> => x as Atom<T>;

// ---------------- types

const AtomTag = "__$$unique_name$$__";

// plain functions should not be confused with atoms, use type cast if desired
export type Atom<T> = (() => T) & { readonly [AtomTag]: typeof AtomTag };

export type NotAtom<T> = T & { readonly [AtomTag]?: never };

type ValueChanged = true;
type ValueNotChanged = false;

type Setter<T> = (value: T) => ValueChanged | ValueNotChanged;

export interface WritableAtom<T> extends Atom<T> {
  set: Setter<T>;
}

export interface Observer {
  (): void;
  invalidate(forceThroughBatches?: boolean): void;
  readonly isInitial: boolean;
  readonly isDisposed: boolean;
}

export type AtomOptions<T> = Readonly<
  Partial<{
    eq: (a: T, b: T) => boolean;
    onBecomeObserved: () => void;
    onBecomeUnobserved: () => void;
    setter: (originalSetter: Setter<T>) => Setter<T>;
  }>
>;

export type ComputedAtomOptions<T> = Omit<AtomOptions<T>, "setter">;

export type ObserverOptions = Readonly<
  Partial<{
    attachToParent: boolean;
    checkStale: boolean;
    scheduler: (run: () => void) => void;
  }>
>;

type Primitive =
  | undefined
  | null
  | boolean
  | string
  | number
  | Function
  | Date
  | RegExp;

export type DeepReadonly<T> = T extends Atom<infer R>
  ? Atom<DeepReadonly<R>>
  : T extends Primitive
  ? T
  : T extends Map<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends Set<infer T>
  ? ReadonlySet<DeepReadonly<T>>
  : {
      readonly [P in keyof T]: DeepReadonly<T[P]>;
    };

export type DeepWritable<T> = T extends Atom<infer R>
  ? WritableAtom<R>
  : T extends Primitive
  ? T
  : T extends Map<infer K, infer V>
  ? ReadonlyMap<DeepWritable<K>, DeepWritable<V>>
  : T extends Set<infer T>
  ? ReadonlySet<DeepWritable<T>>
  : {
      readonly [P in keyof T]: DeepWritable<T[P]>;
    };
