# @dhmk-atom

Mobx-like observable atoms, computeds and observers.

Install: `npm install @dhmk/atom`

## Atom types

```ts
type Atom<T> = {
  (): T;
};
```

```ts
type WritableAtom<T> = {
  (): T;
  set(value: T): boolean; // true - if `value` differs from previous one
};
```

```ts
type AtomOptions = {
  eq: (oldValue, newValue) => boolean;
  onBecomeObserved: () => void;
  onBecomeUnobserved: () => void;
  setter: (originalSetter: Setter<T>) => Setter<T>;
};

type Setter<T> = (value: T) => ValueChanged | ValueNotChanged;

type ValueChanged = true;
type ValueNotChanged = false;
```

### `atom(value: T, opts?: AtomOptions): WritableAtom<T>`

Creates a value atom which is very similar to MobX `observable.box(value, { deep: false })`. The only difference is that the `.get()` is replaced by calling `()` directly.

### `atom(fn: () => T, opts?: AtomOptions): Atom<T>`

Creates a computed atom which is like Mobx `computed(fn)`.

## Observer types

```ts
type Observer = {
  (): void; // dispose
  invalidate(forceThroughBatches = false): void;
  readonly isInitial: boolean;
  readonly isDisposed: boolean;
};
```

```ts
type ObserverOptions = {
  attachToParent: boolean = true;
  checkStale: boolean = true;
  scheduler: (run: Function) => void;
};
```

### `observe(fn: (self: Observer) => void, opts?: ObserverOptions): Observer`

Creates an observer which is like Mobx `autorun(fn)`. Whenever an atom which was read during `fn` execution changes, the observer schedules `fn` for execution once again.

#### `Observer.invalidate(force?)`

Schedules `fn` for execution even if no tracked atoms were changed. If `force` is true also ignores any current transactions.

#### `ObserverOptions.attachToParent`

When true created observer will be tracked by parent observer if exists. Whenever the parent observer `fn` re-executes it will dispose this tracked child observer. If there is no parent observer you must dispose created observer manually.

When false, you must dispose created observer manually.

#### `ObserverOptions.checkStale`

When true throws an error if no atoms were read during `fn` execution. Because in this case observer will become stale and will not call its `fn` until you `invalidate` it manually.

## Transactions (batches)

Transactions are similar to MobX transactions. During a transaction no observers are run automatically (though you can run one by calling `observer.invalidate(true)`). Also, no atoms are tracked (`untracked(fn)` is applied).

### `untracked(fn: () => T): T`

Runs `fn` without tracking any atoms which are read during its execution. Returns `fn` result. Doesn't apply transaction.

### `runInAction(fn: () => T): T`

Runs `fn` in transaction. Returns `fn` result. Also applies `untracked`.

### `runInFlow(flow)`

Runs `flow` in transaction. Returns its result. See [@dhmk/utils](https://github.com/dhmk083/dhmk-utils/blob/d3bea84901abd0836dcc9e72b1b5a800a29577c9/src/fn.ts#L103) for more info about flow.

### `atTransactionEnd(fn)`

Runs `fn` at the end of the outermost transaction or immediately if is not in transaction.

## Helpers

### `keepAlive(computed: Atom<T>): Atom<T> & { dispose() }`

Similar to MobX, if a computed atom isn't observed by anyone, its value is recomputed on every access. This function is a shorcut to `observe(computed)`.

### `objectAtom()`

### `arrayAtom()`

### `mapAtom()`

### `setAtom()`

### `asyncAtom()`

### `debouncedEvents()`
