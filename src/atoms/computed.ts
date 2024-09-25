import { removeAtom, useAtom, each } from "../shared";
import {
  Id,
  AtomState,
  Dependency,
  AtomOptions,
  _AtomOptions,
  defaultAtomOptions,
  Atom,
  ET,
  EID,
  Track,
} from "../types";
import { runtime } from "../runtime";

export class ComputedAtom<T> {
  observers;
  t;
  versionId;

  protected isObserved;
  private options: _AtomOptions<T>;

  private fn;
  private deps;
  private dit;
  private dt;
  private mark;
  protected value;
  protected isError;
  protected state;

  constructor(fn: () => T, options?: AtomOptions<T>) {
    this.value = undefined;
    this.options = { ...defaultAtomOptions, ...options };
    this.observers = new Set();
    this.t = ET;
    this.versionId = EID;
    this.isObserved = false;

    this.fn = fn;
    this.isError = false;
    this.state = AtomState.Stale;

    this.deps = new Map();
    this.dit = undefined;
    this.dt = undefined;
    this.mark = EID;
  }

  invalidate(state: AtomState, isValueAtom: boolean) {
    const oldState = this.state;
    if (state > this.state) this.state = state;

    if (oldState === AtomState.Actual)
      this.observers.forEach((_, a) =>
        a.invalidate(AtomState.PossiblyStale, false)
      );
  }

  calculate() {
    const mark = (this.mark = new Id());
    const deps = this.deps;
    this.dit = deps.values();

    if (!this.isObserved && runtime.currentAtom) {
      this.isObserved = true;
      const onBO = this.options.onBecomeObserved;
      if (onBO) runtime.addEffect({ actualize: onBO });
    }

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

    each(this.dit, (t) => {
      if (t.m !== mark) {
        deps.delete(t);
        removeAtom(t.a, this);
      }
    });

    this.state = this.isObserved ? AtomState.Actual : AtomState.PossiblyStale;

    if (!this.options.equals(nextValue as T, this.value as T)) {
      this.value = nextValue;
      this.isError = isError;
      this.versionId = new Id();
      this.observers.forEach((_, a) => a.invalidate(AtomState.Stale, false));
    }
  }

  actualize() {
    if (this.state === AtomState.Actual) return;

    if (this.state === AtomState.PossiblyStale) {
      const ok = each(this.deps.values(), (t) => {
        const a = t.a;
        a.actualize();
        return a.versionId === t.v;
      });
      if (!ok) this.state = AtomState.Stale;
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

      this.deps.forEach((_, a) => {
        removeAtom(a, this);
      });
      this.deps.clear();

      this.state = AtomState.Stale;
    }
  }

  track(a) {
    const deps = this.deps;
    const mark = this.mark;
    let t = ET;

    if (a.t.m === mark) {
      a.t.v = a.versionId;
      return;
    }

    const dt = this.dt;

    if (dt && dt.a === a) {
      t = dt;
      this.dt = this.dit.next().value;
    } else {
      t = deps.get(a);
      if (!t) {
        a.observers.add(this);

        t = new Track(a, EID, EID);
        deps.set(a, t);
      }
    }

    if (t.m !== mark) {
      t.m = mark;
      t.v = a.versionId;
    }

    a.t = t;
  }
}
