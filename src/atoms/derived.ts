import { runtime } from "../runtime";
import { trackAtom, removeAtom, invalidateSubs, thrower } from "../shared";
import { EID, defaultAtomOptions, Id, AtomState } from "../types";

const call = (x) => x();

function each(it, fn) {
  let x = it.next();

  while (!x.done) {
    if (fn(x.value) === false) return false;
    x = it.next();
  }

  return true;
}

export class DerivedAtom {
  value;
  options;
  subs;
  vid;
  state;
  m;
  ti;
  readFlag;
  mark;
  deps;
  pit;
  pt;

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
    this.ti = 0;
    this.readFlag = false;
    this.mark = EID;
    this.deps = new Map();
    this.pit = this.deps.values();
    this.pt = this.pit.next().value;

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
      const ok = each(this.deps.values(), (t) => {
        const a = t.a;
        a.actualize();
        return a.vid === t.v;
      });
      if (!ok) this.state = AtomState.Stale;
    }

    // state0 may be outdated below

    if (this.state === AtomState.Stale) {
      const mark = (this.mark = new Id());
      const deps = this.deps;
      this.pit = deps.values();
      this.pt = this.pit.next().value;

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

      each(deps.values(), (t) => {
        if (t.m !== mark) {
          deps.delete(t.a);
          t.a.subs.delete(this);
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
    const m = this.mark;
    const v = a.vid;

    if (a.m === m) {
      a.ti.v = v;
      return;
    }
    a.m = m;

    const pt = this.pt;

    if (pt && pt === a) {
      pt.m = m;
      pt.v = v;
      a.ti = pt;
      this.pt = this.pit.next().value;
      return;
    }

    const deps = this.deps;

    let t = deps.get(a);
    if (!t) {
      a.subs.add(this);

      t = { a, m, v };
      deps.set(a, t);
    } else {
      t.m = m;
    }

    t.v = v;
    a.ti = t;
  }

  dispose() {
    if (this.isObserved) {
      this.isObserved = false;
      const onBUO = this.options.onBecomeUnobserved;
      if (onBUO) runtime.addEffect(onBUO);

      this.deps.forEach((t) => removeAtom(t.a, this));
      this.deps.clear();

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
