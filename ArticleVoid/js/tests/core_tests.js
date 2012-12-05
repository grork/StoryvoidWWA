(function () {
    "use strict";

    var Signal = Codevoid.Utilities.Signal;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;

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
})();