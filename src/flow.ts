import { g, flow, runStep } from "@dhmk/utils";
import { runInAction } from "./atom";

export { g };

const run = (g, arg, isError) => runInAction(() => runStep(g, arg, isError));

export function runInFlow<T = void>(
  this: any,
  fn: () => Generator<unknown, T>
) {
  return flow.call(this, fn, run);
}
