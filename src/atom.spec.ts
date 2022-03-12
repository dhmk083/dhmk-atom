import { atom, observe, runInAction } from "./atom";

describe("atom", () => {
  test("basic", () => {
    const a = atom(1);
    const b = atom(() => a() + 1);

    expect(a()).toEqual(1);
    expect(b()).toEqual(2);

    a.set(2);

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

    a.set(3); // b = 1
    c();

    expect(spy).toBeCalledTimes(1);

    a.set(5); // b = 0
    c();
    a.set(6); // b = 0
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

    a.set(2);

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
    a.set(2);

    expect(onBOspy).toBeCalledTimes(0);
    expect(onBUOspy).toBeCalledTimes(0);

    // BO
    const d = observe(a);

    expect(onBOspy).toBeCalledTimes(1);
    expect(onBUOspy).toBeCalledTimes(0);

    // irrelevant
    a.set(3);

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
    a.set(4);

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

    // in batch (right now it ignores batching and calls BO/BUO immediately)
    runInAction(() => {
      const d3 = observe(a);
      d3();

      expect(onBOspy).toBeCalledTimes(3);
      expect(onBUOspy).toBeCalledTimes(3);

      const d4 = observe(a);
      d4();

      expect(onBOspy).toBeCalledTimes(4);
      expect(onBUOspy).toBeCalledTimes(4);
    });

    expect(onBOspy).toBeCalledTimes(4);
    expect(onBUOspy).toBeCalledTimes(4);
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

    a.set(2);
    b.set(3);

    expect(spy).toBeCalledTimes(3);
  });

  test("re-runs if atoms changed in-flight", () => {
    const a = atom(1);
    const spy = jest.fn();

    observe(() => {
      if (a() === 1) a.set(2);
      if (a() === 10) a.set(11);

      spy();
    });

    expect(spy).toBeCalledTimes(2);

    a.set(3);
    expect(spy).toBeCalledTimes(3);

    a.set(10);
    expect(spy).toBeCalledTimes(5);
  });

  test("dispose", () => {
    const a = atom(1);
    const spy = jest.fn();

    observe((d) => {
      a();
      d();
      spy();
    });

    a.set(2);
    a.set(3);
    expect(spy).toBeCalledTimes(1);

    const d = observe(() => {
      a();
      spy();
    });

    d();
    a.set(4);
    a.set(5);
    expect(spy).toBeCalledTimes(2);
  });

  test("custom async scheduler", (done) => {
    const a = atom(1);
    const spy = jest.fn();
    let sch = (x) => x();

    observe(
      () => {
        if (a() === 11) {
          // the end

          // 1 - initial pass
          // 2 - after a.set(2)
          // 3 - after a.set(10)
          expect(spy).toBeCalledTimes(3);
          done();
        }

        if (a() === 1) {
          a.set(2);

          setTimeout(() => {
            // 1. now, observe will run outside `runPendingAtoms` (and batching)
            sch = (x) => setTimeout(x);
            a.set(10);
          });
        }

        if (a() === 10) {
          // 2. still outside `runPendingAtoms`
          // call `observe` immediately
          // this will fail if g_batchCount === 0
          sch = (x) => x();
          a.set(11);
        }

        spy();
      },
      {
        scheduler: (run) => sch(run),
      }
    );
  });

  test("force run in batch", () => {
    const a = atom(1);
    const spy = jest.fn();
    const d = observe(() => {
      a();
      spy();
    });

    expect(spy).toBeCalledTimes(1);

    runInAction(() => {
      d.invalidate(false);
      expect(spy).toBeCalledTimes(1);

      d.invalidate(true);
      expect(spy).toBeCalledTimes(2);
    });

    expect(spy).toBeCalledTimes(2);
  });
});

test("runInAction", () => {
  const a = atom(1);
  const b = atom(2);
  const spy = jest.fn();
  observe(() => {
    a() + b();
    spy();
  });

  expect(spy).toBeCalledTimes(1);

  runInAction(() => {
    a.set(2);
    b.set(3);
  });

  expect(spy).toBeCalledTimes(2);
});
