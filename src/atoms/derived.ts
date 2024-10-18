import { runtime } from "../runtime";
import {
  useAtom,
  removeAtom,
  each,
  eacha,
  eachar,
  invalidate,
} from "../shared";
import { ET, EID, defaultAtomOptions, Id, Track } from "../types";

export class DerivedAtom {
  value;
  options;
  subs;
  t;
  vid;
  isObserved;
  state;
  isEffect;
  fn;
  recalc;
  deps;
  dit;
  dt;
  mark;
  m;
  ti;
  readFlag;
  pdi;

  constructor(fn, isEffect, options) {
    this.value = undefined;
    this.options = { ...defaultAtomOptions, ...options };
    this.subs = new Set();
    this.vid = EID;
    this.m = new Id();
    this.ti = 0;
    this.readFlag = false;
    this.isObserved = isEffect;

    this.state = 3;
    this.isEffect = isEffect;
    this.fn = fn;
    this.recalc = false;

    this.deps = [];
    this.mark = EID;
    this.pdi = 0;
  }

  actualize() {
    if (this.state === 1 || this.state === 2) {
      this.recalc = false;
      const ok = eachar(this.deps, (t) => {
        const a = t.a;
        a.actualize();
        return a.vid === t.v;
      });
      if (!ok) this.state = 3;
    }

    if (this.state === 3) {
      const mark = (this.mark = new Id());
      const prevDeps = this.deps;
      this.deps = new Array(prevDeps.length || 100);
      this.pdi = 0;

      if (!this.isObserved && runtime.currentAtom) {
        this.isObserved = true;
        const onBO = this.options.onBecomeObserved;
        if (onBO) runtime.addEffect({ actualize: onBO });
      }

      const prev = runtime.currentAtom;
      runtime.currentAtom = this;
      let nextValue;
      try {
        this.state = 4;
        nextValue = this.fn();
      } finally {
        runtime.currentAtom = prev;
      }

      // temp hack
      if (this.deps.length) this.deps.length = this.pdi;

      eacha(prevDeps, (t) => {
        const a = t.a;
        if (a.m !== mark) removeAtom(a, this);
        a.readFlag = false;
      });

      eacha(this.deps, (t) => {
        const a = t.a;
        a.m = t.t;
        if (a.readFlag) {
          a.readFlag = false;
          a.subs.add(this);
        }
      });

      if (!this.options.equals(nextValue, this.value)) {
        this.value = nextValue;
        this.vid = new Id();
        invalidate(this.subs, 3, false);
      }
    }

    if (this.state === 4) this.state = 0;
    else this.state = 1;
  }

  track(a) {
    const am = a.m;
    const mark = this.mark;
    const vid = a.vid;
    const deps = this.deps;

    if (am === mark) {
      deps[a.ti].v = vid;
      return;
    }

    const ti = this.pdi++;
    deps[ti] = { a, v: vid, t: am }; // literal is faster than class
    // deps.push({ a, v: vid, t: am });

    a.m = mark;
    a.ti = ti;
    a.readFlag = true;
  }

  dispose() {
    if (this.isObserved) {
      this.isObserved = false;
      const onBUO = this.options.onBecomeUnobserved;
      if (onBUO) runtime.addEffect({ actualize: onBUO });

      // temp hack
      this.deps.length = this.pdi;

      this.deps.forEach((t) => removeAtom(t.a, this));
      this.deps.length = 0;

      this.state = 3;
    }
  }

  get() {
    this.actualize();
    useAtom(this);
    return this.value;
  }

  toJSON() {
    return this.get();
  }
}
