import { ValueAtom } from "./atoms/value";
import { DerivedAtom } from "./atoms/derived";
import { runtime } from "./runtime";
import { AtomOptions, AtomState, EffectAtomOptions } from "./types";
import observable from "./observable";
import observableObject, { as } from "./observable/object";
import observableArray from "./observable/array";

type EffectState = {
  // dispose
  (): void;

  isInitial: boolean;
  isDisposed: boolean;
  invalidate(): void;
};

function observe(fn: (state: EffectState) => void, opts?: EffectAtomOptions) {
  const ectrl: EffectState = () => {
    ectrl.isDisposed = true;

    runtime.addEffect({ actualize: ea.dispose.bind(ea) });
    runtime.runEffects();
  };
  ectrl.isInitial = true;
  ectrl.isDisposed = false;
  ectrl.invalidate = () => {
    if (ectrl.isDisposed) return;

    ea.state = AtomState.Stale;
    runtime.addEffect(ea);
    runtime.runEffects();
  };

  const efn = () => {
    !ectrl.isDisposed && fn(ectrl);
    ectrl.isInitial = false;
  };

  const ea = new DerivedAtom(efn, true, opts);
  if (opts?.scheduler) {
    const actualize = ea.actualize.bind(ea);
    ea.actualize = () => opts.scheduler!(actualize);
  }
  const onBO = opts?.onBecomeObserved;
  if (onBO) runtime.addEffect({ actualize: onBO });
  runtime.addEffect(ea);
  runtime.runEffects();

  return ectrl;
}

type Atom<T> = {
  get(): T;
};

type WritableAtom<T> = Atom<T> & {
  set(x: T): void;
};

type AtomOptions_<T> = AtomOptions<T> &
  Partial<{
    set(setter: (x: T) => void): (x: T) => void;
  }>;

type ComputedOptions_<T> = AtomOptions<T>;

type Getter<T> = () => T;

function atom<T>(fn: () => T, opts?: ComputedOptions_<T>): Atom<T> & Getter<T>;
function atom<T>(value: T, opts?: AtomOptions_<T>): WritableAtom<T> & Getter<T>;

function atom(x, opts?) {
  const a =
    typeof x === "function"
      ? new DerivedAtom(x, false, opts)
      : new ValueAtom(x, opts);
  const self: any = a.get.bind(a);
  self.set = "set" in a ? (opts?.set ?? ((x) => x))(a.set.bind(a)) : undefined;
  self.get = self.toString = self.toJSON = self.valueOf = self;
  return self;
}

const { act } = runtime;
const untracked = act;

export {
  ValueAtom,
  DerivedAtom,
  atom,
  act,
  untracked,
  observe,
  observable,
  observableObject,
  observableArray,
  as,
  runtime, // debug
};
