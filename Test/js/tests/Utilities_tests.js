(function () {
    "use strict";
    var Signal = Codevoid.Utilities.Signal;
    var getPlayground = InstapaperTestUtilities.getPlayground;
    var domUtilities = Codevoid.Utilities.DOM;
    var customUnloadingControlId = 0;
    const msfp = WinJS.Utilities.markSupportedForProcessing;

    WinJS.Namespace.define("CodevoidTests", {
        TestControl: WinJS.Class.define(function (element) {
            this.domElement = element;
        }, {
                domElement: null,
                disposed: false,
                dispose: function () {
                    this.disposed = true;
                },
            }, {
                getElementForControl: function () {
                    var element = document.createElement("div");
                    element.setAttribute("data-win-control", "CodevoidTests.TestControl");

                    return element;
                }
            }),
        CustomUnloadingControl: WinJS.Class.define(function (element) {
            this.domElement = element;
            this.uid = customUnloadingControlId++;
        }, {
                element: null,
                disposed: false,
                dispose: function () {
                    if (!CodevoidTests.CustomUnloadingControl.unloadedOrder) {
                        CodevoidTests.CustomUnloadingControl.unloadedOrder = [];
                    }

                    CodevoidTests.CustomUnloadingControl.unloadedOrder.push(this.uid);
                },
            }, {
                getElementForControl: function () {
                    var element = document.createElement("div");
                    element.setAttribute("data-win-control", "CodevoidTests.CustomUnloadingControl");

                    return element;
                },
                unloadedOrder: null,
                loadOrder: null,
            }),
        UnitTestView: WinJS.Class.define(function () {
        }),
        EventSource: WinJS.Class.mix(WinJS.Class.define(function () { }), WinJS.Utilities.eventMixin),
    });

    describe("Utilities Signal", function () {
        it("can be constructed", function canConstructSignal() {
            var signal = new Signal();
            assert.ok(signal, "Didn't get a valid signal");
            assert.ok(WinJS.Promise.is(signal.promise), "Signal didn't have a valid promise on it");
        });

        it("can be exlicitly cancelled", function signalCanBeCancelled() {
            var signal = new Signal();
            var wasCancelled = false;
            signal.addEventListener("cancelled", function () {
                wasCancelled = true;
            });

            signal.promise.cancel();

            assert.ok(wasCancelled, "Promise wasn't cancelled");
        });

        it("when cancelled, event contains signal instance", function cancelledSignalHasOriginalSignalInEvent() {
            var signal = new Signal();
            var wasCancelled = false;
            signal.addEventListener("cancelled", function (e) {
                assert.strictEqual(signal, e.detail.signal);
            });

            signal.promise.cancel();
        });

        it("can be completed", function signalCanComplete() {
            var signal = new Signal();
            var completed = false;
            signal.promise.done(function () {
                completed = true;
            });

            signal.complete();

            assert.ok(completed, "Signal didn't complete");
        });

        it("includes value when completed", function signalCompletesWithValue() {
            var signal = new Signal();
            var completed = false;
            signal.promise.done(function (data) {
                assert.ok(data, "didn't get data");
                assert.ok(data.isComplete, "Should have had complete property");
            });

            signal.complete({ isComplete: true });
        });

        it("can't be completed more than once", function signalCantCompleteMoreThanOnce() {
            var signal = new Signal();
            var completed = 0;
            signal.promise.done(function () {
                completed++;
            });

            signal.complete();

            try {
                signal.complete();
            } catch (e) {
            }

            assert.strictEqual(completed, 1, "Shouldn't complete more than once");
        });


        it("signal throws when completeing a second time", function signalThrowsWhenCompletingTwice() {
            var signal = new Signal();

            signal.complete();

            try {
                signal.complete();
            } catch (e) {
                assert.ok(true, "Got exception!");
            }
        });

        it("calling error propagates to the promise", function errorRaisedOnPromise() {
            var signal = new Signal();
            var errorCalled = false;
            signal.promise.done(function () {
                assert.ok(false, "shouldn't be called");
            }, function () {
                errorCalled = true;
            });

            signal.error();

            assert.ok(errorCalled, "Error wasn't called");
        });

        it("error info is supplied to the promise error handler", function errorRaisedOnPromiseWithErrorInfo() {
            var signal = new Signal();
            var errorCalled = false;
            signal.promise.done(function () {
                assert.ok(false, "shouldn't be called");
            }, function (errorInfo) {
                errorCalled = true;
                assert.ok(errorInfo, "no error info");
                assert.ok(errorInfo.errorDetail, "No error details");
            });

            signal.error({ errorDetail: "detail" });

            assert.ok(errorCalled, "Error wasn't called");
        });

        it("progress is passed to the promise", function progressReported() {
            var signal = new Signal();
            var progress = 0;
            signal.promise.done(function () {
                assert.ok(false, "complete shouldn't be called");
            }, function () {
                assert.ok(false, "Error shouldn't be called");
            }, function () {
                progress++;
            });

            signal.progress();
            signal.progress();

            assert.strictEqual(progress, 2, "expected progress to be called twice");
        });

        it("data is supplied to the promise when progress is reported", function progressReportedWithData() {
            var item1 = { data: "item1" };
            var item2 = { data: "item2" };

            var signal = new Signal();
            var progress = [];
            signal.promise.done(function () {
                assert.ok(false, "complete shouldn't be called");
            }, function () {
                assert.ok(false, "Error shouldn't be called");
            }, function (data) {
                progress.push(data);
            });

            signal.progress(item1);
            signal.progress(item2);

            assert.strictEqual(progress.length, 2, "expected progress to be called twice");
            assert.strictEqual(progress[0], item1, "First item wasn't correct");
            assert.strictEqual(progress[1], item2, "second item wasn't correct");
        });
    });

    describe("Utilities Serialize promise execution", function () {
        it("all promises are executed", function () {
            var promisesCompleted = 0;
            var data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

            var doWork = function doWork(item) {
                promisesCompleted++;
                return WinJS.Promise.timeout();
            };


            return Codevoid.Utilities.serialize(data, doWork).then(function () {
                assert.strictEqual(promisesCompleted, 10);
            });
        });

        it("doesn't run out of stack space with lots of items to process", function () {
            this.timeout(60000);
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
                assert.strictEqual(promisesCompleted, data.length);
            });
        });

        it("the work is performed sequentially", function () {
            var promiseExecuting = false;
            var completedPromises = 0;
            var data = [1, 2, 3, 4, 5, 6, 8, 9, 10];
            var doWork = function () {
                assert.ok(!promiseExecuting, "A promise was already executing");
                promiseExecuting = true;
                return WinJS.Promise.timeout(10).then(function () {
                    promiseExecuting = false;
                    completedPromises++;
                });
            };

            return Codevoid.Utilities.serialize(data, doWork).then(function () {
                assert.strictEqual(completedPromises, data.length);
            });
        });

        it("concurrent work respects limit of concurrent items in flight", function () {
            var promiseExecuting = 0;
            var completedPromises = 0;
            var data = [1, 2, 3, 4, 5, 6, 8, 9, 10];

            var doWork = function () {
                promiseExecuting++;
                assert.ok(promiseExecuting < 3, "Only expected up to to promises")
                return WinJS.Promise.timeout(10).then(function () {
                    promiseExecuting--;
                    completedPromises++;
                });
            };

            return Codevoid.Utilities.serialize(data, doWork, 2).then(function () {
                assert.strictEqual(promiseExecuting, 0, "All promises should be complete");
                assert.strictEqual(completedPromises, data.length);
            });
        });

        it("all work is processed even if one promise fails", function () {
            var doWork = function (item) {
                if (item === 5) {
                    throw "Failure!";
                }

                return WinJS.Promise.timeout();
            };
            var data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

            return Codevoid.Utilities.serialize(data, doWork).then(function () {
                assert.ok(false, "Shouldn't succeed");
            }, function () {
                assert.ok(true, "should have gotten error");
            });
        });

        it("values are returned as an array when completed", function () {
            var doWork = function (item) {
                return WinJS.Promise.timeout().then(function () {
                    return item;
                });
            };
            var data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

            return Codevoid.Utilities.serialize(data, doWork).then(function (values) {
                values.forEach(function (value, index) {
                    assert.strictEqual(value, data[index], "Values & Order didn't match at index: " + index);
                });
            });
        });

        it("can be cancelled", () => {
            var promisesCompleted = 0;
            var data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

            var doWork = function doWork(item) {
                promisesCompleted++;
                if (item === 5) {
                    cancel.cancel();
                    return;
                }

                return WinJS.Promise.timeout();
            };

            var cancel = new Codevoid.Utilities.CancellationSource();

            return Codevoid.Utilities.serialize(data, doWork, 0, cancel).then(function () {
                assert.ok(false, "shouldn't succeed");
            }, function () {
                assert.strictEqual(promisesCompleted, 5);
            });
        });
    });

    describe("Utilities Control Eventing & Property", function () {
        it("Event listener lists can be attached", function () {
            var source = new CodevoidTests.EventSource();
            var eventWasRaised = false;

            Codevoid.Utilities.addEventListeners(source, {
                custom: function () {
                    eventWasRaised = true;
                },
            });

            source.dispatchEvent("custom", {});

            assert.ok(eventWasRaised, "No event raised");
        });

        it("Event listeners can attach more than one event", function () {
            var source = new CodevoidTests.EventSource();
            var eventWasRaised = false;
            var event2WasRaised = false;

            Codevoid.Utilities.addEventListeners(source, {
                custom: function () {
                    eventWasRaised = true;
                },
                custom2: function () {
                    event2WasRaised = true;
                },
            });

            source.dispatchEvent("custom", {});
            source.dispatchEvent("custom2", {});

            assert.ok(eventWasRaised, "No event raised");
            assert.ok(event2WasRaised, "No event raised");
        });

        it("Cancelling returned object adding listers cancels the attached handlers", function () {
            var source = new CodevoidTests.EventSource();
            var eventWasRaised = false;
            var event2WasRaised = false;

            var cancel = Codevoid.Utilities.addEventListeners(source, {
                custom: function () {
                    eventWasRaised = true;
                },
                custom2: function () {
                    event2WasRaised = true;
                },
            });

            source.dispatchEvent("custom", {});
            source.dispatchEvent("custom2", {});

            assert.ok(eventWasRaised, "No event raised");
            assert.ok(event2WasRaised, "No event raised");

            cancel.cancel();

            // Reset the flags so they can be checked again
            eventWasRaised = false;
            event2WasRaised = false;

            source.dispatchEvent("custom", {});
            source.dispatchEvent("custom2", {});

            assert.ok(!eventWasRaised, "Event raised");
            assert.ok(!event2WasRaised, "Event raised");
        });
    });

    describe("Utilities Controls unloading", function () {
        beforeEach(InstapaperTestUtilities.clearPlayground);
        afterEach(InstapaperTestUtilities.clearPlayground);

        it("Disposed controls have their unload method called", function () {
            var playground = getPlayground();

            var controlElement = playground.appendChild(CodevoidTests.TestControl.getElementForControl());

            return WinJS.UI.process(controlElement).then(function () {
                domUtilities.disposeOfControl(controlElement);
                assert.ok(controlElement.winControl.disposed, "Control wasn't disposed");
            });
        });

        it("Unload is called on the entire tree being unloaded", function () {
            var playground = getPlayground();
            var parent = playground.appendChild(CodevoidTests.TestControl.getElementForControl());

            for (var i = 0; i < 5; i++) {
                parent.appendChild(CodevoidTests.TestControl.getElementForControl());
            }

            return WinJS.UI.processAll(playground).then(function () {
                var controls = WinJS.Utilities.query("[data-win-control]", playground);

                domUtilities.disposeOfControlTree(parent);

                controls.forEach(function (control) {
                    assert.ok(control.winControl.disposed, "Control wasn't disposed");
                });
            });
        });

        it("Unloading a tree calls from the leaf nodes in", function () {
            var playground = getPlayground();
            var parent = playground.appendChild(CodevoidTests.CustomUnloadingControl.getElementForControl());

            for (var i = 0; i < 5; i++) {
                parent = parent.appendChild(CodevoidTests.CustomUnloadingControl.getElementForControl());
            }

            return WinJS.UI.processAll(playground).then(function () {
                var controls = WinJS.Utilities.query("[data-win-control]", playground);


                domUtilities.disposeOfControlTree(playground.firstChild);

                var unloadOrder = CodevoidTests.CustomUnloadingControl.unloadedOrder;
                assert.strictEqual(unloadOrder.length, 6, "Incorrect number of controls");

                for (var i = 1; i < unloadOrder.length; i++) {
                    assert.ok(unloadOrder[i - 1] > unloadOrder[i], "Incorrect unload order detected. Control '" + unloadOrder[i - 1] + "' was not after '" + unloadOrder[i] + "'");
                }

                CodevoidTests.CustomUnloadingControl.unloadedOrder = null;
            });
        });

        it("one unload throwing does not stop all other unloads from being called", function () {
            var playground = getPlayground();

            var controlElement = playground.appendChild(CodevoidTests.TestControl.getElementForControl());
            var failingElement = playground.appendChild(CodevoidTests.TestControl.getElementForControl());
            var controlElement2 = playground.appendChild(CodevoidTests.TestControl.getElementForControl());

            return WinJS.UI.processAll(playground).then(function () {
                failingElement.winControl.dispose = function () {
                    throw new Error();
                };

                domUtilities.disposeOfControlTree(playground);
                assert.ok(controlElement.winControl.disposed, "Control wasn't disposed");
                assert.ok(controlElement2.winControl.disposed, "Control wasn't disposed");
            });
        });

        it("using the empty helper calls unload", function () {
            var playground = getPlayground();

            var controlElement = playground.appendChild(CodevoidTests.TestControl.getElementForControl());
            var controlElement2 = playground.appendChild(CodevoidTests.TestControl.getElementForControl());

            return WinJS.UI.processAll(playground).then(function () {

                domUtilities.empty(playground);
                assert.ok(controlElement.winControl.disposed, "Control wasn't disposed");
                assert.ok(controlElement2.winControl.disposed, "Control wasn't disposed");
            });
        });

        it("remove child helper calls unload", function () {
            var playground = getPlayground();
            var parent = playground.appendChild(document.createElement("div"));

            var controlElement = parent.appendChild(CodevoidTests.TestControl.getElementForControl());
            var controlElement2 = parent.appendChild(CodevoidTests.TestControl.getElementForControl());

            return WinJS.UI.processAll(playground).then(function () {

                domUtilities.removeChild(playground, parent);

                assert.ok(controlElement.winControl.disposed, "Control wasn't disposed");
                assert.ok(controlElement2.winControl.disposed, "Control wasn't disposed");
            });
        });
    });

    describe("Utilities Control Templates", function () {
        beforeEach(InstapaperTestUtilities.clearPlayground);
        afterEach(InstapaperTestUtilities.clearPlayground);

        it("can be loaded", function () {
            return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "testTemplate").then(function (template) {
                assert.ok(template, "Template Loaded!");
                domUtilities.clearTemplateCaches();
            });
        });

        it("a template is actually returned", function () {
            return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "testTemplate").then(function (template) {
                assert.ok(template, "Template Loaded!");
                assert.ok(template instanceof WinJS.Binding.Template, "Template isn't a WinJS.Binding.Template");
                domUtilities.clearTemplateCaches();
            });
        });

        it("failure is raised when the file containing the template doesn't exist", function () {
            return domUtilities.loadTemplate("/foo.html", "testTemplate").then(null, function () {
                assert.ok(true, "Should have failed to load template");
            });
        });

        it("failure is rased when the template is not in the file, but the file exists", function () {
            return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "foo").then(null, function () {
                assert.ok(true, "Should have failed to load template");
            });
        });

        it("parts are married to their object instance", function () {
            var playground = getPlayground();
            return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "templateWithParts").then(function (template) {
                return template.render(null, playground);
            }).then(function () {
                var instance = {};
                domUtilities.marryPartsToControl(playground, instance);

                assert.ok(instance.content, "Content not found");
                assert.strictEqual(instance.content.innerText, "Test", "Incorrect element");

                assert.ok(instance.otherContent, "Other Content not found");
                assert.strictEqual(instance.otherContent.innerText, "Foo", "Incorrect otherContent element");

                assert.ok(instance.aControl, "No Control found");
                assert.ok(instance.aControl instanceof CodevoidTests.TestControl, "Part was not the control instance");
            });
        });

        it("only the supplied subtree has it's parts married to an object", function () {
            var playground = getPlayground();
            var uberContainer = playground.appendChild(document.createElement("div"));
            var fakePart = document.createElement("div");
            fakePart.setAttribute("data-part", "fakePart");
            uberContainer.appendChild(fakePart);

            var templateContainer = playground.appendChild(document.createElement("div"));
            return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "templateWithParts").then(function (template) {
                return template.render(null, templateContainer);
            }).then(function () {
                var instance = {};
                domUtilities.marryPartsToControl(templateContainer, instance);

                assert.ok(!instance.fakePart, "Didn't expect to find fake part");

                assert.ok(instance.content, "Content not found");
                assert.strictEqual(instance.content.innerText, "Test", "Incorrect element");

                assert.ok(instance.otherContent, "Other Content not found");
                assert.strictEqual(instance.otherContent.innerText, "Foo", "Incorrect otherContent element");

                assert.ok(instance.aControl, "No Control found");
                assert.ok(instance.aControl instanceof CodevoidTests.TestControl, "Part was not the control instance");
            });
        });

        it("declarative events are attached", function () {
            var playground = getPlayground();

            // Make sure there is an event on the root node
            playground.setAttribute("data-event", "{ customRoot: handleCustomRoot }");

            return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "templateWithEvents").then(function (t) {
                return t.render(null, playground);
            }).then(function () {
                var customCalled = false;
                var custom2Called = false;
                var customRootCalled = false;

                var parts = {};
                var instance = {
                    hasFlag: true,
                    handleCustom: msfp(function (e) {
                        if (e && this.hasFlag) {
                            customCalled = true;
                        }
                    }),
                    handleCustom2: msfp(function (e) {
                        if (e && this.hasFlag) {
                            custom2Called = true;
                        }
                    }),
                    handleCustomRoot: msfp(function (e) {
                        if (e && this.hasFlag) {
                            customRootCalled = true;
                        }
                    }),
                };

                domUtilities.marryEventsToHandlers(playground, instance);
                domUtilities.marryPartsToControl(playground, parts);

                var customEvent = document.createEvent("Event");
                customEvent.initEvent("custom", true, true);

                parts.parent.dispatchEvent(customEvent);

                assert.ok(customCalled, "Custom handler wasn't called");

                var custom2Event = document.createEvent("Event");
                custom2Event.initEvent("custom2", true, true);

                parts.child.dispatchEvent(custom2Event);

                assert.ok(custom2Called, "Custom2 handler wasn't called");

                var customRootEvent = document.createEvent("Event");
                customRootEvent.initEvent("customRoot", true, true);
                playground.dispatchEvent(customRootEvent);

                assert.ok(customRootCalled, "Custom root handler wasn't called");
            });
        });

        it("marrying events on a tree that has no event attributes doesn't raise an error", function () {
            var playground = getPlayground();
            var newElement = document.createElement("div");
            playground.appendChild(newElement);

            domUtilities.marryEventsToHandlers(playground);
        });

        it("multiple events can be attached with one attribute", function () {
            var playground = getPlayground();
            var newElement = document.createElement("div");
            newElement.setAttribute("data-event", "{ custom: handleCustom, custom2: handleCustom2 }");
            playground.appendChild(newElement);

            var customCalled = false;
            var custom2Called = false;

            var instance = {
                hasFlag: true,
                handleCustom: msfp(function (e) {
                    if (e && this.hasFlag) {
                        customCalled = true;
                    }
                }),
                handleCustom2: msfp(function (e) {
                    if (e && this.hasFlag) {
                        custom2Called = true;
                    }
                }),
                handleCustomRoot: msfp(function (e) {
                    if (e && this.hasFlag) {
                        customRootCalled = true;
                    }
                }),
            };

            domUtilities.marryEventsToHandlers(playground, instance);

            var customEvent = document.createEvent("Event");
            customEvent.initEvent("custom", true, true);

            newElement.dispatchEvent(customEvent);

            assert.ok(customCalled, "Custom handler wasn't called");

            var custom2Event = document.createEvent("Event");
            custom2Event.initEvent("custom2", true, true);

            newElement.dispatchEvent(custom2Event);

            assert.ok(custom2Called, "Custom2 handler wasn't called");
        });

        it("event attributes that don't specify a handler raise an exception", function () {
            var playground = getPlayground();
            var newElement = document.createElement("div");
            newElement.setAttribute("data-event", "{ custom: handleCustom }");
            playground.appendChild(newElement);

            var instance = {};
            var exceptionWasThrown = false;
            try
            {
                domUtilities.marryEventsToHandlers(playground, instance);
            }
            catch(e)
            {
                exceptionWasThrown = true;
            }

            // Raise the event in case we attach it, and do something horribly wrong
            var customEvent = document.createEvent("Event");
            customEvent.initEvent("custom", true, true);

            newElement.dispatchEvent(customEvent);

            assert.ok(exceptionWasThrown, "Married events to handlers when handler was missing");
        });

        it("when marrying, the returned object is a cancellable object", function () {
            var playground = getPlayground();
            var newElement = document.createElement("div");
            newElement.setAttribute("data-event", "{ custom: handleCustom }");
            playground.appendChild(newElement);

            var instance = { handleCustom: WinJS.Utilities.markSupportedForProcessing(function () { }) };

            var cancellable = domUtilities.marryEventsToHandlers(playground, instance);

            assert.ok(cancellable, "Didn't get an event cancellation object");
            assert.ok(cancellable.cancel, "Cancellation object didn't have a cancel on it");

            // Make sure calling cancel in this state
            cancellable.cancel();
        });

        it("using the cancellable actually cancels the event handlers", function () {
            var playground = getPlayground();
            var newElement = document.createElement("div");
            newElement.setAttribute("data-event", "{ custom: handleCustom }");
            playground.appendChild(newElement);

            var customCalled = false;
            var instance = {
                hasFlag: true,
                handleCustom: msfp(function (e) {
                    if (e && this.hasFlag) {
                        customCalled = true;
                    }
                }),
            };

            var cancellable = domUtilities.marryEventsToHandlers(playground, instance);

            assert.ok(cancellable, "Didn't get an event cancellation object");
            assert.ok(cancellable.cancel, "Cancellation object didn't have a cancel on it");

            // Make sure calling cancel in this state
            cancellable.cancel();

            var customEvent = document.createEvent("Event");
            customEvent.initEvent("custom", true, true);

            newElement.dispatchEvent(customEvent);

            assert.ok(!customCalled, "Didn't expect custom handler to be called after detaching them");
        });
    });

    describe("Utilities Debouncer", function () {

        it("can't construct without an operation or timeout", () => {
            let failed = false;
            try {
                let constructed = new Codevoid.Utilities.Debounce(null, null);
            } catch (e) {
                failed = true;
            }

            assert.ok(failed, "Didn't get failure constructoring object without parameters");
        });

        it("can't construct without an operation, but with a timeout", () => {
            let failed = false;
            try {
                let constructed = new Codevoid.Utilities.Debounce(null, 1);
            } catch (e) {
                failed = true;
            }

            assert.ok(failed, "Didn't get failure constructoring object without operation");
        });

        it("can't construct without a timeout, but with an operation", () => {
            let failed = false;
            try {
                let constructed = new Codevoid.Utilities.Debounce(() => { }, 0);
            } catch (e) {
                failed = true;
            }

            assert.ok(failed, "Didn't get failure constructoring object without timeout");
        });

        it("operation isn't executed if never bounced", () => {
            let completeCallback = null;
            let wasCalled = false;
            let completionPromise = new WinJS.Promise(function (c, e, p) {
                completeCallback = () => {
                    wasCalled = true;
                    c();
                }
            });

            let bouncer = new Codevoid.Utilities.Debounce(() => {
                completeCallback();
            }, 1);

            return WinJS.Promise.any([
                WinJS.Promise.timeout(10),
                completionPromise
            ]).then((results) => {
                assert.ok(!wasCalled, "Did not expect completion handler to be called");
            });
        });

        it("bouncing ones executes operation", () => {
            let completeCallback = null;
            let wasCalled = false;
            let completionPromise = new WinJS.Promise(function (c, e, p) {
                completeCallback = () => {
                    wasCalled = true;
                    c();
                }
            });

            let bouncer = new Codevoid.Utilities.Debounce(() => {
                completeCallback();
            }, 1);

            bouncer.bounce();

            return WinJS.Promise.any([
                WinJS.Promise.timeout(100),
                completionPromise
            ]).then((results) => {
                assert.ok(wasCalled, "Did not expect completion handler to be called");
                assert.strictEqual(results.key, "1", "Wrong promise completed");
            });
        });

        it("operation is delay after multiple bounces within the timeout", () => {
            let end = -1;
            let completeCallback = null;
            let wasCalled = false;
            let completionPromise = new WinJS.Promise(function (c, e, p) {
                completeCallback = () => {
                    end = Date.now() - start;
                    wasCalled = true;
                    c();
                }
            });


            let bouncer = new Codevoid.Utilities.Debounce(() => {
                completeCallback();
            }, 20);

            const resetBounce = () => bouncer.bounce();

            const start = Date.now();
            resetBounce(); // Start it
            setTimeout(resetBounce, 15); // Bounce to 35ms
            setTimeout(resetBounce, 30); // Bounce to 50ms
            setTimeout(resetBounce, 45); // Bounce to 65ms

            return WinJS.Promise.join([
                WinJS.Promise.timeout(20),
                completionPromise
            ]).then((results) => {
                assert.ok(wasCalled, "Did not expect completion handler to be called");
                assert.ok(end > 30, `Operation was not debounced quickly. Took ${end}ms`);
                assert.ok(end < 100, `Operation took too long to debounce. Took ${end}ms`);
            });
        });

        it("bouncing after operation is executed does not execute the bounce a gain", () => {
            let completionCount = 0;
            let completeCallback = null;
            let wasCalled = false;
            let completionPromise = new WinJS.Promise(function (c, e, p) {
                completeCallback = () => {
                    completionCount += 1;
                    wasCalled = true;
                    c();
                }
            });


            let bouncer = new Codevoid.Utilities.Debounce(() => {
                completeCallback();
            }, 1, true /*completeOnlyOnce*/);

            bouncer.bounce();
            setTimeout(() => { bouncer.bounce() }, 10)

            return WinJS.Promise.join([
                WinJS.Promise.timeout(30),
                completionPromise
            ]).then((results) => {
                assert.strictEqual(completionCount, 1, "Bounce Completed more than once");
            });
        });

        it("operation is executed when multiple-bouncing is enabled, and bounced after first operation", () => {
            let completionCount = 0;
            let completeCallback = null;
            let wasCalled = false;
            let completionPromise = new WinJS.Promise(function (c, e, p) {
                completeCallback = () => {
                    completionCount += 1;
                    wasCalled = true;
                    c();
                }
            });


            let bouncer = new Codevoid.Utilities.Debounce(() => {
                completeCallback();
            }, 1);

            bouncer.bounce();
            setTimeout(() => { bouncer.bounce() }, 10)

            return WinJS.Promise.join([
                WinJS.Promise.timeout(30),
                completionPromise
            ]).then((results) => {
                assert.strictEqual(completionCount, 2, "Bounce Completed more than once");
            });
        });

    });
})();