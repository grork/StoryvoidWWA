(function () {
    "use strict";

    var Signal = Codevoid.Utilities.Signal;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;
    var authenticator = Codevoid.ArticleVoid.Authenticator;
    var testCredentials = {
        user: "test@codevoid.net",
        password: "TestPassword"
    };

    WinJS.Namespace.define("CodevoidTests", {
        AuthenticatorTestUI: WinJS.Class.define(function (container, options) {
            WinJS.UI.setOptions(this, options);

            this.wasPrompted = true;
            WinJS.Promise.timeout().done(function () {
                var creds = CodevoidTests.AuthenticatorTestUI.credentialsToUse;
                if (!creds) {
                    options.viewModel.credentialAcquisitionComplete.error({});
                } else if (creds === Codevoid.ArticleVoid.Authenticator.AuthenticatorViewModel.Cancelled) {
                    options.viewModel.credentialAcquisitionComplete.error(creds);
                } else {
                    options.viewModel.username = creds.username;
                    options.viewModel.password = creds.password;
                    options.viewModel.credentialAcquisitionComplete.complete();
                }
            });
        }, {
            wasPrompted: false, 
        }, {
            credentialsToUse: null,
        }),
    });

    module("Authenticator");

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

        return authenticator.getClientInformation(testCredentials).then(function (clientInformation) {
            ok(clientInformation, "No client information");

            ok(clientInformation.clientToken, "No token information");
            ok(clientInformation.clientTokenSecret, "No secret information");

            authenticator.clearClientInformation();
        });
    });

    promiseTest("clientInformationIsSavedAfterGettingFromService", function () {
        authenticator.clearClientInformation();

        return authenticator.getClientInformation(testCredentials).then(function (clientInformation) {
            var tokenInformation = Windows.Storage.ApplicationData.current.roamingSettings.values[authenticator._tokenSettingInformation.root];
            ok(clientInformation, "No client information");
            ok(clientInformation.clientToken, "No token information");
            ok(clientInformation.clientTokenSecret, "No secret information");

            strictEqual(tokenInformation[authenticator._tokenSettingInformation.token], clientInformation.clientToken, "Token saved doesn't match the one from the service");
            strictEqual(tokenInformation[authenticator._tokenSettingInformation.secret], clientInformation.clientTokenSecret, "Secret saved doesn't match the one from the service");

            authenticator.clearClientInformation();
        });
    });


    module("AuthenticatorViewModel");

    test("canInstantiateViewModel", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        ok(vm, "No view model created");
    });

    test("changingPasswordRaisesEvent", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        var eventRaised = false;

        vm.addEventListener("passwordChanged", function () {
            eventRaised = true;
        });

        vm.password = "test";

        ok(eventRaised, "No password changed");
    });

    test("changingUsernameRaisesEvent", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        var eventRaised = false;

        vm.addEventListener("usernameChanged", function () {
            eventRaised = true;
        });

        vm.username = "test";

        ok(eventRaised, "No password changed");
    });

    test("canAuthenticateInitiallyFalse", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        ok(!vm.canAuthenticate, "Shouldn't be able to authenticate with no user/pass");
    });

    test("settingUsernameAuthenticates", function () {
        var vm = new authenticator.AuthenticatorViewModel();

        ok(!vm.canAuthenticate, "Shouldn't be able to authenticate before we set a username");

        vm.username = "test";

        ok(vm.canAuthenticate, "Authentication should be possible with a valid username");
    });

    test("settingPasswordOnlyShouldn'tEnableAuthentication", function () {
        var vm = new authenticator.AuthenticatorViewModel();

        ok(!vm.canAuthenticate, "Shouldn't be able to authenticate before we set a username");

        vm.password = "test";

        ok(!vm.canAuthenticate, "Authentication shouldn't be possible with only a password");
    });

    test("settingUsernameAndPasswordShouldEnableAuthentication", function () {
        var vm = new authenticator.AuthenticatorViewModel();

        ok(!vm.canAuthenticate, "Shouldn't be able to authenticate before we set a username");

        vm.username = "test";
        vm.password = "test";

        ok(vm.canAuthenticate, "Authentication should be enabled");
    });

    test("settingNonStringUsernameDoesn'tEnableAuthentication", function () {
        var vm = new authenticator.AuthenticatorViewModel();

        ok(!vm.canAuthenticate, "Shouldn't be able to authenticate before we set a username");

        vm.username = 1;

        ok(!vm.canAuthenticate, "Authentication should be possible with an invalid");
    });

    test("passwordEntryDisabledOnCreation", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        ok(!vm.allowPasswordEntry, "Shouldn't be able to enter password with no user");
    });

    test("passwordEntryEnabledWhenUserSet", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        ok(!vm.allowPasswordEntry, "Shouldn't be able to enter password with no user");

        vm.username = "test";

        ok(vm.allowPasswordEntry, "Should be able to enter password with a username");
    });

    promiseTest("canPromptForCredentials", function () {
        var vm = new authenticator.AuthenticatorViewModel();

        Codevoid.UICore.Experiences.initializeHost(new CodevoidTests.UnitTestExperienceHost());

        vm.experience.unittest = "CodevoidTests.AuthenticatorTestUI";
        return vm.authenticate().then(function () {
            ok(false, "Expected to fail");
        }, function () {
            var xp = Codevoid.UICore.Experiences.currentHost.getExperienceForModel(vm);
            ok(xp.wasPrompted, "Expected to have been prompted");
        });
    });

    promiseTest("experienceRemovedWhenCredentialPromptCancelled", function () {
        var vm = new authenticator.AuthenticatorViewModel();

        Codevoid.UICore.Experiences.initializeHost(new CodevoidTests.UnitTestExperienceHost());
        CodevoidTests.AuthenticatorTestUI.credentialsToUse = Codevoid.ArticleVoid.Authenticator.AuthenticatorViewModel.Cancelled;

        vm.experience.unittest = "CodevoidTests.AuthenticatorTestUI";
        return vm.authenticate().then(function () {
            ok(false, "Expected to fail");
        }, function () {
            var xp = Codevoid.UICore.Experiences.currentHost.getExperienceForModel(vm);
            ok(!xp, "Didn't expect to find experience");
        });
    });

    promiseTest("canSuccessfullyAuthenticateWhenPromptingForCredentials", function () {
        var vm = new authenticator.AuthenticatorViewModel();

        Codevoid.UICore.Experiences.initializeHost(new CodevoidTests.UnitTestExperienceHost());

        vm.experience.unittest = "CodevoidTests.AuthenticatorTestUI";
        CodevoidTests.AuthenticatorTestUI.credentialsToUse = {
            username: testCredentials.user,
            password: testCredentials.password,
        };

        return vm.authenticate().then(function () {
            ok(true, "Expected to complete authentication");
        }, function () {
            ok(false, "Didn't expect to fail authentication");
        });
    });

    promiseTest("whenAuthenticatingIsWorkingIsTrueAndBecomesFalseWhenCompleted", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        var isWorkingBecameTrue = false;

        Codevoid.UICore.Experiences.initializeHost(new CodevoidTests.UnitTestExperienceHost());

        vm.experience.unittest = "CodevoidTests.AuthenticatorTestUI";
        CodevoidTests.AuthenticatorTestUI.credentialsToUse = {
            username: testCredentials.user,
            password: testCredentials.password,
        };

        vm.addEventListener("isWorkingChanged", function () {
            if (vm.isWorking) {
                isWorkingBecameTrue = true;
            }
        });

        return vm.authenticate().then(function () {
            ok(isWorkingBecameTrue, "Expected isWorking to have become true during authentication");
            ok(!vm.isWorking, "Should have completed authentication");
            ok(true, "Expected to complete authentication");
        }, function () {
            ok(false, "Didn't expect to fail authentication");
        });
    });

    promiseTest("experienceIsRemovedWhenSuccessfullyAuthenticating", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        var host = new CodevoidTests.UnitTestExperienceHost();

        Codevoid.UICore.Experiences.initializeHost(host);

        vm.experience.unittest = "CodevoidTests.AuthenticatorTestUI";
        CodevoidTests.AuthenticatorTestUI.credentialsToUse = {
            username: testCredentials.user,
            password: testCredentials.password,
        };

        return vm.authenticate().then(function () {
            var experience = host.getExperienceForModel(vm);
            ok(!experience, "Didn't expect to find the experience");
            ok(true, "Expected to complete authentication");
        }, function () {
            ok(false, "Didn't expect to fail authentication");
        });
    });
})();