import { ValueAtom } from "../atoms/value";
import { ComputedAtom } from "../atoms/computed";

const AS = Symbol();

export function as<T>(x: { get(): T; set?: (value: T) => void }): T {
  return {
    [AS]: x,
  } as any;
}

export default function observableObject<T extends object>(
  x: T,
  creator = (value: T[keyof T], key: keyof T) => value
): T {
  const atoms = new Map();

  return new Proxy(x, {
    get(t, p, r) {
      const desc = Object.getOwnPropertyDescriptor(t, p);

      if (desc?.get) {
        // computed
        let a = atoms.get(p);
        if (!a) {
          let initialized;
          let getter = desc.get;

          a = new ComputedAtom(() => {
            let value = getter.call(r);

            if (!initialized) {
              initialized = true;
              const sudo = value[AS];

              if (sudo) {
                getter = sudo.get;
                value = getter.call(r);
              } else {
                value = creator(value, p as keyof T);
              }
            }
            return value;
          });

          atoms.set(p, a);
        }
        return a.get();
      }

      let v = t[p];
      if (typeof v === "function") return v;

      let a = atoms.get(p);
      if (!a) {
        a = v?.[AS] ? v[AS] : new ValueAtom(creator(v, p as keyof T));
        atoms.set(p, a);
      }
      return a.get();
    },

    set(t, p, v) {
      let a = atoms.get(p);

      if (!a) {
        const v = t[p];
        a = v?.[AS] ? v[AS] : new ValueAtom(undefined);
        atoms.set(p, a);
      }

      a.set(creator(v, p as keyof T));
      return true;
    },
  });
}
