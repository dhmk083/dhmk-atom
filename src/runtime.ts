import { thrower } from "./shared";

type Effect = () => void;

export const runtime = {
  //private

  currentAtom: undefined as any,
  counter: 0,
  effects: new Set<Effect>(),
  isScheduled: false,

  addEffect(x: Effect) {
    runtime.effects.add(x);
  },

  scheduleRun() {
    if (!runtime.isScheduled) {
      runtime.isScheduled = true;
      Promise.resolve().then(() => {
        runtime.isScheduled = false;
        runtime.runEffects();
      });
    }
  },

  // public

  queueEffect(x: Effect) {
    runtime.addEffect(x);
    runtime.scheduleRun();
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

  untracked<T>(fn: () => T) {
    const prevAtom = runtime.currentAtom;
    runtime.currentAtom = undefined;
    runtime.counter++;

    try {
      return fn();
    } finally {
      runtime.counter--;
      runtime.currentAtom = prevAtom;
    }
  },
};
