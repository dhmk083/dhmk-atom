import { runtime } from "./runtime";
import { Dependency, Id } from "./types";

type WithObservers = {
  observers: Map<unknown, Id>;
};

type Disposable = {
  dispose(): void;
};

export const removeAtom = (a, self: unknown) => {
  a.subs.delete(self);
  if (!a.subs.size) a.dispose();
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

export function eacha(a, fn, i = 0, s = a.length) {
  while (i < s) fn(a[i++]);
}

export function eachar(a, fn) {
  let i = 0,
    s = a.length;
  while (i < s) if (fn(a[i++]) === false) return false;
  return true;
}

export function invalidate(as, s, iv) {
  as.forEach((_, a) => {
    if (iv && a.state === 4) {
      if (a.isEffect) runtime.addEffect(a);
      a.state = 1;
      return;
    }

    if (a.state >= s) return;
    a.state = s;

    if (a.isEffect) runtime.addEffect(a);

    a.subs.size && invalidate(a.subs, 2, iv);
  });
}
