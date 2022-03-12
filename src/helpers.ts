import { object, array, map, set } from "@dhmk/utils";
import {
  atom,
  WritableAtom,
  Atom,
  NotAtom,
  atTransactionEnd,
  observe,
  AtomOptions,
} from "./atom";

export interface ObjectAtom<T> extends WritableAtom<T> {
  merge(arg: Partial<T>): void;
  merge(arg: (prev: T) => Partial<T>): void;
}

export function objectAtom<T extends object>(
  value: T,
  options?: AtomOptions<T>
): ObjectAtom<T> {
  const a: any = atom(value, options);

  a.merge = (what) => {
    a.set(object.merge(a(), what));
  };

  return a;
}

export interface ArrayAtom<T> extends WritableAtom<ReadonlyArray<T>> {
  set(value: ReadonlyArray<T>): boolean;

  set(i: number, v: NotAtom<T | ((x: T, i: number) => T)>): void;

  update(fn: (v: T, i: number, a: ReadonlyArray<T>) => T): void;

  insert(i: number, ...v: T[]): void;

  append(...v: T[]): void;

  remove(
    v: NotAtom<T | ((v: T, i: number, a: ReadonlyArray<T>) => boolean)>
  ): void;
}

export function arrayAtom<T>(
  value: ReadonlyArray<T> = [],
  options?: AtomOptions<ReadonlyArray<T>>
): ArrayAtom<T> {
  const a: any = atom(value, options);
  const _set = a.set;

  a.set = (...args) => {
    if (args.length === 1) {
      return _set(args[0]);
    } else {
      _set(array.set(a(), args[0], args[1]));
    }
  };

  a.update = (fn) => a.set(a().map(fn));

  a.insert = (i, ...v) => a.set(array.insert(a(), i, ...v));

  a.append = (...v) => a.insert(a().length, ...v);

  a.remove = (arg) => a.set(array.remove(a(), arg));

  return a;
}

export interface MapAtom<K, V> extends Atom<ReadonlyMap<K, V>> {
  set(value: ReadonlyMap<K, V>): boolean;

  set(k: K, v: V): void;

  delete(k: K): void;

  clear(): void;
}

export function mapAtom<K, V>(
  value: ReadonlyMap<K, V> = new Map(),
  options?: AtomOptions<ReadonlyMap<K, V>>
): MapAtom<K, V> {
  const a: any = atom(value, options);
  const _set = a.set;

  a.set = (...args) => {
    if (args.length === 1) {
      return _set(args[0]);
    } else {
      _set(map.set(a(), args[0], args[1]));
    }
  };

  a.delete = (k) => _set(map.delete(a(), k));

  a.clear = () => _set(new Map());

  return a;
}

export interface SetAtom<T> extends WritableAtom<ReadonlySet<T>> {
  add(v: T): void;

  delete(v: T): void;

  clear(): void;
}

export function setAtom<T>(
  value: ReadonlySet<T> = new Set(),
  options?: AtomOptions<ReadonlySet<T>>
): SetAtom<T> {
  const a: any = atom(value, options);

  a.add = (v) => a.set(set.add(a(), v));

  a.delete = (v) => a.set(set.delete(a(), v));

  a.clear = () => a.set(new Set());

  return a;
}

export function asyncAtom<T = any>(
  fn: (prev: T) => Promise<T>,
  initial: T,
  options?: AtomOptions<T>
): Atom<T>;
export function asyncAtom<T = any>(
  fn: (prev?: T) => Promise<T>
): Atom<T | undefined>;
export function asyncAtom<T>(fn, initial?: T, options?) {
  const a = atom(initial, options);
  let c = { cancelled: false };

  return () => {
    c.cancelled = true;
    const cc = (c = { cancelled: false });
    fn(a()).then((x) => {
      !cc.cancelled && a.set(x);
    });
    return a();
  };
}

export function debouncedEvents(onBO: Function, onBUO: Function) {
  let balance = 0;
  let wasObserved = false;
  let bo = false;
  let buo = false;

  return {
    onBecomeObserved() {
      wasObserved = true;
      balance++;
      if (!bo) {
        bo = true;
        atTransactionEnd(() => balance && onBO());
      }
    },

    onBecomeUnobserved() {
      balance--;
      if (!buo) {
        buo = true;
        atTransactionEnd(() => wasObserved && !balance && onBUO());
      }
    },
  };
}

export const keepAlive = <T>(a: Atom<T>): Atom<T> & { dispose() } => {
  const self = () => a();
  self.dispose = observe(self);
  return self as any;
};

// const mappedItems = atom(cacheMap(() => items, x => y));

// export function cacheMap(getArr, mapItem) {
//   let cache = new Map();

//   return () => {
//     const nextCache = new Map();

//     const res = getArr().map((x) => {
//       const cx = cache.get(x) ?? mapItem(x);
//       nextCache.set(x, cx);
//       return cx;
//     });

//     cache = nextCache;
//     return res;
//   };
// }
