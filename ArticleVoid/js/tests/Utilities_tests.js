(function () {
    "use strict";
    var Signal = Codevoid.Utilities.Signal;

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
        signal.complete();

        strictEqual(completed, 1, "Shouldn't complete more than once");

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
    test("errorRaisedOnPromise", errorRaisedOnPromise);
    test("errorRaisedOnPromiseWithErrorInfo", errorRaisedOnPromiseWithErrorInfo);
    test("progressReported", progressReported);
    test("progressReportedWithData", progressReportedWithData);
})();