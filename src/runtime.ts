import { thrower } from "./shared";

type Effect = () => void;

export const runtime = {
  currentAtom: undefined as any,
  counter: 0,
  requireAction: true,
  effects: new Set<Effect>(),

  addEffect(x: Effect) {
    runtime.effects.add(x);
  },

  runEffects() {
    if (runtime.counter > 0) return;

    runtime.counter++;

    runtime.effects.forEach((fn) => {
      try {
        runtime.effects.delete(fn);
        fn();
      } catch (e) {
        setTimeout(thrower(e));
      }
    });

    runtime.counter--;
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
