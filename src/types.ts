export class Id {
  private id!: "id"; // branded type
}

export const EID = new Id();

export class Track {
  constructor(public a?, public m?, public v?) {}
}

export const ET = new Track();

export interface Dependency {
  actualize(): void;
  dispose(): void;
  observers: Map<unknown, Id>;
  versionId: Id;
  runId: Id;
}

export enum AtomState {
  Actual,
  PossiblyStale,
  Stale,
}

export type Atom = {
  invalidate(state: AtomState, isValueAtom: boolean): void;
};

export type _AtomOptions<T> = {
  equals(next: T, prev: T): boolean;
  onBecomeObserved?(): void;
  onBecomeUnobserved?(): void;
};

export type AtomOptions<T> = Partial<_AtomOptions<T>>;

export const defaultAtomOptions = {
  equals: Object.is,
};

export type _EffectAtomOptions = {
  scheduler(fn: () => void): void;
  onBecomeObserved?(): void;
  onBecomeUnobserved?(): void;
};

export type EffectAtomOptions = Partial<_EffectAtomOptions>;

export const defaultEffectOptions = {
  scheduler: (fn) => fn(),
};
