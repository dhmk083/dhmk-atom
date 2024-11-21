import { runtime } from "../runtime";
import { trackAtom, removeAtom, invalidateSubs, thrower } from "../shared";
import { EID, defaultAtomOptions, Id, AtomState } from "../types";

const call = (x) => x();

export class DerivedAtom {
  value;
  options;
  subs;
  vid;
  state;
  m;
  tr;
  readFlag;
  mark;
  deps;

  isObserved;
  isEffect;
  isError;
  fn;

  constructor(fn, isEffect = false, options?) {
    this.value = undefined;
    this.options = { ...defaultAtomOptions, ...options };
    this.subs = new Set();
    this.vid = EID;
    this.state = AtomState.Stale;
    this.m = EID;
    this.tr = undefined;
    this.readFlag = false;
    this.mark = EID;
    this.deps = [];

    this.isObserved = isEffect;
    this.isEffect = isEffect;
    this.isError = false;
    this.fn = fn;

    if (this.isEffect) {
      const actualize = this.actualize.bind(this);
      const scheduler = options?.scheduler ?? call;
      this.run = () => scheduler(actualize);
    }
  }

  run() {
    // only for effects
    // effects should override this
  }

  actualize() {
    const state0 = this.state;

    if (state0 === AtomState.Actual) return;

    if (state0 >= AtomState.Computing) {
      throw new Error("circular dependency");
    }

    if (state0 <= AtomState.PossiblyStale) {
      const ok = this.deps.every((t) => {
        const a = t.a;
        a.actualize();
        return a.vid === t.v;
      });
      if (!ok) this.state = AtomState.Stale;
    }

    // state0 may be outdated below

    if (this.state === AtomState.Stale) {
      const mark = (this.mark = new Id());
      const prevDeps = this.deps;
      this.deps = [];

      if (!this.isObserved && runtime.currentAtom) {
        this.isObserved = true;
        const onBO = this.options.onBecomeObserved;
        if (onBO) runtime.addEffect(onBO);
      }

      const prev = runtime.currentAtom;
      runtime.currentAtom = this;
      let nextValue;
      let isError = false;
      try {
        this.state = AtomState.Computing;
        nextValue = this.fn();
      } catch (e) {
        if (this.isEffect) {
          runtime.addEffect(thrower(e));
        } else {
          nextValue = e;
          isError = true;
        }
      }
      runtime.currentAtom = prev;

      prevDeps.forEach((t) => {
        const a = t.a;
        if (a.m !== mark) removeAtom(a, this);
        a.readFlag = false;
      });

      this.deps.forEach((t) => {
        const a = t.a;
        a.m = t.t;
        if (a.readFlag) {
          a.readFlag = false;
          a.subs.add(this);
        }
      });

      if (!this.options.equals(nextValue, this.value)) {
        this.value = nextValue;
        this.isError = isError;
        this.vid = new Id();
        invalidateSubs(this, false);
      }
    }

    if (this.state === AtomState.Computing) this.state = AtomState.Actual;
    else this.state = AtomState.InvalidatedWhileComputing;
  }

  track(a) {
    const mark = this.mark;
    const t = a.m;
    const v = a.vid;

    if (t === mark) {
      a.tr.v = v;
      return;
    }

    const tr = { a, v, t }; // literal is faster than class

    a.m = mark;
    a.tr = tr;
    a.readFlag = true;

    this.deps.push(tr);
  }

  dispose() {
    if (this.isObserved) {
      this.isObserved = false;
      const onBUO = this.options.onBecomeUnobserved;
      if (onBUO) runtime.addEffect(onBUO);

      this.deps.forEach((t) => removeAtom(t.a, this));
      this.deps.length = 0;

      this.state = AtomState.Stale;
    }
  }

  get() {
    this.actualize();
    trackAtom(this);

    if (this.isError) throw this.value;
    return this.value;
  }

  toJSON() {
    return this.get();
  }
}
