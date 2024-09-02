import { runtime } from "./runtime";
import { Dependency, Id } from "./types";

type WithObservers = {
  observers: Array<any>; //Set<unknown>;
};

type Disposable = {
  dispose(): void;
};

export const removeAtom = (a: WithObservers & Disposable, self: unknown) => {
  // a.observers.delete(self);
  // a.observers.splice(a.observers.indexOf(self));
  a.observers = a.observers.filter((x) => x !== self);

  if (!a.observers.length) a.dispose();
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
    self.wm.set(a, { runId: {} });
    return;
  }

  // const cid = a.observers.get(self);
  // if (cid !== self.runId) {
  //   a.observers.set(self, self.runId);
  //   self.deps.push(a);
  // }

  let x = self.wm.get(a);
  if (!x) {
    x = { runId: {} };
    self.wm.set(a, x);
    a.observers.push(self);
  }
  if (x.runId !== self.runId) {
    x.runId = a.runId = self.runId;
    self.deps.push(a);
  }
}

export function reportError(e: unknown) {
  return () => {
    throw e;
  };
}
