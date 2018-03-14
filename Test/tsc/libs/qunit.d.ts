declare function test(testName: string, testFunction: () => void );
declare function asyncTest(testName: string, testFunction: () => void );
declare function module(moduleName: string);
declare function start();
declare function stop();
declare function expect(numberOfAssertsions: number);
declare function ok(result: any, message: string);
declare function equal(actual: any, expected: any, message: string);
declare function notEqual(actual: any, expected: any, message: string);
declare function deepEqual(actual: any, expected: any, message: string);
declare function notDeepEqual(actual: any, expected: any, message: string);
declare function strictEqual(actual: any, expected: any, message: string);
declare function notStrictEqual(actual: any, expected: any, message: string);
declare var QUnit: QUnit;

interface QUnit {
    module(moduleName: string);
}