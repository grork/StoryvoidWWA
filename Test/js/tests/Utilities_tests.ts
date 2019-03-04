namespace CodevoidTests {
    "use strict";
    import Signal = Codevoid.Utilities.Signal;
    import getPlayground = InstapaperTestUtilities.getPlayground;
    import domUtilities = Codevoid.Utilities.DOM;
    let customUnloadingControlId = 0;
    const msfp = WinJS.Utilities.markSupportedForProcessing;

    export class TestControl {
        public disposed: boolean = false;

        constructor(public domElement: HTMLElement) { }

        public dispose(): void {
            this.disposed = true;
        }

        public static getElementForControl(): HTMLElement {
            const element = document.createElement("div");
            element.setAttribute("data-win-control", "CodevoidTests.TestControl");

            return element;
        }
    }

    msfp(TestControl);
    msfp(TestControl.prototype.dispose);

    export class CustomUnloadingControl {
        public uid: number = 0;
        public disposed: boolean = false;
        constructor(public domElement: HTMLElement) {
            this.uid = customUnloadingControlId++;
        }

        public dispose(): void {
            this.disposed = true;
            if (!CustomUnloadingControl.unloadedOrder) {
                CustomUnloadingControl.unloadedOrder = [];
            }

            CustomUnloadingControl.unloadedOrder.push(this.uid);
        }

        public static unloadedOrder: number[] = [];
        public static loadedOrder: number[] = [];

        public static getElementForControl(): HTMLElement {
            let element = document.createElement("div");
            element.setAttribute("data-win-control", "CodevoidTests.CustomUnloadingControl");

            return element;
        }
    }

    msfp(CustomUnloadingControl);
    msfp(CustomUnloadingControl.prototype.dispose);

    export class UnitTestView { };

    describe("Utilities Signal", () => {
        it("can be constructed", () => {
            const signal = new Signal();
            assert.ok(signal, "Didn't get a valid signal");
            assert.ok(WinJS.Promise.is(signal.promise), "Signal didn't have a valid promise on it");
        });

        it("can be explicitly cancelled", () => {
            const signal = new Signal();
            const p = signal.promise.then(() => {
                assert.ok(false, "Promise was not cancelled");
            }, (e) => {
                assert.strictEqual(e.name, "Canceled", "Promise wasn't cancelled");
            });

            signal.cancel();

            return p;
        });

        it("can be completed", () => {
            const signal = new Signal();
            let completed = false;
            signal.promise.then(() => completed = true);

            signal.complete();

            assert.ok(completed, "Signal didn't complete");
        });

        it("includes value when completed", () => {
            const signal = new Signal();
            let completed = false;
            signal.promise.then((data) => {
                assert.ok(data, "didn't get data");
                assert.ok(data.isComplete, "Should have had complete property");
            });

            signal.complete({ isComplete: true });
        });

        it("can't be completed more than once", () => {
            const signal = new Signal();
            let completed = 0;
            signal.promise.then(() => completed++);

            signal.complete();

            try {
                signal.complete();
            } catch (e) {
            }

            assert.strictEqual(completed, 1, "Shouldn't complete more than once");
        });

        it("signal throws when completeing a second time", () => {
            const signal = new Signal();

            signal.complete();

            try {
                signal.complete();
            } catch (e) {
                assert.ok(true, "Got exception!");
            }
        });

        it("calling error propagates to the promise", () => {
            const signal = new Signal();
            let errorCalled = false;
            signal.promise.then(() => assert.ok(false, "shouldn't be called"), () => errorCalled = true);

            signal.error();

            assert.ok(errorCalled, "Error wasn't called");
        });

        it("error info is supplied to the promise error handler", () => {
            const signal = new Signal();
            let errorCalled = false;
            signal.promise.then(() => assert.ok(false, "shouldn't be called"), (errorInfo) => {
                errorCalled = true;
                assert.ok(errorInfo, "no error info");
                assert.ok(errorInfo.errorDetail, "No error details");
            });

            signal.error({ errorDetail: "detail" });

            assert.ok(errorCalled, "Error wasn't called");
        });

        it("progress is passed to the promise", () => {
            const signal = new Signal();
            let progress = 0;
            signal.promise.then(
                () => assert.ok(false, "complete shouldn't be called"),
                () => assert.ok(false, "Error shouldn't be called"),
                () => {
                    progress++;
                }
            );

            signal.progress();
            signal.progress();

            assert.strictEqual(progress, 2, "expected progress to be called twice");
        });

        it("data is supplied to the promise when progress is reported", () => {
            let item1 = { data: "item1" };
            let item2 = { data: "item2" };

            const signal = new Signal();
            let progress = [];
            signal.promise.then(
                () => assert.ok(false, "complete shouldn't be called"),
                () => assert.ok(false, "Error shouldn't be called"),
                (data) => progress.push(data)
            );

            signal.progress(item1);
            signal.progress(item2);

            assert.strictEqual(progress.length, 2, "expected progress to be called twice");
            assert.strictEqual(progress[0], item1, "First item wasn't correct");
            assert.strictEqual(progress[1], item2, "second item wasn't correct");
        });
    });

    describe("Utilities Serialize promise execution", () => {
        it("all promises are executed", () => {
            let promisesCompleted = 0;
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

            return Codevoid.Utilities.serialize(data, () => {
                promisesCompleted++;
                return WinJS.Promise.timeout();
            }).then(() => assert.strictEqual(promisesCompleted, 10));
        });

        it("doesn't run out of stack space with lots of items to process", function (this: Mocha.Context) {
            this.timeout(60000);
            let promisesCompleted = 0;
            const data = [];
            for (let i = 0; i < 10000; i++) {
                data.push(i);
            }

            return Codevoid.Utilities.serialize(data, () => {
                promisesCompleted++;
                return WinJS.Promise.timeout();
            }).then(() => assert.strictEqual(promisesCompleted, data.length));
        });

        it("the work is performed sequentially", () => {
            let promiseExecuting = false;
            let completedPromises = 0;
            const data = [1, 2, 3, 4, 5, 6, 8, 9, 10];

            return Codevoid.Utilities.serialize(data, () => {
                assert.ok(!promiseExecuting, "A promise was already executing");
                promiseExecuting = true;
                return WinJS.Promise.timeout(10).then(() => {
                    promiseExecuting = false;
                    completedPromises++;
                });
            }).then(() => assert.strictEqual(completedPromises, data.length));
        });

        it("concurrent work respects limit of concurrent items in flight", () => {
            let promiseExecuting = 0;
            let completedPromises = 0;
            const data = [1, 2, 3, 4, 5, 6, 8, 9, 10];

            return Codevoid.Utilities.serialize(data, () => {
                promiseExecuting++;
                assert.ok(promiseExecuting < 3, "Only expected up to to promises")
                return WinJS.Promise.timeout(10).then(() => {
                    promiseExecuting--;
                    completedPromises++;
                });
            }, 2).then(() => {
                assert.strictEqual(promiseExecuting, 0, "All promises should be complete");
                assert.strictEqual(completedPromises, data.length);
            });
        });

        it("all work is processed even if one promise fails", () => {
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

            return Codevoid.Utilities.serialize(data, (item: number) => {
                if (item === 5) {
                    throw "Failure!";
                }

                return WinJS.Promise.timeout();
            }).then(
                () => assert.ok(false, "Shouldn't succeed"),
                () => assert.ok(true, "should have gotten error")
            );
        });

        it("values are returned as an array when completed", () => {
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

            return Codevoid.Utilities.serialize(data, (item: number) => {
                return WinJS.Promise.timeout().then(() => {
                    return item;
                });
            }).then((values: number[]) => {
                values.forEach((value, index) => assert.strictEqual(value, data[index], "Values & Order didn't match at index: " + index));
            });
        });

        it("can be cancelled", () => {
            let promisesCompleted = 0;
            const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            const cancel = new Codevoid.Utilities.CancellationSource();

            return Codevoid.Utilities.serialize(data, (item: number) => {
                promisesCompleted++;
                if (item === 5) {
                    cancel.cancel();
                    return;
                }

                return WinJS.Promise.timeout();
            }, 0, cancel).then(
                () => assert.ok(false, "shouldn't succeed"),
                () => assert.strictEqual(promisesCompleted, 5)
            );
        });
    });

    describe("Utilities Control Eventing & Property", () => {
        it("Event listener lists can be attached", () => {
            const source = new Codevoid.Utilities.EventSource();
            let eventWasRaised = false;

            Codevoid.Utilities.addEventListeners(source, {
                custom: () => eventWasRaised = true,
            });

            source.dispatchEvent("custom", {});

            assert.ok(eventWasRaised, "No event raised");
        });

        it("Event listeners can attach more than one event", () => {
            let source = new Codevoid.Utilities.EventSource();
            let eventWasRaised = false;
            let event2WasRaised = false;

            Codevoid.Utilities.addEventListeners(source, {
                custom: () => eventWasRaised = true,
                custom2: () => event2WasRaised = true,
            });

            source.dispatchEvent("custom", {});
            source.dispatchEvent("custom2", {});

            assert.ok(eventWasRaised, "No event raised");
            assert.ok(event2WasRaised, "No event raised");
        });

        it("Cancelling returned object adding listers cancels the attached handlers", () => {
            let source = new Codevoid.Utilities.EventSource();
            let eventWasRaised = false;
            let event2WasRaised = false;

            let cancel = Codevoid.Utilities.addEventListeners(source, {
                custom: () => eventWasRaised = true,
                custom2: () => event2WasRaised = true,
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

    describe("Utilities Controls unloading", () => {
        beforeEach(InstapaperTestUtilities.clearPlayground);
        afterEach(InstapaperTestUtilities.clearPlayground);

        it("Disposed controls have their unload method called", () => {
            let playground = getPlayground();

            let controlElement = playground.appendChild(CodevoidTests.TestControl.getElementForControl());

            return WinJS.UI.process(controlElement).then(() => {
                domUtilities.disposeOfControl(controlElement);
                assert.ok(controlElement.winControl.disposed, "Control wasn't disposed");
            });
        });

        it("Unload is called on the entire tree being unloaded", () => {
            let playground = getPlayground();
            let parent = playground.appendChild(CodevoidTests.TestControl.getElementForControl());

            for (let i = 0; i < 5; i++) {
                parent.appendChild(CodevoidTests.TestControl.getElementForControl());
            }

            return WinJS.UI.processAll(playground).then(() => {
                const controls = WinJS.Utilities.query("[data-win-control]", playground);

                domUtilities.disposeOfControlTree(parent);

                controls.forEach((control) => assert.ok(control.winControl.disposed, "Control wasn't disposed"));
            });
        });

        it("Unloading a tree calls from the leaf nodes in", () => {
            let playground = getPlayground();
            let parent = playground.appendChild(CodevoidTests.CustomUnloadingControl.getElementForControl());

            for (let i = 0; i < 5; i++) {
                parent = parent.appendChild(CodevoidTests.CustomUnloadingControl.getElementForControl());
            }

            return WinJS.UI.processAll(playground).then(() => {
                let controls = WinJS.Utilities.query("[data-win-control]", playground);
                domUtilities.disposeOfControlTree(<HTMLElement>playground.firstChild);

                let unloadOrder = CodevoidTests.CustomUnloadingControl.unloadedOrder;
                assert.strictEqual(unloadOrder.length, 6, "Incorrect number of controls");

                for (let i = 1; i < unloadOrder.length; i++) {
                    assert.ok(unloadOrder[i - 1] > unloadOrder[i], "Incorrect unload order detected. Control '" + unloadOrder[i - 1] + "' was not after '" + unloadOrder[i] + "'");
                }

                CodevoidTests.CustomUnloadingControl.unloadedOrder = null;
            });
        });

        it("one unload throwing does not stop all other unloads from being called", () => {
            let playground = getPlayground();

            let controlElement = playground.appendChild(CodevoidTests.TestControl.getElementForControl());
            let failingElement = playground.appendChild(CodevoidTests.TestControl.getElementForControl());
            let controlElement2 = playground.appendChild(CodevoidTests.TestControl.getElementForControl());

            return WinJS.UI.processAll(playground).then(() => {
                failingElement.winControl.dispose = () => { throw new Error() };

                domUtilities.disposeOfControlTree(playground);
                assert.ok(controlElement.winControl.disposed, "Control wasn't disposed");
                assert.ok(controlElement2.winControl.disposed, "Control wasn't disposed");
            });
        });

        it("using the empty helper calls unload", () => {
            let playground = getPlayground();

            let controlElement = playground.appendChild(CodevoidTests.TestControl.getElementForControl());
            let controlElement2 = playground.appendChild(CodevoidTests.TestControl.getElementForControl());

            return WinJS.UI.processAll(playground).then(() => {
                domUtilities.empty(playground);
                assert.ok(controlElement.winControl.disposed, "Control wasn't disposed");
                assert.ok(controlElement2.winControl.disposed, "Control wasn't disposed");
            });
        });

        it("remove child helper calls unload", () => {
            let playground = getPlayground();
            let parent = playground.appendChild(document.createElement("div"));

            let controlElement = parent.appendChild(CodevoidTests.TestControl.getElementForControl());
            let controlElement2 = parent.appendChild(CodevoidTests.TestControl.getElementForControl());

            return WinJS.UI.processAll(playground).then(() => {
                domUtilities.removeChild(playground, parent);

                assert.ok(controlElement.winControl.disposed, "Control wasn't disposed");
                assert.ok(controlElement2.winControl.disposed, "Control wasn't disposed");
            });
        });
    });

    describe("Utilities Control Templates", () => {
        beforeEach(InstapaperTestUtilities.clearPlayground);
        afterEach(InstapaperTestUtilities.clearPlayground);

        it("can be loaded", () => {
            return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "testTemplate").then((template) => {
                assert.ok(template, "Template Loaded!");
                domUtilities.clearTemplateCaches();
            });
        });

        it("a template is actually returned", () => {
            return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "testTemplate").then((template) => {
                assert.ok(template, "Template Loaded!");
                assert.ok(template instanceof WinJS.Binding.Template, "Template isn't a WinJS.Binding.Template");
                domUtilities.clearTemplateCaches();
            });
        });

        it("failure is raised when the file containing the template doesn't exist", () => {
            return domUtilities.loadTemplate("/foo.html", "testTemplate").then(null, () => assert.ok(true, "Should have failed to load template"));
        });

        it("failure is rased when the template is not in the file, but the file exists", () => {
            return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "foo").then(null, () => assert.ok(true, "Should have failed to load template"));
        });

        it("parts are married to their object instance", () => {
            const playground = getPlayground();
            return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "templateWithParts").then(
                (template) => template.render(null, playground)
            ).then(() => {
                const instance: any = {};
                domUtilities.marryPartsToControl(playground, instance);

                assert.ok(instance.content, "Content not found");
                assert.strictEqual(instance.content.innerText, "Test", "Incorrect element");

                assert.ok(instance.otherContent, "Other Content not found");
                assert.strictEqual(instance.otherContent.innerText, "Foo", "Incorrect otherContent element");

                assert.ok(instance.aControl, "No Control found");
                assert.ok(instance.aControl instanceof CodevoidTests.TestControl, "Part was not the control instance");
            });
        });

        it("only the supplied subtree has it's parts married to an object", () => {
            const playground = getPlayground();
            const uberContainer = playground.appendChild(document.createElement("div"));
            const fakePart = document.createElement("div");
            fakePart.setAttribute("data-part", "fakePart");
            uberContainer.appendChild(fakePart);

            const templateContainer = playground.appendChild(document.createElement("div"));
            return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "templateWithParts").then(
                (template) => template.render(null, templateContainer)
            ).then(() => {
                const instance: any = {};
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

        it("declarative events are attached", () => {
            const playground = getPlayground();

            // Make sure there is an event on the root node
            playground.setAttribute("data-event", "{ customRoot: handleCustomRoot }");

            return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "templateWithEvents").then((t) => t.render(null, playground)).then(
                () => {
                    let customCalled = false;
                    let custom2Called = false;
                    let customRootCalled = false;

                    const parts: any = {};
                    const instance = {
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

                    const customEvent = document.createEvent("Event");
                    customEvent.initEvent("custom", true, true);
                    parts.parent.dispatchEvent(customEvent);

                    assert.ok(customCalled, "Custom handler wasn't called");

                    const custom2Event = document.createEvent("Event");
                    custom2Event.initEvent("custom2", true, true);
                    parts.child.dispatchEvent(custom2Event);

                    assert.ok(custom2Called, "Custom2 handler wasn't called");

                    const customRootEvent = document.createEvent("Event");
                    customRootEvent.initEvent("customRoot", true, true);
                    playground.dispatchEvent(customRootEvent);

                    assert.ok(customRootCalled, "Custom root handler wasn't called");
                });
        });

        it("marrying events on a tree that has no event attributes doesn't raise an error", () => {
            const playground = getPlayground();
            const newElement = document.createElement("div");
            playground.appendChild(newElement);

            domUtilities.marryEventsToHandlers(playground, {});
        });

        it("multiple events can be attached with one attribute", () => {
            const playground = getPlayground();
            const newElement = document.createElement("div");
            newElement.setAttribute("data-event", "{ custom: handleCustom, custom2: handleCustom2 }");
            playground.appendChild(newElement);

            let customCalled = false;
            let custom2Called = false;
            let customRootCalled = false;

            let instance = {
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

            const customEvent = document.createEvent("Event");
            customEvent.initEvent("custom", true, true);
            newElement.dispatchEvent(customEvent);

            assert.ok(customCalled, "Custom handler wasn't called");

            const custom2Event = document.createEvent("Event");
            custom2Event.initEvent("custom2", true, true);
            newElement.dispatchEvent(custom2Event);

            assert.ok(custom2Called, "Custom2 handler wasn't called");
        });

        it("event attributes that don't specify a handler raise an exception", () => {
            const playground = getPlayground();
            const newElement = document.createElement("div");
            newElement.setAttribute("data-event", "{ custom: handleCustom }");
            playground.appendChild(newElement);

            const instance = {};
            let exceptionWasThrown = false;
            try
            {
                domUtilities.marryEventsToHandlers(playground, instance);
            }
            catch(e)
            {
                exceptionWasThrown = true;
            }

            // Raise the event in case we attach it, and do something horribly wrong
            let customEvent = document.createEvent("Event");
            customEvent.initEvent("custom", true, true);
            newElement.dispatchEvent(customEvent);

            assert.ok(exceptionWasThrown, "Married events to handlers when handler was missing");
        });

        it("when marrying, the returned object is a cancellable object", () => {
            const playground = getPlayground();
            const newElement = document.createElement("div");
            newElement.setAttribute("data-event", "{ custom: handleCustom }");
            playground.appendChild(newElement);

            const instance = { handleCustom: WinJS.Utilities.markSupportedForProcessing(() => { }) };
            const cancellable = domUtilities.marryEventsToHandlers(playground, instance);

            assert.ok(cancellable, "Didn't get an event cancellation object");
            assert.ok(cancellable.cancel, "Cancellation object didn't have a cancel on it");

            // Make sure calling cancel in this state
            cancellable.cancel();
        });

        it("using the cancellable actually cancels the event handlers", () => {
            const playground = getPlayground();
            const newElement = document.createElement("div");
            newElement.setAttribute("data-event", "{ custom: handleCustom }");
            playground.appendChild(newElement);

            let customCalled = false;
            const instance = {
                hasFlag: true,
                handleCustom: msfp(function (e) {
                    if (e && this.hasFlag) {
                        customCalled = true;
                    }
                }),
            };
            const cancellable = domUtilities.marryEventsToHandlers(playground, instance);

            assert.ok(cancellable, "Didn't get an event cancellation object");
            assert.ok(cancellable.cancel, "Cancellation object didn't have a cancel on it");

            // Make sure calling cancel in this state
            cancellable.cancel();

            const customEvent = document.createEvent("Event");
            customEvent.initEvent("custom", true, true);
            newElement.dispatchEvent(customEvent);

            assert.ok(!customCalled, "Didn't expect custom handler to be called after detaching them");
        });
    });

    describe("Utilities Debouncer", () => {

        it("can't construct without an operation or timeout", () => {
            let failed = false;
            try {
                const constructed = new Codevoid.Utilities.Debounce(null, null);
            } catch (e) {
                failed = true;
            }

            assert.ok(failed, "Didn't get failure constructoring object without parameters");
        });

        it("can't construct without an operation, but with a timeout", () => {
            let failed = false;
            try {
                const constructed = new Codevoid.Utilities.Debounce(null, 1);
            } catch (e) {
                failed = true;
            }

            assert.ok(failed, "Didn't get failure constructoring object without operation");
        });

        it("can't construct without a timeout, but with an operation", () => {
            let failed = false;
            try {
                const constructed = new Codevoid.Utilities.Debounce(() => { }, 0);
            } catch (e) {
                failed = true;
            }

            assert.ok(failed, "Didn't get failure constructoring object without timeout");
        });

        it("operation isn't executed if never bounced", () => {
            let completeCallback = null;
            let wasCalled = false;
            const completionPromise = new WinJS.Promise((c, e, p) => {
                completeCallback = () => {
                    wasCalled = true;
                    c();
                }
            });

            const bouncer = new Codevoid.Utilities.Debounce(() => completeCallback(), 1);

            return WinJS.Promise.any([
                WinJS.Promise.timeout(10),
                completionPromise
            ]).then((results) => assert.ok(!wasCalled, "Did not expect completion handler to be called"));
        });

        it("bouncing once executes operation", () => {
            let completeCallback = null;
            let wasCalled = false;
            const completionPromise = new WinJS.Promise((c, e, p) => {
                completeCallback = () => {
                    wasCalled = true;
                    c();
                }
            });

            const bouncer = new Codevoid.Utilities.Debounce(() => completeCallback(), 1);

            bouncer.bounce();

            return WinJS.Promise.any([
                WinJS.Promise.timeout(100),
                completionPromise
            ]).then((results) => {
                assert.ok(wasCalled, "Expected completion handler to be called");
                assert.strictEqual(results.key, "1", "Wrong promise completed");
            });
        });

        it("operation is delay after multiple bounces within the timeout", () => {
            let end = -1;
            let completeCallback = null;
            let wasCalled = false;
            const completionPromise = new WinJS.Promise((c, e, p) => {
                completeCallback = () => {
                    end = Date.now() - start;
                    wasCalled = true;
                    c();
                }
            });
            const bouncer = new Codevoid.Utilities.Debounce(() => completeCallback(), 20);
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
                assert.ok(wasCalled, "Expected completion handler to be called");
                assert.ok(end > 30, `Operation was not debounced quickly. Took ${end}ms`);
                assert.ok(end < 100, `Operation took too long to debounce. Took ${end}ms`);
            });
        });

        it("bouncing after operation is executed does not execute the bounce again", () => {
            let completionCount = 0;
            let completeCallback = null;
            let wasCalled = false;
            const completionPromise = new WinJS.Promise((c, e, p) => {
                completeCallback = () => {
                    completionCount += 1;
                    wasCalled = true;
                    c();
                }
            });
            const bouncer = new Codevoid.Utilities.Debounce(() => {
                completeCallback();
            }, 1, true /*completeOnlyOnce*/);

            bouncer.bounce();
            setTimeout(() => bouncer.bounce(), 10)

            return WinJS.Promise.join([
                WinJS.Promise.timeout(30),
                completionPromise
            ]).then((results) => assert.strictEqual(completionCount, 1, "Bounce Completed more than once"));
        });

        it("operation is executed when multiple-bouncing is enabled, and bounced after first operation", () => {
            let completionCount = 0;
            let completeCallback = null;
            let wasCalled = false;
            let completionPromise = new WinJS.Promise((c, e, p) => {
                completeCallback = () => {
                    completionCount += 1;
                    wasCalled = true;
                    c();
                }
            });
            let bouncer = new Codevoid.Utilities.Debounce(() => completeCallback(), 1);

            bouncer.bounce();
            setTimeout(() => bouncer.bounce(), 10)

            return WinJS.Promise.join([
                WinJS.Promise.timeout(30),
                completionPromise
            ]).then((results) => assert.strictEqual(completionCount, 2, "Bounce Completed more than once"));
        });

        it("triggering bounce bounce interval completes operation immediately", () => {
            let completeCallback = null;
            let wasCalled = false;
            const completionPromise = new WinJS.Promise((c, e, p) => {
                completeCallback = () => {
                    wasCalled = true;
                    c();
                }
            });

            const bouncer = new Codevoid.Utilities.Debounce(() => completeCallback(), 200);
            bouncer.bounce();

            setTimeout(() => {
                bouncer.triggerNow();
            }, 50);

            return WinJS.Promise.any([
                WinJS.Promise.timeout(100),
                completionPromise
            ]).then((results) => {
                assert.ok(wasCalled, "Expected completion handler to be called");
                assert.strictEqual(results.key, "1", "Wrong promise completed");
            });
        });
    });
}