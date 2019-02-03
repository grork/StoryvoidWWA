declare var QUnit: QUnit;

interface QUnitAssert {
    ok(result: any, message: string);
    equal(actual: any, expected: any, message: string);
    notEqual(actual: any, expected: any, message: string);
    deepEqual(actual: any, expected: any, message: string);
    notDeepEqual(actual: any, expected: any, message: string);
    strictEqual(actual: any, expected: any, message: string);
    notStrictEqual(actual: any, expected: any, message: string);
    raises(block: () => void, expected?: any, message?: string);
    async(): () => void;
    expect(numberOfAssertions: number);
}

interface QUnit {
    assert: QUnitAssert;

    test(testName: string, testFunction: (assert?: QUnitAssert) => void);
    module(moduleName: string);
    start();
    stop();
}