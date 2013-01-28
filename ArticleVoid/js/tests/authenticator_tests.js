(function () {
    "use strict";

    var Signal = Codevoid.Utilities.Signal;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;
    var cleanupExperienceHost = InstapaperTestUtilities.cleanupExperienceHost;
    var authenticator = Codevoid.ArticleVoid.Authenticator;
    var testCredentials = {
        user: "test@codevoid.net",
        password: "TestPassword"
    };

    WinJS.Namespace.define("CodevoidTests", {
        AuthenticatorTestUI: WinJS.Class.define(function (container, options) {
            WinJS.UI.setOptions(this, options);

            this.wasPrompted = true;

            this.again();
        }, {
            again: function () {
                this.tryCount++;
                WinJS.Promise.timeout().done(function () {
                    var creds = CodevoidTests.AuthenticatorTestUI.credentialsToUse;
                    if (!creds) {
                        this.viewModel.credentialAcquisitionComplete.error({});
                    } else if (creds === -1) {
                        this.viewModel.credentialAcquisitionComplete.promise.cancel();
                    } else {
                        this.viewModel.username = creds.username;
                        this.viewModel.password = creds.password;
                        this.viewModel.credentialAcquisitionComplete.complete();
                    }
                }.bind(this));
            },
            wasPrompted: false,
            tryCount: 0,
        }, {
            credentialsToUse: (function () {
                var credStore = null;
                return {
                    get: function () {
                        var creds = credStore;
                        if (Array.isArray(credStore)) {
                            creds = credStore.shift();
                        } else {
                            credStore = null;
                        }
                        return creds;
                    },
                    set: function (v) {
                        credStore = v;
                    }
                };
            })(),
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

    test("settingUsernameEnablesCanAuthenticate", function () {
        var vm = new authenticator.AuthenticatorViewModel();

        ok(!vm.canAuthenticate, "Shouldn't be able to authenticate before we set a username");

        vm.username = "test";

        ok(vm.canAuthenticate, "Authentication should be possible with a valid username");
    });

    test("allowUsernameIsInitiallyTrue", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        ok(vm.allowUsernameEntry, "Expceted to be able to enter the username");
    });

    test("allowUsernameRaisesChangeEvent", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        ok(vm.allowUsernameEntry, "Expceted to be able to enter the username");
        var allowUsernameEntryChangedEventRaised = false;

        vm.addEventListener("allowUsernameEntryChanged", function () {
            allowUsernameEntryChangedEventRaised = true;
        });

        vm.allowUsernameEntry = false;

        ok(allowUsernameEntryChangedEventRaised, "Didn't get change event for username entry");
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
        }).then(cleanupExperienceHost);
    });

    promiseTest("experienceRemovedWhenCredentialPromptCanceled", function () {
        var vm = new authenticator.AuthenticatorViewModel();

        Codevoid.UICore.Experiences.initializeHost(new CodevoidTests.UnitTestExperienceHost());
        CodevoidTests.AuthenticatorTestUI.credentialsToUse = -1;

        vm.experience.unittest = "CodevoidTests.AuthenticatorTestUI";
        return vm.authenticate().then(function () {
            ok(false, "Expected to fail");
        }, function () {
            var xp = Codevoid.UICore.Experiences.currentHost.getExperienceForModel(vm);
            ok(!xp, "Didn't expect to find experience");
        }).then(cleanupExperienceHost);
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
        }).then(cleanupExperienceHost);
    });

    promiseTest("whenAuthenticatingIsWorkingIsTrueAndBecomesFalseWhenCompleted", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        var isWorkingBecameTrue = false;
        var canAuthenticateIsFalse = false;
        var allowPasswordEntryIsFalse = false;
        var allowUsernameEntryIsFalse = false;

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

            if (!vm.canAuthenticate) {
                canAuthenticateIsFalse = true;
            }

            if (!vm.allowPasswordEntry) {
                allowPasswordEntryIsFalse = true;
            }

            if (!vm.allowUsernameEntry) {
                allowUsernameEntryIsFalse = true;
            }
        });

        return vm.authenticate().then(function () {
            ok(isWorkingBecameTrue, "Expected isWorking to have become true during authentication");
            ok(canAuthenticateIsFalse, "Expected canAuthenticate to become false during authentication");
            ok(allowPasswordEntryIsFalse, "Expected allowPasswordEntry to become false during authentication");
            ok(allowUsernameEntryIsFalse, "Expected allowUsernameEntry to become false during authentication");
            ok(!vm.isWorking, "Should have completed authentication");
            ok(vm.canAuthenticate, "Should be able to authenticate again");
            ok(vm.allowPasswordEntry, "Should be able to enter password again");
            ok(vm.allowUsernameEntry, "Should be able to enter username again");
        }, function () {
            ok(false, "Didn't expect to fail authentication");
        }).then(cleanupExperienceHost);
    });

    promiseTest("whenAuthenticatingIsWorkingIsTrueAndBecomesFalseWhenCompletedWithError", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        var isWorkingBecameTrue = false;

        Codevoid.UICore.Experiences.initializeHost(new CodevoidTests.UnitTestExperienceHost());

        vm.experience.unittest = "CodevoidTests.AuthenticatorTestUI";

        vm.addEventListener("isWorkingChanged", function () {
            if (vm.isWorking) {
                isWorkingBecameTrue = true;
            }
        });

        return vm.authenticate().then(function () {
            ok(false, "Expected to fail authentication");
        }, function () {
            ok(!isWorkingBecameTrue, "Expected isWorking to not have become true during authentication");
            ok(!vm.isWorking, "Should have completed authentication");
        }).then(cleanupExperienceHost);
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
        }).then(cleanupExperienceHost);
    });

    promiseTest("canFailureToAuthenticateIsCorrectlyPropogated", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        var host = new CodevoidTests.UnitTestExperienceHost();

        Codevoid.UICore.Experiences.initializeHost(host);

        vm.experience.unittest = "CodevoidTests.AuthenticatorTestUI";
        CodevoidTests.AuthenticatorTestUI.credentialsToUse = {
            username: testCredentials.user,
            password: "foo",
        };

        return vm.authenticate().then(function () {
            ok(false, "Expected to complete authentication");
        }, function () {
            var xp = host.getExperienceForModel(vm);
            ok(xp, "Expected to find the experience");
            strictEqual(vm.authenticationError, 401, "Expected auth error");
            ok(true, "Didn't expect to fail authentication");
        }).then(cleanupExperienceHost);
    });

    test("authenticationErrorPropertyRaisesEvent", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        var authenticationErrorChanged = false;
        vm.addEventListener("authenticationErrorChanged", function () {
            authenticationErrorChanged = true;
        });

        vm.authenticationError = 1;
        ok(authenticationErrorChanged, "Authentication error didn't change");
    });

    promiseTest("authenticationErrorIsResetWhenReauthenticating", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        var host = new CodevoidTests.UnitTestExperienceHost();
        var authenticationErrorWasReset = false;

        Codevoid.UICore.Experiences.initializeHost(host);

        vm.experience.unittest = "CodevoidTests.AuthenticatorTestUI";
        CodevoidTests.AuthenticatorTestUI.credentialsToUse = {
            username: testCredentials.user,
            password: "foo",
        };

        return vm.authenticate().then(function () {
            ok(false, "Expected to fails authentication");
        }, function () {
            var xp = host.getExperienceForModel(vm);
            ok(xp, "Expected to find the experience");
            strictEqual(vm.authenticationError, 401, "Expected auth error");

            vm.addEventListener("authenticationErrorChanged", function () {
                if (vm.authenticationError === 0) {
                    authenticationErrorWasReset = true;
                }
            });

            return vm.authenticate();
        }).then(function () {
            ok(false, "shouldn't have succeeded");
        }, function () {
            ok(authenticationErrorWasReset, "Should have been reset");
            strictEqual(vm.authenticationError, 401, "Incorrect error code");
        }).then(cleanupExperienceHost);
    });

    promiseTest("authenticationIsRetriedWhenFails", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        var host = new CodevoidTests.UnitTestExperienceHost();

        Codevoid.UICore.Experiences.initializeHost(host);

        vm.experience.unittest = "CodevoidTests.AuthenticatorTestUI";
        CodevoidTests.AuthenticatorTestUI.credentialsToUse = [{
            username: testCredentials.user,
            password: "foo",
        }, {
            username: testCredentials.user,
            password: testCredentials.password,
        }];

        return vm.authenticate(true).then(function () {
            ok(true, "Expected to complete authentication");
        });
    });

    promiseTest("authenticationErrorIsntResetOnRetry", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        var host = new CodevoidTests.UnitTestExperienceHost();
        var states = [];

        Codevoid.UICore.Experiences.initializeHost(host);

        vm.experience.unittest = "CodevoidTests.AuthenticatorTestUI";
        CodevoidTests.AuthenticatorTestUI.credentialsToUse = [{
            username: testCredentials.user,
            password: "foo",
        }, -1];

        vm.addEventListener("authenticationErrorChanged", function () {
            if (vm.authenticationError === 401) {
                states.push(401);
            }

            if (vm.authenticationError === 0) {
                states.push(0);
            }
        });

        return vm.authenticate(true).then(function () {
            ok(false, "Shouldn't have completed");
        }, function (err) {
            strictEqual(err.name, "Canceled", "Should have been cancelled");
            strictEqual(states.length, 1, "Only expected on status change");
            strictEqual(states[0], 401, "Expected error code to be 401");
        }).then(cleanupExperienceHost);
    });
})();