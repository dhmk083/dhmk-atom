import { useAtom } from "../shared";
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
  observers: Set<any>;
  t: Track;
  versionId: Id;
  private isObserved: boolean;
  private options: _AtomOptions<T>;
  private value: T;

  constructor(value: T, options?: AtomOptions<T>) {
    this.value = value;
    this.options = { ...defaultAtomOptions, ...options };
    this.observers = new Set();
    this.t = ET;
    this.versionId = EID;
    this.isObserved = false;
  }

  invalidate() {
    this.observers.forEach((_, a) => a.invalidate(AtomState.Stale, true));
    runtime.runEffects();
  }

  set(x: T) {
    if (runtime.requireAction && !runtime.counter)
      throw new Error("Attempted to set atom value outside action.");

    if (this.options.equals(x, this.value)) return;

    this.value = x;
    this.versionId = new Id();
    this.invalidate();
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
