(function () {
    "use strict";

    var Signal = Codevoid.Utilities.Signal;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;

    module("Authenticator");

    test("canInstantiate", function () {
        var playground = getPlayground();
        var authenticator = new Codevoid.ArticleVoid.UI.Authenticator(playground);

        ok(authenticator, "Authenticator not created");
        strictEqual(authenticator.element, playground, "Element not set on control instance");
    });
})();