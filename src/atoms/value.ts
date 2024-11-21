import { trackAtom, invalidateSubs } from "../shared";
import {
  AtomOptions,
  _AtomOptions,
  Id,
  defaultAtomOptions,
  EID,
} from "../types";
import { runtime } from "../runtime";

export class ValueAtom<T> {
  value;
  options;
  subs;
  vid;
  m;
  ti;
  readFlag;
  isObserved;

  constructor(value: T, options?: AtomOptions<T>) {
    this.value = value;
    this.options = { ...defaultAtomOptions, ...options };
    this.subs = new Set();
    this.vid = EID;
    this.m = EID;
    this.ti = undefined;
    this.readFlag = false;
    this.isObserved = false;
  }

  set(x: T) {
    if (this.options.equals(x, this.value)) return;

    this.value = x;
    this.vid = new Id();
    invalidateSubs(this, true);
    runtime.scheduleRun();
  }

  actualize() {}

  get() {
    trackAtom(this);

    if (!this.isObserved && runtime.currentAtom) {
      this.isObserved = true;
      const onBO = this.options.onBecomeObserved;
      if (onBO) runtime.addEffect(onBO);
    }

    return this.value;
  }

  toJSON() {
    return this.get();
  }

  dispose() {
    if (this.isObserved) {
      this.isObserved = false;
      const onBUO = this.options.onBecomeUnobserved;
      if (onBUO) runtime.addEffect(onBUO);
    }
  }
}
