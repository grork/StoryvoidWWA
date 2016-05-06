(function () {
    "use strict";

    var Signal = Codevoid.Utilities.Signal;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;
    var cleanupExperienceHost = InstapaperTestUtilities.cleanupExperienceHost;
    var authenticator = Codevoid.Storyvoid.Authenticator;
    var testCredentials = {
        user: "PLACEHOLDER",
        password: "PLACEHOLDER"
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

        Windows.Storage.ApplicationData.current.localSettings.values[authenticator._tokenSettingInformation.root] = values;

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

        Windows.Storage.ApplicationData.current.localSettings.values[authenticator._tokenSettingInformation.root] = values;

        authenticator.clearClientInformation();

        ok(!Windows.Storage.ApplicationData.current.localSettings.values.hasKey(authenticator._tokenSettingInformation.root), "Shouldn't find settings");
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
            var tokenInformation = Windows.Storage.ApplicationData.current.localSettings.values[authenticator._tokenSettingInformation.root];
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

    promiseTest("canSuccessfullyAuthenticateWhenPromptingForCredentials", function () {
        var vm = new authenticator.AuthenticatorViewModel();

        vm.username = testCredentials.user;
        vm.password = testCredentials.password;

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

        vm.username = testCredentials.user;
        vm.password = testCredentials.password;

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
        });
    });

    promiseTest("canFailureToAuthenticateIsCorrectlyPropogated", function () {
        var vm = new authenticator.AuthenticatorViewModel();

        vm.username = testCredentials.user;
        vm.password = "foo";

        return vm.authenticate().then(function () {
            ok(false, "Expected to complete authentication");
        }, function () {
            strictEqual(vm.authenticationError, 401, "Expected auth error");
            strictEqual(vm.authenticationErrorMessage, Codevoid.Storyvoid.Authenticator.friendlyMessageForError(401), "Wrong error message");
            ok(true, "Didn't expect to fail authentication");
        });
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

    test("authenticationErrorMessagePropertyRaisesEvent", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        var authenticationErrorMessageChanged = false;
        vm.addEventListener("authenticationErrorMessageChanged", function () {
            authenticationErrorMessageChanged = true;
        });

        vm.authenticationError = 401;
        ok(authenticationErrorMessageChanged, "Authentication error didn't change");
    });

    promiseTest("authenticationErrorIsResetWhenReauthenticating", function () {
        var vm = new authenticator.AuthenticatorViewModel();
        var authenticationErrorWasReset = false;
        var authenticationErrorMessageWasReset = false;

        vm.username = testCredentials.user;
        vm.password = "foo";

        return vm.authenticate().then(function () {
            ok(false, "Expected to fails authentication");
        }, function () {
            strictEqual(vm.authenticationError, 401, "Expected auth error");

            vm.addEventListener("authenticationErrorChanged", function () {
                if (vm.authenticationError === 0) {
                    authenticationErrorWasReset = true;
                    if (!vm.authenticationErrorMessage) {
                        authenticationErrorMessageWasReset = true;
                    }
                }
            });

            return vm.authenticate();
        }).then(function () {
            ok(false, "shouldn't have succeeded");
        }, function () {
            ok(authenticationErrorWasReset, "Should have been reset");
            ok(authenticationErrorMessageWasReset, "message wasn't reset");
            strictEqual(vm.authenticationError, 401, "Incorrect error code");
        });
    });
})();