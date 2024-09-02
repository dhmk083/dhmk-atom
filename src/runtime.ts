import { Dependency, Id } from "./types";

type Effect = { actualize(): void };

interface CurrentAtom {
  runId: Id;
  deps: Dependency[];
  prevDeps: Dependency[];
  prevDepsIndex: number;
  isObserved: boolean;
  depsForUnobserved: Set<Dependency>;
  wm: WeakMap<any, any>;
}

export const runtime = {
  currentAtom: undefined as CurrentAtom | undefined,
  counter: 0,
  requireAction: true,
  effects: new Set<Effect>(),

  addEffect(x: Effect) {
    runtime.effects.add(x);
  },

  runEffects() {
    if (runtime.counter > 0) return;

    runtime.counter++;

    const errors = Array<unknown>();

    runtime.effects.forEach((x) => {
      runtime.effects.delete(x);

      try {
        x.actualize();
      } catch (e) {
        errors.push(e);
      }
    });

    runtime.counter--;

    if (errors.length)
      throw errors.length === 1 ? errors[0] : new AggregateError(errors);
  },

  act<T>(fn: () => T) {
    const prevAtom = runtime.currentAtom;
    runtime.currentAtom = undefined;
    runtime.counter++;

    try {
      return fn();
    } finally {
      runtime.counter--;
      runtime.currentAtom = prevAtom;
      runtime.runEffects();
    }
  },
};
