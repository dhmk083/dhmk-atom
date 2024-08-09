import observableObject from "./object";
import observableArray from "./array";

export default function observable<T>(x: T): T {
  if (Array.isArray(x))
    return observableArray(x.map(observable)) as unknown as T;

  if (
    x &&
    typeof x === "object" &&
    Object.getPrototypeOf(x) === Object.prototype
  )
    return observableObject(x as T & object, observable) as unknown as T;

  return x;
}
