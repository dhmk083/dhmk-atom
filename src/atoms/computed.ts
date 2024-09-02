import { removeAtom, useAtom } from "../shared";
import {
  Id,
  AtomState,
  Dependency,
  AtomOptions,
  _AtomOptions,
  defaultAtomOptions,
  Atom,
} from "../types";
import { runtime } from "../runtime";

export class ComputedAtom<T> {
  observers = Array<Atom>();
  deps = Array<Dependency>();
  prevDeps = Array<Dependency>();
  prevDepsIndex = 0;
  runId = new Id();
  versionId = new Id();
  isObserved = false;
  depsForUnobserved = new Set<Dependency>();
  wm = new WeakMap();

  protected value: unknown;
  protected isError = false;
  protected state = AtomState.Stale;
  private depsVersions = Array<Id>();
  private options: _AtomOptions<T>;

  constructor(private fn: () => T, options?: AtomOptions<T>) {
    this.options = { ...defaultAtomOptions, ...options };
  }

  invalidate(state: AtomState, isValueAtom: boolean) {
    const oldState = this.state;
    if (state > this.state) this.state = state;

    if (oldState === AtomState.Actual)
      this.observers.forEach((a) =>
        a.invalidate(AtomState.PossiblyStale, false)
      );
  }

  calculate() {
    this.prevDeps = this.deps;
    this.deps = [];
    this.prevDepsIndex = 0;
    this.runId = new Id();

    if (!this.isObserved && runtime.currentAtom) {
      this.isObserved = true;
      const onBO = this.options.onBecomeObserved;
      if (onBO) runtime.addEffect({ actualize: onBO });
    }

    if (!this.isObserved) this.depsForUnobserved = new Set();

    let nextValue;
    let isError;

    const prevAtom = runtime.currentAtom;
    runtime.currentAtom = this;
    try {
      nextValue = this.fn();
    } catch (e) {
      isError = true;
      nextValue = e;
    }
    runtime.currentAtom = prevAtom;

    if (!this.isObserved) this.deps = Array.from(this.depsForUnobserved);

    this.depsVersions.length = this.deps.length;

    for (let i = 0; i < this.deps.length; ++i) {
      const dep = this.deps[i];
      // dep.runId = this.runId;
      this.depsVersions[i] = dep.versionId;
    }

    for (let i = this.prevDepsIndex; i < this.prevDeps.length; ++i) {
      const a = this.prevDeps[i];
      // if (a.runId !== this.runId) removeAtom(a, this);

      if (this.wm.get(a).runId !== this.runId) {
        this.wm.delete(a);
        removeAtom(a, this);
      }
    }

    this.prevDeps = [];
    this.state = this.isObserved ? AtomState.Actual : AtomState.PossiblyStale;

    if (!this.options.equals(nextValue as T, this.value as T)) {
      this.value = nextValue;
      this.isError = isError;
      this.versionId = new Id();
      this.observers.forEach((a) => a.invalidate(AtomState.Stale, false));
    }
  }

  actualize() {
    if (this.state === AtomState.Actual) return;

    if (this.state === AtomState.PossiblyStale) {
      for (let i = 0; i < this.deps.length; ++i) {
        const dep = this.deps[i];
        dep.actualize();
        if (dep.versionId !== this.depsVersions[i]) {
          this.state = AtomState.Stale;
          break;
        }
      }
    }

    if (this.state === AtomState.PossiblyStale) this.state = AtomState.Actual;
    if (this.state === AtomState.Stale) this.calculate();
  }

  get() {
    this.actualize();
    useAtom(this);

    if (this.isError) throw this.value;
    return this.value;
  }

  toJSON() {
    return this.get();
  }

  dispose() {
    if (this.isObserved) {
      this.isObserved = false;
      const onBUO = this.options.onBecomeUnobserved;
      if (onBUO) runtime.addEffect({ actualize: onBUO });

      for (let i = 0; i < this.deps.length; ++i) {
        removeAtom(this.deps[i], this);
      }

      this.state = AtomState.Stale;
    }
  }
}
