(function () {
    "use strict";

    var Signal = Codevoid.Utilities.Signal;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;
    var uicore = Codevoid.UICore;

    QUnit.module("UICoreControls");

    QUnit.test("canInstantiateControl", function () {
        var control = new Codevoid.UICore.Control(document.createElement("div"));
        QUnit.assert.ok(control, "Control couldn't be created");
    });

    QUnit.test("optionsPassedToControlAreSetOnObject", function () {
        var control = new Codevoid.UICore.Control(document.createElement("div"), {
            value: "a",
            anotherValue: "b",
        });

        QUnit.assert.ok(control, "Control wasn't created");
        QUnit.assert.strictEqual(control.value, "a", "Value wasn't set on instance");
        QUnit.assert.strictEqual(control.anotherValue, "b", "AnotherValue wasn't set on instance");
    });

    QUnit.test("elementPassedToControlIsSet", function () {
        var playground = getPlayground();
        var control = new Codevoid.UICore.Control(playground);

        QUnit.assert.ok(control, "Control wasn't created");
        QUnit.assert.strictEqual(control.element, playground, "Controls element was incorrect");
    });


    QUnit.test("errorOnGettingViewForModelWithoutView", function () {
        var model = {};

        var exceptionCaught = false;

        try {
            uicore.Experiences.getExperienceForModel(model);
        } catch (e) {
            exceptionCaught = true;
        }

        QUnit.assert.ok(exceptionCaught, "No exception caught");
    });

    QUnit.test("errorOnGettingViewForNotDefinedViewType", function () {
        var model = {
            experience: {
                unittest: "CodevoidTests.TestControl",
            },
        };

        var exceptionCaught = false;
        try {
            uicore.Experiences.getExperienceForModel(model, "fake");
        } catch (e) {
            exceptionCaught = true;
        }

        QUnit.assert.ok(exceptionCaught, "No exception caught");
    });

    QUnit.test("canGetViewForSimpleModel", function () {
        var model = {
            experience: {
                unittest: "CodevoidTests.UnitTestView",
            },
        };

        var view = uicore.Experiences.getExperienceForModel(model, "unittest");
        QUnit.assert.ok(view, "Expected to get a view");
        QUnit.assert.ok(view.identifier, "Expected identifier");
        QUnit.assert.ok(view.ctor, "Expected constructor");
        QUnit.assert.strictEqual(typeof view.ctor, "function", "Expected a function");
    });
})();