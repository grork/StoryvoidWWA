(function () {
    "use strict";
    var Signal = Codevoid.Utilities.Signal;
    var promiseTest = InstapaperTestUtilities.promiseTest;

    module("utilitiesSignal");

    function canConstructSignal() {
        var signal = new Signal();
        ok(signal, "Didn't get a valid signal");
        ok(WinJS.Promise.is(signal.promise), "Signal didn't have a valid promise on it");
    }

    function signalCanBeCancelled() {
        var signal = new Signal();
        var wasCancelled = false;
        signal.addEventListener("cancelled", function () {
            wasCancelled = true;
        });

        signal.promise.cancel();

        ok(wasCancelled, "Promise wasn't cancelled");
    }

    function cancelledSignalHasOriginalSignalInEvent() {
        var signal = new Signal();
        var wasCancelled = false;
        signal.addEventListener("cancelled", function (e) {
            strictEqual(signal, e.detail.signal);
        });

        signal.promise.cancel();
    }

    function signalCanComplete() {
        var signal = new Signal();
        var completed = false;
        signal.promise.done(function () {
            completed = true;
        });

        signal.complete();

        ok(completed, "Signal didn't complete");
    }

    function signalCompletesWithValue() {
        var signal = new Signal();
        var completed = false;
        signal.promise.done(function (data) {
            ok(data, "didn't get data");
            ok(data.isComplete, "Should have had complete property");
        });

        signal.complete({ isComplete: true });
    }

    function signalCantCompleteMoreThanOnce() {
        var signal = new Signal();
        var completed = 0;
        signal.promise.done(function () {
            completed++;
        });

        signal.complete();

        try {
            signal.complete();
        } catch(e) {
        }

        strictEqual(completed, 1, "Shouldn't complete more than once");

    }

    function signalThrowsWhenCompletingTwice() {
        var signal = new Signal();

        signal.complete();
        
        try {
            signal.complete();
        } catch(e) {
            ok(true, "Got exception!");
        }
    }

    function errorRaisedOnPromise() {
        var signal = new Signal();
        var errorCalled = false;
        signal.promise.done(function () {
            ok(false, "shouldn't be called");
        }, function () {
            errorCalled = true;
        });

        signal.error();

        ok(errorCalled, "Error wasn't called");
    }

    function errorRaisedOnPromiseWithErrorInfo() {
        var signal = new Signal();
        var errorCalled = false;
        signal.promise.done(function () {
            ok(false, "shouldn't be called");
        }, function (errorInfo) {
            errorCalled = true;
            ok(errorInfo, "no error info");
            ok(errorInfo.errorDetail, "No error details");
        });

        signal.error({ errorDetail: "detail" });

        ok(errorCalled, "Error wasn't called");
    }

    function progressReported() {
        var signal = new Signal();
        var progress = 0;
        signal.promise.done(function () {
            ok(false, "complete shouldn't be called");
        }, function () {
            ok(false, "Error shouldn't be called");
        }, function () {
            progress++;
        });

        signal.progress();
        signal.progress();

        strictEqual(progress, 2, "expected progress to be called twice");
    }

    function progressReportedWithData() {
        var item1 = { data: "item1" };
        var item2 = { data: "item2" };

        var signal = new Signal();
        var progress = [];
        signal.promise.done(function () {
            ok(false, "complete shouldn't be called");
        }, function () {
            ok(false, "Error shouldn't be called");
        }, function (data) {
            progress.push(data);
        });

        signal.progress(item1);
        signal.progress(item2);

        strictEqual(progress.length, 2, "expected progress to be called twice");
        strictEqual(progress[0], item1, "First item wasn't correct");
        strictEqual(progress[1], item2, "second item wasn't correct");
    }

    test("canConstructSignal", canConstructSignal);
    test("signalCanBeCancelled", signalCanBeCancelled);
    test("cancelledSignalHasOriginalSignalInEvent", cancelledSignalHasOriginalSignalInEvent);
    test("signalCanComplete", signalCanComplete);
    test("signalCompletesWithValue", signalCompletesWithValue);
    test("signalCantCompleteMoreThanOnce", signalCantCompleteMoreThanOnce);
    test("signalThrowsWhenCompletingTwice", signalThrowsWhenCompletingTwice);
    test("errorRaisedOnPromise", errorRaisedOnPromise);
    test("errorRaisedOnPromiseWithErrorInfo", errorRaisedOnPromiseWithErrorInfo);
    test("progressReported", progressReported);
    test("progressReportedWithData", progressReportedWithData);

    module("UtilitiesPromiseSerializer");

    promiseTest("handlerAppliedToAllPromises", function () {
        var promisesCompleted = 0;
        var data = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ];
        
        var doWork = function doWork(item) {
            promisesCompleted++;
            return WinJS.Promise.timeout();
        };


        return Codevoid.Utilities.serialize(data, doWork).then(function () {
            strictEqual(promisesCompleted, 10);
        });
    });

    promiseTest("makeSureWeDontRunOutOfStackSpace", function () {
        var promisesCompleted = 0;
        var data = [];
        for (var i = 0; i < 10000; i++) {
            data.push(i);
        }

        var doWork = function doWork(item) {
            promisesCompleted++;
            return WinJS.Promise.timeout();
        };

        return Codevoid.Utilities.serialize(data, doWork).then(function () {
            strictEqual(promisesCompleted, data.length);
        });
    });

    promiseTest("workIsPerformedInSerial", function () {
        var promiseExecuting = false;
        var completedPromises = 0;
        var data = [1, 2, 3, 4, 5, 6, 8, 9, 10];
        var doWork = function () {
            ok(!promiseExecuting, "A promise was already executing");
            promiseExecuting = true;
            return WinJS.Promise.timeout(10).then(function () {
                promiseExecuting = false;
                completedPromises++;
            });
        };

        return Codevoid.Utilities.serialize(data, doWork).then(function () {
            strictEqual(completedPromises, data.length);
        });
    });

    promiseTest("stillCompletesIfOneErrors", function () {
        var doWork = function (item) {
            if (item === 5) {
                throw "Failure!";
            }

            return WinJS.Promise.timeout();
        };
        var data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        return Codevoid.Utilities.serialize(data, doWork).then(function () {
            ok(false, "Shouldn't succeed");
        }, function () {
            ok(true, "should have gotten error");
        });
    });

    promiseTest("getValuesAfterCompletion", function () {
        var doWork = function (item) {
            return WinJS.Promise.timeout().then(function () {
                return item;
            });
        };
        var data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        return Codevoid.Utilities.serialize(data, doWork).then(function (values) {
            values.forEach(function (value, index) {
                strictEqual(value, data[index], "Values & Order didn't match at index: " + index);
            });
        });
    });
})();