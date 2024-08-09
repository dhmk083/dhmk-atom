import { ValueAtom } from "./atoms/value";
import { ComputedAtom } from "./atoms/computed";
import { EffectAtom } from "./atoms/effect";
import { runtime } from "./runtime";
import { AtomOptions, AtomState, EffectAtomOptions } from "./types";
import observable from "./observable";
import observableObject, { as } from "./observable/object";
import observableArray from "./observable/array";

type EffectState = {
  // dispose
  (): void;

  isInitial: boolean;
  invalidate(): void;
};

function observe(fn: (state: EffectState) => void, opts?: EffectAtomOptions) {
  const ectrl: EffectState = () => ea.dispose();
  ectrl.isInitial = true;
  ectrl.invalidate = () => ea.invalidate(AtomState.Stale, false);

  const efn = () => {
    fn(ectrl);
    ectrl.isInitial = false;
  };

  const ea = new EffectAtom(efn, opts);
  const onBO = opts?.onBecomeObserved;
  if (onBO) runtime.addEffect({ actualize: onBO });
  ea.start();

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
      ? new ComputedAtom(x, opts)
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
  ComputedAtom,
  EffectAtom,
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
