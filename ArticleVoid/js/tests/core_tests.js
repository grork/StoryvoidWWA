(function () {
    "use strict";

    var Signal = Codevoid.Utilities.Signal;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;
    var uicore = Codevoid.UICore;

    module("UICoreControls");

    test("canInstantiateControl", function () {
        var control = new Codevoid.UICore.Control(document.createElement("div"));
        ok(control, "Control couldn't be created");
    });

    test("optionsPassedToControlAreSetOnObject", function () {
        var control = new Codevoid.UICore.Control(document.createElement("div"), {
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
            uicore.getExperienceForModel(model);
        } catch (e) {
            exceptionCaught = true;
        }

        ok(exceptionCaught, "No exception caught");
    });

    test("errorOnGettingViewForNotDefinedViewType", function () {
        var model = {
            experience: {
                unittest: "CodevoidTests.TestControl",
            },
        };

        var exceptionCaught = false;

        var currentViewType = uicore.currentViewType;
        uicore.currentViewType = "fake";

        try {
            uicore.getExperienceForModel(model);
        } catch (e) {
            exceptionCaught = true;
        }

        ok(exceptionCaught, "No exception caught");

        uicore.currentViewType = currentViewType;
    });

    test("canGetViewForSimpleModel", function () {
        var model = {
            experience: {
                unittest: "CodevoidTests.UnitTestView",
            },
        };

        var view = uicore.getExperienceForModel(model);
        ok(view, "Expected to get a view");
        ok(view.identifier, "Expected identifier");
        ok(view.ctor, "Expected constructor");
        strictEqual(typeof view.ctor, "function", "Expected a function");
    });
})();