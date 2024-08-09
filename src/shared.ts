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

export function useAtom(a: WithObservers & Dependency) {
  const self = runtime.currentAtom;
  if (!self) return;

  if (a.runId === self.runId) return;
  a.runId = self.runId;

  if (
    self.prevDepsIndex < self.prevDeps.length &&
    a === self.prevDeps[self.prevDepsIndex]
  ) {
    self.prevDepsIndex++;
    self.isObserved ? self.deps.push(a) : self.depsForUnobserved.add(a);
    return;
  }

  if (!self.isObserved) {
    self.depsForUnobserved.add(a);
    return;
  }

  const cid = a.observers.get(self);
  if (cid !== self.runId) {
    a.observers.set(self, self.runId);
    self.deps.push(a);
  }
}

export function reportError(e: unknown) {
  return () => {
    throw e;
  };
}
