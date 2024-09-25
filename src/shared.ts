import { runtime } from "./runtime";
import { Dependency, Id } from "./types";

type WithObservers = {
  observers: Map<unknown, Id>;
};

type Disposable = {
  dispose(): void;
};

export const removeAtom = (a: WithObservers & Disposable, self: unknown) => {
  a.observers.delete(self);
  if (!a.observers.size) a.dispose();
};

export function useAtom(a) {
  const ca = runtime.currentAtom;
  if (ca) ca.track(a);
}

export function reportError(e: unknown) {
  return () => {
    throw e;
  };
}

export function each(it, fn) {
  while (true) {
    const { done, value } = it.next();
    if (done) return true;
    if (fn(value) === false) return false;
  }
}
