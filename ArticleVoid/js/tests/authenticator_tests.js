(function () {
    "use strict";

    var Signal = Codevoid.Utilities.Signal;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;
    var authenticator = Codevoid.ArticleVoid.Authenticator;

    module("Authenticator");

    test("canInstantiate", function () {
        var playground = getPlayground();
        var authenticator = new Codevoid.ArticleVoid.UI.Authenticator(playground);

        ok(authenticator, "Authenticator not created");
        strictEqual(authenticator.element, playground, "Element not set on control instance");
    });

    promiseTest("settingsReturnedFromStorage", function () {
        var fakeToken = "fakeToken";
        var fakeSecret = "fakeSecret";

        var values = new Windows.Storage.ApplicationDataCompositeValue();
        values[authenticator._tokenSettingInformation.token] = fakeToken;
        values[authenticator._tokenSettingInformation.secret] = fakeSecret;

        Windows.Storage.ApplicationData.current.roamingSettings.values[authenticator._tokenSettingInformation.root] = values;

        return authenticator.getClientInformation().then(function (clientInformation) {
            ok(clientInformation, "Didn't get client information");

            strictEqual(clientInformation.clientToken, fakeToken, "Incorrect token");
            strictEqual(clientInformation.clientTokenSecret, fakeSecret, "Incorrect secret");
        });
    });

    test("settingsCanBeCleared", function () {
        var fakeToken = "fakeToken";
        var fakeSecret = "fakeSecret";

        var values = new Windows.Storage.ApplicationDataCompositeValue();
        values[authenticator._tokenSettingInformation.token] = fakeToken;
        values[authenticator._tokenSettingInformation.secret] = fakeSecret;

        Windows.Storage.ApplicationData.current.roamingSettings.values[authenticator._tokenSettingInformation.root] = values;

        authenticator.clearClientInformation();

        ok(!Windows.Storage.ApplicationData.current.roamingSettings.values.hasKey(authenticator._tokenSettingInformation.root), "Shouldn't find settings");
    });

    promiseTest("tokenInformationObtainedFromService", function () {
        authenticator.clearClientInformation();

        return authenticator.getClientInformation().then(function (clientInformation) {
            ok(clientInformation, "No client information");

            ok(clientInformation.clientToken, "No token information");
            ok(clientInformation.clientTokenSecret, "No secret information");

            authenticator.clearClientInformation();
        });
    });

    promiseTest("clientInformationIsSavedAfterGettingFromService", function () {
        authenticator.clearClientInformation();

        return authenticator.getClientInformation().then(function (clientInformation) {
            var tokenInformation = Windows.Storage.ApplicationData.current.roamingSettings.values[authenticator._tokenSettingInformation.root];
            ok(clientInformation, "No client information");
            ok(clientInformation.clientToken, "No token information");
            ok(clientInformation.clientTokenSecret, "No secret information");

            strictEqual(tokenInformation[authenticator._tokenSettingInformation.token], clientInformation.clientToken, "Token saved doesn't match the one from the service");
            strictEqual(tokenInformation[authenticator._tokenSettingInformation.secret], clientInformation.clientTokenSecret, "Secret saved doesn't match the one from the service");

            authenticator.clearClientInformation();
        });
    });
})();