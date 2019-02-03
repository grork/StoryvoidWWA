(function () {
    "use strict";

    var Signal = Codevoid.Utilities.Signal;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;
    var uicore = Codevoid.UICore;

    QUnit.module("UICoreControls");

    QUnit.test("canInstantiateControl", function (assert) {
        var control = new Codevoid.UICore.Control(document.createElement("div"));
        assert.ok(control, "Control couldn't be created");
    });

    QUnit.test("optionsPassedToControlAreSetOnObject", function (assert) {
        var control = new Codevoid.UICore.Control(document.createElement("div"), {
            value: "a",
            anotherValue: "b",
        });

        assert.ok(control, "Control wasn't created");
        assert.strictEqual(control.value, "a", "Value wasn't set on instance");
        assert.strictEqual(control.anotherValue, "b", "AnotherValue wasn't set on instance");
    });

    QUnit.test("elementPassedToControlIsSet", function (assert) {
        var playground = getPlayground();
        var control = new Codevoid.UICore.Control(playground);

        assert.ok(control, "Control wasn't created");
        assert.strictEqual(control.element, playground, "Controls element was incorrect");
    });


    QUnit.test("errorOnGettingViewForModelWithoutView", function (assert) {
        var model = {};

        var exceptionCaught = false;

        try {
            uicore.Experiences.getExperienceForModel(model);
        } catch (e) {
            exceptionCaught = true;
        }

        assert.ok(exceptionCaught, "No exception caught");
    });

    QUnit.test("errorOnGettingViewForNotDefinedViewType", function (assert) {
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

        assert.ok(exceptionCaught, "No exception caught");
    });

    QUnit.test("canGetViewForSimpleModel", function (assert) {
        var model = {
            experience: {
                unittest: "CodevoidTests.UnitTestView",
            },
        };

        var view = uicore.Experiences.getExperienceForModel(model, "unittest");
        assert.ok(view, "Expected to get a view");
        assert.ok(view.identifier, "Expected identifier");
        assert.ok(view.ctor, "Expected constructor");
        assert.strictEqual(typeof view.ctor, "function", "Expected a function");
    });
})();