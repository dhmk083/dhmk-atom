import {
  AtomState,
  _EffectAtomOptions,
  EffectAtomOptions,
  defaultEffectOptions,
} from "../types";
import { runtime } from "../runtime";
import { reportError } from "../shared";
import { ComputedAtom } from "./computed";

export class EffectAtom extends ComputedAtom<void> {
  isObserved = true;
  protected isCalculating = false;
  protected isDisposed = false;
  protected shouldRecalc = false;
  protected run: () => void;
  private effectOptions: _EffectAtomOptions;

  constructor(fn: () => void, effectOptions?: EffectAtomOptions) {
    super(fn, {
      equals: () => false,
      onBecomeObserved: effectOptions?.onBecomeObserved,
      onBecomeUnobserved: effectOptions?.onBecomeUnobserved,
    });
    this.effectOptions = { ...defaultEffectOptions, ...effectOptions };

    const actualize = super.actualize.bind(this);
    this.run = () => {
      if (!this.isObserved) return;

      runtime.addEffect({ actualize });
      runtime.runEffects();
    };
  }

  invalidate(state: AtomState, isValueAtom: boolean) {
    super.invalidate(state, isValueAtom);
    runtime.addEffect(this);
    if (isValueAtom) this.shouldRecalc = true;
  }

  calculate() {
    if (this.isDisposed) return;

    this.shouldRecalc = false;

    this.isCalculating = true;
    super.calculate();
    this.isCalculating = false;

    if (this.isError) {
      runtime.addEffect({ actualize: reportError(this.value) });
    }

    if (this.shouldRecalc) {
      this.state = AtomState.Stale;
    }

    if (this.isDisposed) {
      this.dispose();
    }
  }

  actualize() {
    this.effectOptions.scheduler(this.run);
  }

  dispose() {
    this.isDisposed = true;

    if (this.isCalculating) return;

    super.dispose();
    runtime.runEffects();
  }

  start() {
    this.invalidate(AtomState.Stale, false);
    runtime.runEffects();
  }
}
