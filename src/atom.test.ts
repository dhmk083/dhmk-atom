import { atom, observe, act } from "./";

describe("atom", () => {
  test("basic", () => {
    const a = atom(1);
    const b = atom(() => a() + 1);

    expect(a()).toEqual(1);
    expect(b()).toEqual(2);

    act(() => a.set(2));

    expect(a()).toEqual(2);
    expect(b()).toEqual(3);
  });

  test("oldValue eq newValue == don`t invalidate children", () => {
    const a = atom(1);
    const b = atom(() => a() % 2);
    const spy = jest.fn();
    const c = atom(() => spy(b()));
    observe(c); // if comment this, total called times should be 4

    c(); // b = 1

    expect(spy).toBeCalledTimes(1);

    act(() => a.set(3)); // b = 1
    c();

    expect(spy).toBeCalledTimes(1);

    act(() => a.set(5)); // b = 0
    c();
    act(() => a.set(6)); // b = 0
    c();

    expect(spy).toBeCalledTimes(2);
  });

  test("diamond", () => {
    const computeSpy = jest.fn();
    const observeSpy = jest.fn();
    const a = atom(1);
    const b = atom(() => a() + 1);
    const c = atom(() => a() * 10);
    const d = atom(() => {
      computeSpy();
      return b() + c();
    });

    observe(() => {
      d();
      observeSpy();
    });

    expect(d()).toEqual(12);
    expect(computeSpy).toBeCalledTimes(1);
    expect(observeSpy).toBeCalledTimes(1);

    act(() => a.set(2));

    expect(d()).toEqual(23);
    expect(computeSpy).toBeCalledTimes(2);
    expect(observeSpy).toBeCalledTimes(2);
  });

  test("onBO/onBUO", () => {
    const onBOspy = jest.fn();
    const onBUOspy = jest.fn();
    const a = atom(1, {
      onBecomeObserved: onBOspy,
      onBecomeUnobserved: onBUOspy,
    });

    expect(onBOspy).toBeCalledTimes(0);
    expect(onBUOspy).toBeCalledTimes(0);

    // irrelevant
    act(() => a.set(2));

    expect(onBOspy).toBeCalledTimes(0);
    expect(onBUOspy).toBeCalledTimes(0);

    // BO
    const d = observe(a);

    expect(onBOspy).toBeCalledTimes(1);
    expect(onBUOspy).toBeCalledTimes(0);

    // irrelevant
    act(() => a.set(3));

    expect(onBOspy).toBeCalledTimes(1);
    expect(onBUOspy).toBeCalledTimes(0);

    // BUO
    d();

    expect(onBOspy).toBeCalledTimes(1);
    expect(onBUOspy).toBeCalledTimes(1);

    // irrelevant
    d();

    expect(onBOspy).toBeCalledTimes(1);
    expect(onBUOspy).toBeCalledTimes(1);

    // irrelevant
    act(() => a.set(4));

    expect(onBOspy).toBeCalledTimes(1);
    expect(onBUOspy).toBeCalledTimes(1);

    // BO
    const d2 = observe(a);

    expect(onBOspy).toBeCalledTimes(2);
    expect(onBUOspy).toBeCalledTimes(1);

    // BUO
    d2();

    expect(onBOspy).toBeCalledTimes(2);
    expect(onBUOspy).toBeCalledTimes(2);
  });
});

describe("observe", () => {
  test("basic", () => {
    const a = atom(1);
    const b = atom(2);
    const spy = jest.fn();
    observe(() => {
      a() + b();
      spy();
    });

    expect(spy).toBeCalledTimes(1);

    act(() => a.set(2));
    act(() => b.set(3));

    expect(spy).toBeCalledTimes(3);
  });

  test("re-runs if atoms changed in-flight", () => {
    const a = atom(0);
    const spy = jest.fn();

    observe(() => {
      if (a() === 1) a.set(2);
      spy();
    });

    expect(spy).toBeCalledTimes(1);

    act(() => a.set(1));
    expect(spy).toBeCalledTimes(3);

    const spy2 = jest.fn();

    observe(() => {
      if (a() === 3) a.set(4);

      // if we read changed atom again, effect won't be recalculated
      a();
      spy2();
    });

    expect(spy2).toBeCalledTimes(1);

    act(() => a.set(3));
    expect(spy2).toBeCalledTimes(2);
  });

  test("dispose", () => {
    const a = atom(1);
    const spy = jest.fn();

    observe((d) => {
      a();
      d();
      spy();
    });

    act(() => a.set(2));
    act(() => a.set(3));
    expect(spy).toBeCalledTimes(1);

    const d = observe(() => {
      a();
      spy();
    });

    d();
    act(() => a.set(4));
    act(() => a.set(5));
    expect(spy).toBeCalledTimes(2);
  });

  test("custom scheduler", async () => {
    const a = atom(1);
    const spy = jest.fn();

    observe(
      () => {
        a();
        spy();
      },
      {
        scheduler: (run: any) => Promise.resolve().then(run),
      }
    );

    expect(spy).toBeCalledTimes(0);
    act(() => a.set(2));
    await null;
    expect(spy).toBeCalledTimes(1);
  });

  test("force run in batch", () => {
    const a = atom(1);
    const spy = jest.fn();
    const d = observe(() => {
      a();
      spy();
    });

    expect(spy).toBeCalledTimes(1);

    act(() => {
      d.invalidate(/*false*/);
      expect(spy).toBeCalledTimes(1);

      d.invalidate(/*true*/);
      expect(spy).toBeCalledTimes(1);
    });

    expect(spy).toBeCalledTimes(2);
  });
});

test("action", () => {
  const a = atom(1);
  const b = atom(2);
  const spy = jest.fn();
  observe(() => {
    a() + b();
    spy();
  });

  expect(spy).toBeCalledTimes(1);

  act(() => {
    a.set(2);
    b.set(3);
  });

  expect(spy).toBeCalledTimes(2);
});
