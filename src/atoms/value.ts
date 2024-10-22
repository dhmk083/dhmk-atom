import { useAtom, invalidate } from "../shared";
import {
  AtomOptions,
  _AtomOptions,
  AtomState,
  Atom,
  Id,
  defaultAtomOptions,
  Track,
  ET,
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
    this.m = new Id();
    this.ti = 0;
    this.readFlag = 0;
    this.isObserved = false;
  }

  set(x: T) {
    if (runtime.requireAction && !runtime.counter)
      throw new Error("Attempted to set atom value outside action.");

    if (this.options.equals(x, this.value)) return;

    this.value = x;
    this.vid = new Id();
    invalidate(this.subs, 3, true);
  }

  actualize() {}

  get() {
    useAtom(this);

    if (!this.isObserved && runtime.currentAtom) {
      this.isObserved = true;
      const onBO = this.options.onBecomeObserved;
      if (onBO) runtime.addEffect({ actualize: onBO });
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
      if (onBUO) runtime.addEffect({ actualize: onBUO });
    }
  }
}
