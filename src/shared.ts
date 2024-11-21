import { runtime } from "./runtime";
import { AtomState } from "./types";

export function removeAtom(a, self) {
  a.subs.delete(self);
  if (!a.subs.size) a.dispose();
}

export function trackAtom(a) {
  const ca = runtime.currentAtom;
  if (ca) ca.track(a);
}

export function thrower(e: unknown) {
  return () => {
    throw e;
  };
}

export function invalidateSubs(atom, isValueAtom, newState = AtomState.Stale) {
  atom.subs.forEach((a) => {
    if (isValueAtom && a.state === AtomState.Computing) {
      if (a.isEffect) runtime.addEffect(a.run);
      a.state = AtomState.InvalidatedAndComputing;
      return;
    }

    if (a.state >= newState) return;
    a.state = newState;

    if (a.isEffect) runtime.addEffect(a.run);

    a.subs.size && invalidateSubs(a, isValueAtom, AtomState.PossiblyStale);
  });
}
