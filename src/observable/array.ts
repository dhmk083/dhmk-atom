import { ValueAtom } from "../atoms/value";

const ID_ATOM = Symbol();

const makeMutable = (name: string) =>
  function (this: any, ...args: any) {
    const self = this;

    self[name](...args);
    self[ID_ATOM].set({});
  };

const makePure = (name: string) =>
  function (this: any, ...args: any) {
    const self = this;

    self[ID_ATOM].get();
    return self[name](...args);
  };

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#copying_methods_and_mutating_methods
const mutableMethods = [
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift",
];

const patchedMethods: Record<string, any> = Object.create(null);

for (const k of Object.getOwnPropertyNames(Array.prototype)) {
  const v = Array.prototype[k];

  if (typeof v === "function") {
    patchedMethods[k] = mutableMethods.includes(k)
      ? makeMutable(k)
      : makePure(k);
  }
}

export default function observableArray<T>(x: T[]) {
  const idAtom = new ValueAtom({});
  x[ID_ATOM] = idAtom;

  return new Proxy(x, {
    get(t, p: any) {
      if (patchedMethods[p]) return patchedMethods[p].bind(x);
      if (p === "length" || !isNaN(p)) idAtom.get();
      return t[p];
    },

    set(t, p: any, v) {
      if (p === "length" || !isNaN(p)) {
        const prev = t[p];
        if (prev !== v) idAtom.set({});
      }
      t[p] = v;
      return true;
    },
  });
}
