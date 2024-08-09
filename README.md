# @dhmk-atom

MobX-like observable atoms, computeds and observers.

Install: `npm install @dhmk/atom`

## Example

```ts
import { observable, observe, act } from "@dhmk-atom";

const x = observable({
  id: 123,
  get computedProp() {
    return this.id.toString();
  },
});

const dispose = observe(() => console.log(x.computedProp));

act(() => (x.id = 456));

dispose();
```

## API

### `atom(value: T, opts?: AtomOptions): WritableAtom<T>`

Creates a value atom which is similar to MobX [observable.box(value, { deep: false })](https://mobx.js.org/api.html#observablebox).

```ts
type AtomOptions = {
  equals?: (next: T, prev: T) => boolean;
  onBecomeObserved?: () => void;
  onBecomeUnobserved?: () => void;
  set?: (setter: (x: T) => void) => (x: T) => void;
};

type WritableAtom<T> = {
  (): T;
  get(): T;
  set(x: T): void;
};
```

### `atom(fn: () => T, opts?: ComputedAtomOptions): Atom<T>`

Creates a computed atom which is similar to MobX [computed](https://mobx.js.org/api.html#computed).

```ts
type ComputedAtomOptions = {
  equals?: (next: T, prev: T) => boolean;
  onBecomeObserved?: () => void;
  onBecomeUnobserved?: () => void;
};

type ComputedAtom<T> = {
  (): T;
  get(): T;
};
```

### `observable(x)`

Creates observable object or array. See also `observableObject`, `observableArray`, `as`.

### `observe(fn: (self: Observer) => void, opts?: ObserverOptions): Observer`

Similar to MobX [autorun](https://mobx.js.org/api.html#autorun).

```ts
type ObserverOptions = {
  scheduler?: (run: Function) => void;
  onBecomeObserved?: () => void;
  onBecomeUnobserved?: () => void;
};

type Observer = {
  // dispose
  (): void;

  // schedule observer for execution even if no tracked atoms were changed
  invalidate(): void;

  readonly isInitial: boolean;
};
```

### `act(fn: () => T): T`

MobX [runInAction](https://mobx.js.org/api.html#runinaction).

### `untracked(fn: () => T): T`

MobX [untracked](https://mobx.js.org/api.html#untracked).

### `as(x: { get, set? })`

Instructs `observableObject` to initialize property as given object instead of default behavior.

### `observableObject(x)`

```ts
observableObject({
  id: 123,
  get computedProp() {
    return this.id.toString();
  },
  withOptions: as(atom("abc", { onBecomeObserved() {} })),
});
```

### `observableArray(x)`

### `ValueAtom`

### `ComputedAtom`

### `EffectAtom`
