(function () {
    "use strict";
    var Signal = Codevoid.Utilities.Signal;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;
    var domUtilities = Codevoid.Utilities.DOM;
    var customUnloadingControlId = 0;

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
        CustomUnloadingControl: WinJS.Class.define(function(element) {
            this.domElement = element;
            this.uid = customUnloadingControlId++;
        }, {
            element: null,
            disposed: false,
            dispose: function() {
                if(!CodevoidTests.CustomUnloadingControl.unloadedOrder) {
                    CodevoidTests.CustomUnloadingControl.unloadedOrder = [];
                }

                CodevoidTests.CustomUnloadingControl.unloadedOrder.push(this.uid);
            },
        }, {
            getElementForControl: function() {
                var element = document.createElement("div");
                element.setAttribute("data-win-control", "CodevoidTests.CustomUnloadingControl");

                return element;
            },
            unloadedOrder: null,
            loadOrder: null,
        }),
        UnitTestView: WinJS.Class.define(function() {
        }),
        EventSource: WinJS.Class.mix(WinJS.Class.define(function() {}), WinJS.Utilities.eventMixin),
    });

    QUnit.module("utilitiesSignal");

    function canConstructSignal() {
        var signal = new Signal();
        QUnit.assert.ok(signal, "Didn't get a valid signal");
        QUnit.assert.ok(WinJS.Promise.is(signal.promise), "Signal didn't have a valid promise on it");
    }

    function signalCanBeCancelled() {
        var signal = new Signal();
        var wasCancelled = false;
        signal.addEventListener("cancelled", function () {
            wasCancelled = true;
        });

        signal.promise.cancel();

        QUnit.assert.ok(wasCancelled, "Promise wasn't cancelled");
    }

    function cancelledSignalHasOriginalSignalInEvent() {
        var signal = new Signal();
        var wasCancelled = false;
        signal.addEventListener("cancelled", function (e) {
            QUnit.assert.strictEqual(signal, e.detail.signal);
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

        QUnit.assert.ok(completed, "Signal didn't complete");
    }

    function signalCompletesWithValue() {
        var signal = new Signal();
        var completed = false;
        signal.promise.done(function (data) {
            QUnit.assert.ok(data, "didn't get data");
            QUnit.assert.ok(data.isComplete, "Should have had complete property");
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

        QUnit.assert.strictEqual(completed, 1, "Shouldn't complete more than once");

    }

    function signalThrowsWhenCompletingTwice() {
        var signal = new Signal();

        signal.complete();
        
        try {
            signal.complete();
        } catch(e) {
            QUnit.assert.ok(true, "Got exception!");
        }
    }

    function errorRaisedOnPromise() {
        var signal = new Signal();
        var errorCalled = false;
        signal.promise.done(function () {
            QUnit.assert.ok(false, "shouldn't be called");
        }, function () {
            errorCalled = true;
        });

        signal.error();

        QUnit.assert.ok(errorCalled, "Error wasn't called");
    }

    function errorRaisedOnPromiseWithErrorInfo() {
        var signal = new Signal();
        var errorCalled = false;
        signal.promise.done(function () {
            QUnit.assert.ok(false, "shouldn't be called");
        }, function (errorInfo) {
            errorCalled = true;
            QUnit.assert.ok(errorInfo, "no error info");
            QUnit.assert.ok(errorInfo.errorDetail, "No error details");
        });

        signal.error({ errorDetail: "detail" });

        QUnit.assert.ok(errorCalled, "Error wasn't called");
    }

    function progressReported() {
        var signal = new Signal();
        var progress = 0;
        signal.promise.done(function () {
            QUnit.assert.ok(false, "complete shouldn't be called");
        }, function () {
            QUnit.assert.ok(false, "Error shouldn't be called");
        }, function () {
            progress++;
        });

        signal.progress();
        signal.progress();

        QUnit.assert.strictEqual(progress, 2, "expected progress to be called twice");
    }

    function progressReportedWithData() {
        var item1 = { data: "item1" };
        var item2 = { data: "item2" };

        var signal = new Signal();
        var progress = [];
        signal.promise.done(function () {
            QUnit.assert.ok(false, "complete shouldn't be called");
        }, function () {
            QUnit.assert.ok(false, "Error shouldn't be called");
        }, function (data) {
            progress.push(data);
        });

        signal.progress(item1);
        signal.progress(item2);

        QUnit.assert.strictEqual(progress.length, 2, "expected progress to be called twice");
        QUnit.assert.strictEqual(progress[0], item1, "First item wasn't correct");
        QUnit.assert.strictEqual(progress[1], item2, "second item wasn't correct");
    }

    QUnit.test("canConstructSignal", canConstructSignal);
    QUnit.test("signalCanBeCancelled", signalCanBeCancelled);
    QUnit.test("cancelledSignalHasOriginalSignalInEvent", cancelledSignalHasOriginalSignalInEvent);
    QUnit.test("signalCanComplete", signalCanComplete);
    QUnit.test("signalCompletesWithValue", signalCompletesWithValue);
    QUnit.test("signalCantCompleteMoreThanOnce", signalCantCompleteMoreThanOnce);
    QUnit.test("signalThrowsWhenCompletingTwice", signalThrowsWhenCompletingTwice);
    QUnit.test("errorRaisedOnPromise", errorRaisedOnPromise);
    QUnit.test("errorRaisedOnPromiseWithErrorInfo", errorRaisedOnPromiseWithErrorInfo);
    QUnit.test("progressReported", progressReported);
    QUnit.test("progressReportedWithData", progressReportedWithData);

    QUnit.module("UtilitiesPromiseSerializer");

    promiseTest("handlerAppliedToAllPromises", function () {
        var promisesCompleted = 0;
        var data = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ];
        
        var doWork = function doWork(item) {
            promisesCompleted++;
            return WinJS.Promise.timeout();
        };


        return Codevoid.Utilities.serialize(data, doWork).then(function () {
            QUnit.assert.strictEqual(promisesCompleted, 10);
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
            QUnit.assert.strictEqual(promisesCompleted, data.length);
        });
    });

    promiseTest("workIsPerformedInSerial", function () {
        var promiseExecuting = false;
        var completedPromises = 0;
        var data = [1, 2, 3, 4, 5, 6, 8, 9, 10];
        var doWork = function () {
            QUnit.assert.ok(!promiseExecuting, "A promise was already executing");
            promiseExecuting = true;
            return WinJS.Promise.timeout(10).then(function () {
                promiseExecuting = false;
                completedPromises++;
            });
        };

        return Codevoid.Utilities.serialize(data, doWork).then(function () {
            QUnit.assert.strictEqual(completedPromises, data.length);
        });
    });

    promiseTest("workIsPerformedUnderWorkLimit", function () {
        var promiseExecuting = 0;
        var completedPromises = 0;
        var data = [1, 2, 3, 4, 5, 6, 8, 9, 10];

        var doWork = function () {
            promiseExecuting++;
            QUnit.assert.ok(promiseExecuting < 3, "Only expected up to to promises")
            return WinJS.Promise.timeout(10).then(function () {
                promiseExecuting--;
                completedPromises++;
            });
        };

        return Codevoid.Utilities.serialize(data, doWork, 2).then(function () {
            QUnit.assert.strictEqual(promiseExecuting, 0, "All promises should be complete");
            QUnit.assert.strictEqual(completedPromises, data.length);
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
            QUnit.assert.ok(false, "Shouldn't succeed");
        }, function () {
            QUnit.assert.ok(true, "should have gotten error");
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
                QUnit.assert.strictEqual(value, data[index], "Values & Order didn't match at index: " + index);
            });
        });
    });

    promiseTest("canCancelSerializer", () => {
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
            QUnit.assert.ok(false, "shouldn't succeed");
        }, function () {
            QUnit.assert.strictEqual(promisesCompleted, 5);
        });
    });

    QUnit.module("utilitiesControlUnload");
    
    promiseTest("disposingOfControlCallsUnload", function () {
        var playground = getPlayground();

        var controlElement = playground.appendChild(CodevoidTests.TestControl.getElementForControl());

        return WinJS.UI.process(controlElement).then(function () {
            domUtilities.disposeOfControl(controlElement);
            QUnit.assert.ok(controlElement.winControl.disposed, "Control wasn't disposed");
        });
    });

    promiseTest("disposingOfTreeOfControlsCallsUnloadOnAll", function () {
        var playground = getPlayground();
        var parent = playground.appendChild(CodevoidTests.TestControl.getElementForControl());

        for (var i = 0; i < 5; i++) {
            parent.appendChild(CodevoidTests.TestControl.getElementForControl());
        }

        return WinJS.UI.processAll(playground).then(function () {
            var controls = WinJS.Utilities.query("[data-win-control]", playground);

            domUtilities.disposeOfControlTree(parent);

            controls.forEach(function (control) {
                QUnit.assert.ok(control.winControl.disposed, "Control wasn't disposed");
            });
        });
    });

    promiseTest("disposingOfTreeOfControlsIsBottomUp", function () {
        var playground = getPlayground();
        var parent = playground.appendChild(CodevoidTests.CustomUnloadingControl.getElementForControl());

        for (var i = 0; i < 5; i++) {
            parent = parent.appendChild(CodevoidTests.CustomUnloadingControl.getElementForControl());
        }

        return WinJS.UI.processAll(playground).then(function () {
            var controls = WinJS.Utilities.query("[data-win-control]", playground);


            domUtilities.disposeOfControlTree(playground.firstChild);

            var unloadOrder = CodevoidTests.CustomUnloadingControl.unloadedOrder;
            QUnit.assert.strictEqual(unloadOrder.length, 6, "Incorrect number of controls");

            for (var i = 1; i < unloadOrder.length; i++) {
                QUnit.assert.ok(unloadOrder[i - 1] > unloadOrder[i], "Incorrect unload order detected. Control '" + unloadOrder[i - 1] + "' was not after '" + unloadOrder[i] + "'");
            }

            CodevoidTests.CustomUnloadingControl.unloadedOrder = null;
        });
    });

    promiseTest("throwingInControlUnloadStillUnloadsOtherControls", function () {
        var playground = getPlayground();

        var controlElement = playground.appendChild(CodevoidTests.TestControl.getElementForControl());
        var failingElement = playground.appendChild(CodevoidTests.TestControl.getElementForControl());
        var controlElement2 = playground.appendChild(CodevoidTests.TestControl.getElementForControl());

        return WinJS.UI.processAll(playground).then(function () {
            failingElement.winControl.dispose = function () {
                throw new Error();
            };

            domUtilities.disposeOfControlTree(playground);
            QUnit.assert.ok(controlElement.winControl.disposed, "Control wasn't disposed");
            QUnit.assert.ok(controlElement2.winControl.disposed, "Control wasn't disposed");
        });
    });

    promiseTest("emptyingAnElementCallsUnload", function () {
        var playground = getPlayground();

        var controlElement = playground.appendChild(CodevoidTests.TestControl.getElementForControl());
        var controlElement2 = playground.appendChild(CodevoidTests.TestControl.getElementForControl());

        return WinJS.UI.processAll(playground).then(function () {

            domUtilities.empty(playground);
            QUnit.assert.ok(controlElement.winControl.disposed, "Control wasn't disposed");
            QUnit.assert.ok(controlElement2.winControl.disposed, "Control wasn't disposed");
        });
    });

    promiseTest("removeChildCallsUnload", function () {
        var playground = getPlayground();
        var parent = playground.appendChild(document.createElement("div"));

        var controlElement = parent.appendChild(CodevoidTests.TestControl.getElementForControl());
        var controlElement2 = parent.appendChild(CodevoidTests.TestControl.getElementForControl());

        return WinJS.UI.processAll(playground).then(function () {

            domUtilities.removeChild(playground, parent);

            QUnit.assert.ok(controlElement.winControl.disposed, "Control wasn't disposed");
            QUnit.assert.ok(controlElement2.winControl.disposed, "Control wasn't disposed");
        });
    });

    QUnit.module("UtilitiesClasses");

    QUnit.test("canDerive", function () {
        var control = Codevoid.Utilities.derive(WinJS.Class.define(function () { }, { test: null }), function () { }, { test2: null });
        QUnit.assert.ok(control, "No control created");
    });

    QUnit.test("canInstantiateDerivedClass", function () {
        var baseConstructed = false;
        var derivedConstructed = false;

        var control = WinJS.Class.define(function () {
            baseConstructed = true;
        });

        var derived = Codevoid.Utilities.derive(control, function () {
            this.base();
            derivedConstructed = true;
        });

        var instance = new derived();

        QUnit.assert.ok(baseConstructed, "Base class constructor wasn't called");
        QUnit.assert.ok(derivedConstructed, "Derived class wasn't constructed");
    });

    QUnit.test("derivedClassesConstructorsCalledInCorrectOrder", function () {
        var constructorOrder = [];
        var baseConstructed = false;
        var derivedConstructed = false;

        var control = WinJS.Class.define(function () {
            constructorOrder.push(1);
            baseConstructed = true;
        });

        var derived = Codevoid.Utilities.derive(control, function () {
            this.base();
            constructorOrder.push(2);
            derivedConstructed = true;
        });

        var instance = new derived();

        QUnit.assert.ok(baseConstructed, "Base class constructor wasn't called");
        QUnit.assert.ok(derivedConstructed, "Derived class wasn't constructed");

        QUnit.assert.strictEqual(constructorOrder.length, 2, "Incorrect number of constructors called");
        QUnit.assert.strictEqual(constructorOrder[0], 1, "Base class wasn't called first");
        QUnit.assert.strictEqual(constructorOrder[1], 2, "Derived class wasn't called second");
    });

    QUnit.test("propertyHelperCanCreateProperty", function () {
        var object = WinJS.Class.mix(WinJS.Class.define(function () {
        }, {
            sample: Codevoid.Utilities.property("sample", null),
        }), WinJS.Utilities.eventMixin);
        QUnit.assert.ok(object, "type wasn't created");

        var instance = new object();
        QUnit.assert.ok(instance, "Instance wasn't created");
        QUnit.assert.ok("sample" in instance, "Property not found on instance");
        QUnit.assert.strictEqual(instance.sample, null, "Value wasn't set correctly");
    });

    QUnit.test("propertyRaisesEventWhenChanged", function () {
        var object = WinJS.Class.mix(WinJS.Class.define(function () {
        }, {
            sample: Codevoid.Utilities.property("sample", null),
        }), WinJS.Utilities.eventMixin);
        QUnit.assert.ok(object, "type wasn't created");

        var instance = new object();
        QUnit.assert.ok(instance, "Instance wasn't created");
        
        var valueChanged = false;
        instance.addEventListener("sampleChanged", function () {
            valueChanged = true;
        });

        instance.sample = Date.now();

        QUnit.assert.ok(valueChanged, "Value Didn't change");
    });

    QUnit.test("propertyRaisesEventWithCorrectDataWhenChanged", function () {
        var object = WinJS.Class.mix(WinJS.Class.define(function () {
        }, {
            sample: Codevoid.Utilities.property("sample", null),
        }), WinJS.Utilities.eventMixin);
        QUnit.assert.ok(object, "type wasn't created");

        var instance = new object();
        QUnit.assert.ok(instance, "Instance wasn't created");

        var valueChanged = false;
        var newValue = Date.now();
        instance.addEventListener("sampleChanged", function (e) {
            valueChanged = true;
            QUnit.assert.strictEqual(e.detail.previous, null, "Previous value incorrect");
            QUnit.assert.strictEqual(e.detail.current, newValue, "New value incorrect");
        });

        instance.sample = newValue;

        QUnit.assert.ok(valueChanged, "Value Didn't change");
    });

    QUnit.test("propertyRaisesEventWhenChanged", function () {
        var object = WinJS.Class.mix(WinJS.Class.define(function () {
        }, {
            sample: Codevoid.Utilities.property("sample", null),
        }), WinJS.Utilities.eventMixin);
        QUnit.assert.ok(object, "type wasn't created");

        var instance = new object();
        QUnit.assert.ok(instance, "Instance wasn't created");

        var valueChanged = false;
        var newValue = Date.now();
        instance.sample = newValue;
        instance.addEventListener("sampleChanged", function () {
            valueChanged = true;
        });

        instance.sample = newValue;

        QUnit.assert.ok(!valueChanged, "Value changed, shouldn't have");
    });

    QUnit.test("addEventListenerCanAddListeners", function () {
        var source = new CodevoidTests.EventSource();
        var eventWasRaised = false;
        
        Codevoid.Utilities.addEventListeners(source, {
            custom: function () {
                eventWasRaised = true;
            },
        });

        source.dispatchEvent("custom", {});

        QUnit.assert.ok(eventWasRaised, "No event raised");
    });

    QUnit.test("addEventListenerCanAddMoreThanOneListener", function () {
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

        QUnit.assert.ok(eventWasRaised, "No event raised");
        QUnit.assert.ok(event2WasRaised, "No event raised");
    });

    QUnit.test("cancellingEventListenerRemovesListeners", function () {
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

        QUnit.assert.ok(eventWasRaised, "No event raised");
        QUnit.assert.ok(event2WasRaised, "No event raised");

        cancel.cancel();

        // Reset the flags so they can be checked again
        eventWasRaised = false;
        event2WasRaised = false;

        source.dispatchEvent("custom", {});
        source.dispatchEvent("custom2", {});

        QUnit.assert.ok(!eventWasRaised, "Event raised");
        QUnit.assert.ok(!event2WasRaised, "Event raised");
    });

    QUnit.module("UtilitiesTemplates");

    promiseTest("canLoadTemplate", function () {
        return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "testTemplate").then(function (template) {
            QUnit.assert.ok(template, "Template Loaded!");
            domUtilities.clearTemplateCaches();
        });
    });

    promiseTest("itemReturnedIsABindingTemplate", function () {
        return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "testTemplate").then(function (template) {
            QUnit.assert.ok(template, "Template Loaded!");
            QUnit.assert.ok(template instanceof WinJS.Binding.Template, "Template isn't a WinJS.Binding.Template");
            domUtilities.clearTemplateCaches();
        });
    });

    promiseTest("loadingTemplateInNonExistantFileErrors", function () {
        return domUtilities.loadTemplate("/foo.html", "testTemplate").then(null, function () {
            QUnit.assert.ok(true, "Should have failed to load template");
        });
    });

    promiseTest("loadingNonExistantTemplateInLegitimateFileErrors", function () {
        return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "foo").then(null, function () {
            QUnit.assert.ok(true, "Should have failed to load template");
        });
    });

    promiseTest("canMarryPartNameToObjectInstance", function () {
        var playground = getPlayground();
        return domUtilities.loadTemplate("/js/tests/TestTemplate.html", "templateWithParts").then(function (template) {
            return template.render(null, playground);
        }).then(function () {
            var instance = {};
            domUtilities.marryPartsToControl(playground, instance);

            QUnit.assert.ok(instance.content, "Content not found");
            QUnit.assert.strictEqual(instance.content.innerText, "Test", "Incorrect element");
            
            QUnit.assert.ok(instance.otherContent, "Other Content not found");
            QUnit.assert.strictEqual(instance.otherContent.innerText, "Foo", "Incorrect otherContent element");

            QUnit.assert.ok(instance.aControl, "No Control found");
            QUnit.assert.ok(instance.aControl instanceof CodevoidTests.TestControl, "Part was not the control instance");
        });
    });

    promiseTest("canMarryPartNameToObjectInstanceWithOnlyASubTree", function () {
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

            QUnit.assert.ok(!instance.fakePart, "Didn't expect to find fake part");

            QUnit.assert.ok(instance.content, "Content not found");
            QUnit.assert.strictEqual(instance.content.innerText, "Test", "Incorrect element");

            QUnit.assert.ok(instance.otherContent, "Other Content not found");
            QUnit.assert.strictEqual(instance.otherContent.innerText, "Foo", "Incorrect otherContent element");

            QUnit.assert.ok(instance.aControl, "No Control found");
            QUnit.assert.ok(instance.aControl instanceof CodevoidTests.TestControl, "Part was not the control instance");
        });
    });

    promiseTest("canAttachEvents", function () {
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
                handleCustom: domUtilities.msfp(function (e) {
                    if (e && this.hasFlag) {
                        customCalled = true;
                    }
                }),
                handleCustom2: domUtilities.msfp(function (e) {
                    if (e && this.hasFlag) {
                        custom2Called = true;
                    }
                }),
                handleCustomRoot: domUtilities.msfp(function (e) {
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

            QUnit.assert.ok(customCalled, "Custom handler wasn't called");

            var custom2Event = document.createEvent("Event");
            custom2Event.initEvent("custom2", true, true);

            parts.child.dispatchEvent(custom2Event);

            QUnit.assert.ok(custom2Called, "Custom2 handler wasn't called");

            var customRootEvent = document.createEvent("Event");
            customRootEvent.initEvent("customRoot", true, true);
            playground.dispatchEvent(customRootEvent);

            QUnit.assert.ok(customRootCalled, "Custom root handler wasn't called");
        });
    });

    QUnit.test("domWithNoEventAttributesIsOK", function () {
        var playground = getPlayground();
        var newElement = document.createElement("div");
        playground.appendChild(newElement);

        domUtilities.marryEventsToHandlers(playground);
        QUnit.assert.ok(true, "Shouldn't fail, unless an exception is thrown");
    });

    QUnit.test("canAttachMoreThanOneEventOnAnElement", function () {
        var playground = getPlayground();
        var newElement = document.createElement("div");
        newElement.setAttribute("data-event", "{ custom: handleCustom, custom2: handleCustom2 }");
        playground.appendChild(newElement);

        var customCalled = false;
        var custom2Called = false;

        var instance = {
            hasFlag: true,
            handleCustom: domUtilities.msfp(function (e) {
                if (e && this.hasFlag) {
                    customCalled = true;
                }
            }),
            handleCustom2: domUtilities.msfp(function (e) {
                if (e && this.hasFlag) {
                    custom2Called = true;
                }
            }),
            handleCustomRoot: domUtilities.msfp(function (e) {
                if (e && this.hasFlag) {
                    customRootCalled = true;
                }
            }),
        };

        domUtilities.marryEventsToHandlers(playground, instance);

        var customEvent = document.createEvent("Event");
        customEvent.initEvent("custom", true, true);

        newElement.dispatchEvent(customEvent);

        QUnit.assert.ok(customCalled, "Custom handler wasn't called");

        var custom2Event = document.createEvent("Event");
        custom2Event.initEvent("custom2", true, true);

        newElement.dispatchEvent(custom2Event);

        QUnit.assert.ok(custom2Called, "Custom2 handler wasn't called");
    });

    QUnit.test("eventAttributesWithMissingHandlersThrowsException", function () {
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

        QUnit.assert.ok(exceptionWasThrown, "Married events to handlers when handler was missing");
    });

    QUnit.test("marryingEventsReturnsObjectToCancelThemWith", function () {
        var playground = getPlayground();
        var newElement = document.createElement("div");
        newElement.setAttribute("data-event", "{ custom: handleCustom }");
        playground.appendChild(newElement);

        var instance = { handleCustom: WinJS.Utilities.markSupportedForProcessing(function () { }) };

        var cancellable = domUtilities.marryEventsToHandlers(playground, instance);

        QUnit.assert.ok(cancellable, "Didn't get an event cancellation object");
        QUnit.assert.ok(cancellable.cancel, "Cancellation object didn't have a cancel on it");

        // Make sure calling cancel in this state
        cancellable.cancel();
    });

    QUnit.test("cancellingEventsActuallyDetatchesHandlers", function () {
        var playground = getPlayground();
        var newElement = document.createElement("div");
        newElement.setAttribute("data-event", "{ custom: handleCustom }");
        playground.appendChild(newElement);

        var customCalled = false;
        var instance = {
            hasFlag: true,
            handleCustom: domUtilities.msfp(function (e) {
                if (e && this.hasFlag) {
                    customCalled = true;
                }
            }),
        };

        var cancellable = domUtilities.marryEventsToHandlers(playground, instance);

        QUnit.assert.ok(cancellable, "Didn't get an event cancellation object");
        QUnit.assert.ok(cancellable.cancel, "Cancellation object didn't have a cancel on it");

        // Make sure calling cancel in this state
        cancellable.cancel();

        var customEvent = document.createEvent("Event");
        customEvent.initEvent("custom", true, true);

        newElement.dispatchEvent(customEvent);

        QUnit.assert.ok(!customCalled, "Didn't expect custom handler to be called after detaching them");
    });

    QUnit.module("DebounceTests");

    QUnit.test("constructingDebounceWithoutOperationOrTimeoutFails", () => {
        let failed = false;
        try {
            let constructed = new Codevoid.Utilities.Debounce(null, null);
        } catch (e) {
            failed = true;
        }

        QUnit.assert.ok(failed, "Didn't get failure constructoring object without parameters");
    });

    QUnit.test("constructingDebounceWithoutOperationButWithTimeoutFails", () => {
        let failed = false;
        try {
            let constructed = new Codevoid.Utilities.Debounce(null, 1);
        } catch (e) {
            failed = true;
        }

        QUnit.assert.ok(failed, "Didn't get failure constructoring object without operation");
    });

    QUnit.test("constructingDebounceWithOperationButWithouyTimeoutFails", () => {
        let failed = false;
        try {
            let constructed = new Codevoid.Utilities.Debounce(() => { }, 0);
        } catch (e) {
            failed = true;
        }

        QUnit.assert.ok(failed, "Didn't get failure constructoring object without timeout");
    });

    promiseTest("debouncingDoesNotHappenWithoutBouncing", () => {
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
            QUnit.assert.ok(!wasCalled, "Did not expect completion handler to be called");
        });
    });

    promiseTest("debouncingHappensAfterOneBounce", () => {
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
            QUnit.assert.ok(wasCalled, "Did not expect completion handler to be called");
            QUnit.assert.strictEqual(results.key, "1", "Wrong promise completed");
        });
    });

    promiseTest("debouncingHappensDelayedOverMultipleBounces", () => {
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
            QUnit.assert.ok(wasCalled, "Did not expect completion handler to be called");
            QUnit.assert.ok(end > 30, `Operation was not debounced quickly. Took ${end}ms`);
            QUnit.assert.ok(end < 100, `Operation took too long to debounce. Took ${end}ms`);
        });
    });

    promiseTest("debouncingAfterCompletionDoesNotCompleteASecondTime", () => {
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
            QUnit.assert.strictEqual(completionCount, 1, "Bounce Completed more than once");
        });
    });

    promiseTest("debouncingCanDebounceMoreThanOnce", () => {
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
            QUnit.assert.strictEqual(completionCount, 2, "Bounce Completed more than once");
        });
    });
})();