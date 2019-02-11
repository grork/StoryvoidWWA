(function () {
    "use strict";

    var Signal = Codevoid.Utilities.Signal;
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

    describe("Authenticator", function () {

        it("settingsReturnedFromStorage", function () {
            var fakeToken = "fakeToken";
            var fakeSecret = "fakeSecret";

            var values = new Windows.Storage.ApplicationDataCompositeValue();
            values[authenticator._tokenSettingInformation.token] = fakeToken;
            values[authenticator._tokenSettingInformation.secret] = fakeSecret;

            Windows.Storage.ApplicationData.current.localSettings.values[authenticator._tokenSettingInformation.root] = values;

            var clientInformation = authenticator.getStoredCredentials();
            assert.ok(clientInformation, "Didn't get client information");

            assert.strictEqual(clientInformation.clientToken, fakeToken, "Incorrect token");
            assert.strictEqual(clientInformation.clientTokenSecret, fakeSecret, "Incorrect secret");
        });

        it("settingsCanBeCleared", function () {
            var fakeToken = "fakeToken";
            var fakeSecret = "fakeSecret";

            var values = new Windows.Storage.ApplicationDataCompositeValue();
            values[authenticator._tokenSettingInformation.token] = fakeToken;
            values[authenticator._tokenSettingInformation.secret] = fakeSecret;

            Windows.Storage.ApplicationData.current.localSettings.values[authenticator._tokenSettingInformation.root] = values;

            authenticator.clearClientInformation();

            assert.ok(!Windows.Storage.ApplicationData.current.localSettings.values.hasKey(authenticator._tokenSettingInformation.root), "Shouldn't find settings");
        });
    });

    describe("AuthenticatorViewModel", function () {

        it("canInstantiateViewModel", function () {
            var vm = new authenticator.AuthenticatorViewModel();
            assert.ok(vm, "No view model created");
        });

        it("changingPasswordRaisesEvent", function () {
            var vm = new authenticator.AuthenticatorViewModel();
            var eventRaised = false;

            vm.addEventListener("passwordChanged", function () {
                eventRaised = true;
            });

            vm.password = "test";

            assert.ok(eventRaised, "No password changed");
        });

        it("changingUsernameRaisesEvent", function () {
            var vm = new authenticator.AuthenticatorViewModel();
            var eventRaised = false;

            vm.addEventListener("usernameChanged", function () {
                eventRaised = true;
            });

            vm.username = "test";

            assert.ok(eventRaised, "No password changed");
        });

        it("canAuthenticateInitiallyFalse", function () {
            var vm = new authenticator.AuthenticatorViewModel();
            assert.ok(!vm.canAuthenticate, "Shouldn't be able to authenticate with no user/pass");
        });

        it("settingUsernameEnablesCanAuthenticate", function () {
            var vm = new authenticator.AuthenticatorViewModel();

            assert.ok(!vm.canAuthenticate, "Shouldn't be able to authenticate before we set a username");

            vm.username = "test";

            assert.ok(vm.canAuthenticate, "Authentication should be possible with a valid username");
        });

        it("allowUsernameIsInitiallyTrue", function () {
            var vm = new authenticator.AuthenticatorViewModel();
            assert.ok(vm.allowUsernameEntry, "Expceted to be able to enter the username");
        });

        it("allowUsernameRaisesChangeEvent", function () {
            var vm = new authenticator.AuthenticatorViewModel();
            assert.ok(vm.allowUsernameEntry, "Expceted to be able to enter the username");
            var allowUsernameEntryChangedEventRaised = false;

            vm.addEventListener("allowUsernameEntryChanged", function () {
                allowUsernameEntryChangedEventRaised = true;
            });

            vm.allowUsernameEntry = false;

            assert.ok(allowUsernameEntryChangedEventRaised, "Didn't get change event for username entry");
        });

        it("settingPasswordOnlyShouldn'tEnableAuthentication", function () {
            var vm = new authenticator.AuthenticatorViewModel();

            assert.ok(!vm.canAuthenticate, "Shouldn't be able to authenticate before we set a username");

            vm.password = "test";

            assert.ok(!vm.canAuthenticate, "Authentication shouldn't be possible with only a password");
        });

        it("settingUsernameAndPasswordShouldEnableAuthentication", function () {
            var vm = new authenticator.AuthenticatorViewModel();

            assert.ok(!vm.canAuthenticate, "Shouldn't be able to authenticate before we set a username");

            vm.username = "test";
            vm.password = "test";

            assert.ok(vm.canAuthenticate, "Authentication should be enabled");
        });

        it("settingNonStringUsernameDoesn'tEnableAuthentication", function () {
            var vm = new authenticator.AuthenticatorViewModel();

            assert.ok(!vm.canAuthenticate, "Shouldn't be able to authenticate before we set a username");

            vm.username = 1;

            assert.ok(!vm.canAuthenticate, "Authentication should be possible with an invalid");
        });

        it("passwordEntryDisabledOnCreation", function () {
            var vm = new authenticator.AuthenticatorViewModel();
            assert.ok(!vm.allowPasswordEntry, "Shouldn't be able to enter password with no user");
        });

        it("passwordEntryEnabledWhenUserSet", function () {
            var vm = new authenticator.AuthenticatorViewModel();
            assert.ok(!vm.allowPasswordEntry, "Shouldn't be able to enter password with no user");

            vm.username = "test";

            assert.ok(vm.allowPasswordEntry, "Should be able to enter password with a username");
        });

        it("canSuccessfullyAuthenticate", function () {
            var vm = new authenticator.AuthenticatorViewModel();

            vm.username = testCredentials.user;
            vm.password = testCredentials.password;

            return vm.authenticate().then(function () {
                assert.ok(true, "Expected to complete authentication");
            }, function () {
                assert.ok(false, "Didn't expect to fail authentication");
            }).then(cleanupExperienceHost);
        });

        it("canSaveCredentials", function () {
            authenticator.clearClientInformation();

            var vm = new authenticator.AuthenticatorViewModel();
            vm.username = testCredentials.user;
            vm.password = testCredentials.password;

            return vm.authenticate().then(function (tokenResult) {
                var clientInformation = Codevoid.Storyvoid.Authenticator.saveAccessToken(tokenResult);

                var tokenInformation = Windows.Storage.ApplicationData.current.localSettings.values[authenticator._tokenSettingInformation.root];
                assert.ok(clientInformation, "No client information");
                assert.ok(clientInformation.clientToken, "No token information");
                assert.ok(clientInformation.clientTokenSecret, "No secret information");

                assert.strictEqual(tokenInformation[authenticator._tokenSettingInformation.token], clientInformation.clientToken, "Token saved doesn't match the one from the service");
                assert.strictEqual(tokenInformation[authenticator._tokenSettingInformation.secret], clientInformation.clientTokenSecret, "Secret saved doesn't match the one from the service");

                authenticator.clearClientInformation();
            });
        });

        it("whenAuthenticatingIsWorkingIsTrueAndBecomesFalseWhenCompleted", function () {
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
                assert.ok(isWorkingBecameTrue, "Expected isWorking to have become true during authentication");
                assert.ok(canAuthenticateIsFalse, "Expected canAuthenticate to become false during authentication");
                assert.ok(allowPasswordEntryIsFalse, "Expected allowPasswordEntry to become false during authentication");
                assert.ok(allowUsernameEntryIsFalse, "Expected allowUsernameEntry to become false during authentication");
                assert.ok(!vm.isWorking, "Should have completed authentication");
                assert.ok(vm.canAuthenticate, "Should be able to authenticate again");
                assert.ok(vm.allowPasswordEntry, "Should be able to enter password again");
                assert.ok(vm.allowUsernameEntry, "Should be able to enter username again");
            }, function () {
                assert.ok(false, "Didn't expect to fail authentication");
            }).then(cleanupExperienceHost);
        });

        it("whenAuthenticatingIsWorkingIsTrueAndBecomesFalseWhenCompletedWithError", function () {
            var vm = new authenticator.AuthenticatorViewModel();
            var isWorkingBecameTrue = false;

            vm.addEventListener("isWorkingChanged", function () {
                if (vm.isWorking) {
                    isWorkingBecameTrue = true;
                }
            });

            return vm.authenticate().then(function () {
                assert.ok(false, "Expected to fail authentication");
            }, function () {
                assert.ok(!isWorkingBecameTrue, "Expected isWorking to not have become true during authentication");
                assert.ok(!vm.isWorking, "Should have completed authentication");
            });
        });

        it("canFailureToAuthenticateIsCorrectlyPropogated", function () {
            var vm = new authenticator.AuthenticatorViewModel();

            vm.username = testCredentials.user;
            vm.password = "foo";

            return vm.authenticate().then(function () {
                assert.ok(false, "Expected to complete authentication");
            }, function () {
                assert.strictEqual(vm.authenticationError, 401, "Expected auth error");
                assert.strictEqual(vm.authenticationErrorMessage, Codevoid.Storyvoid.Authenticator.friendlyMessageForError(401), "Wrong error message");
                assert.ok(true, "Didn't expect to fail authentication");
            });
        });

        it("authenticationErrorPropertyRaisesEvent", function () {
            var vm = new authenticator.AuthenticatorViewModel();
            var authenticationErrorChanged = false;
            vm.addEventListener("authenticationErrorChanged", function () {
                authenticationErrorChanged = true;
            });

            vm.authenticationError = 1;
            assert.ok(authenticationErrorChanged, "Authentication error didn't change");
        });

        it("authenticationErrorMessagePropertyRaisesEvent", function () {
            var vm = new authenticator.AuthenticatorViewModel();
            var authenticationErrorMessageChanged = false;
            vm.addEventListener("authenticationErrorMessageChanged", function () {
                authenticationErrorMessageChanged = true;
            });

            vm.authenticationError = 401;
            assert.ok(authenticationErrorMessageChanged, "Authentication error didn't change");
        });

        it("authenticationErrorIsResetWhenReauthenticating", function () {
            var vm = new authenticator.AuthenticatorViewModel();
            var authenticationErrorWasReset = false;
            var authenticationErrorMessageWasReset = false;

            vm.username = testCredentials.user;
            vm.password = "foo";

            return vm.authenticate().then(function () {
                assert.ok(false, "Expected to fails authentication");
            }, function () {
                assert.strictEqual(vm.authenticationError, 401, "Expected auth error");

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
                assert.ok(false, "shouldn't have succeeded");
            }, function () {
                assert.ok(authenticationErrorWasReset, "Should have been reset");
                assert.ok(authenticationErrorMessageWasReset, "message wasn't reset");
                assert.strictEqual(vm.authenticationError, 401, "Incorrect error code");
            });
        });
    });
})();