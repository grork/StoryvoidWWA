(function () {
    "use strict";

    var Signal = Codevoid.Utilities.Signal;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;
    var uicore = Codevoid.UICore;

    module("UICoreControls");

    test("canInstantiateControl", function () {
        var control = new Codevoid.UICore.Control();
        ok(control, "Control couldn't be created");
    });

    test("optionsPassedToControlAreSetOnObject", function () {
        var control = new Codevoid.UICore.Control(null, {
            value: "a",
            anotherValue: "b",
        });

        ok(control, "Control wasn't created");
        strictEqual(control.value, "a", "Value wasn't set on instance");
        strictEqual(control.anotherValue, "b", "AnotherValue wasn't set on instance");
    });

    test("elementPassedToControlIsSet", function () {
        var playground = getPlayground();
        var control = new Codevoid.UICore.Control(playground);

        ok(control, "Control wasn't created");
        strictEqual(control.element, playground, "Controls element was incorrect");
    });


    test("errorOnGettingViewForModelWithoutView", function () {
        var model = {};

        var exceptionCaught = false;

        try {
            uicore.getViewForModel(model);
        } catch (e) {
            exceptionCaught = true;
        }

        ok(exceptionCaught, "No exception caught");
    });

    test("errorOnGettingViewForNotDefinedViewType", function () {
        var model = {
            view: {
                unittest: "CodevoidTests.TestControl",
            },
        };

        var exceptionCaught = false;

        var currentViewType = uicore.currentViewType;
        uicore.currentViewType = "fake";

        try {
            uicore.getViewForModel(model);
        } catch (e) {
            exceptionCaught = true;
        }

        ok(exceptionCaught, "No exception caught");

        uicore.currentViewType = currentViewType;
    });

    test("canGetViewForSimpleModel", function () {
        var model = {
            view: {
                unittest: "CodevoidTests.UnitTestView",
            },
        };

        var view = uicore.getViewForModel(model);
        ok(view, "Expected to get a view");
        strictEqual(typeof view, "function", "Expected a function");
    });
})();