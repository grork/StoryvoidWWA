namespace CodevoidTests {
    "use strict";

    import Signal = Codevoid.Utilities.Signal;
    import getPlayground = InstapaperTestUtilities.getPlayground;
    import cleanupExperienceHost = InstapaperTestUtilities.cleanupExperienceHost;
    import authenticator = Codevoid.Storyvoid.Authenticator;
    const testCredentials = {
        user: CodevoidTests.INSTAPAPER_ACCOUNT,
        password: CodevoidTests.INSTAPAPER_PASSWORD
    };

    class AuthenticatorTestUI {
        public wasPrompted = true;
        public tryCount: number = 0;
        public viewModel: authenticator.AuthenticatorViewModel;

        constructor(container: any, options: any) {
            WinJS.UI.setOptions(this, options);

            this.again();
        }

        public async again(): Promise<void> {
            this.tryCount++;
            await Codevoid.Utilities.timeout();

            const creds = AuthenticatorTestUI.credentialsToUse;
            if (!creds) {
                this.viewModel.credentialAcquisitionComplete.error({});
            } else if (creds === -1) {
                this.viewModel.credentialAcquisitionComplete.cancel();
            } else {
                this.viewModel.username = creds.username;
                this.viewModel.password = creds.password;
                this.viewModel.credentialAcquisitionComplete.complete();
            }
        }

        private static credStore: any;
        static get credentialsToUse(): any {
            let creds = AuthenticatorTestUI.credStore;

            if (Array.isArray(AuthenticatorTestUI.credStore)) {
                creds = AuthenticatorTestUI.credStore.shift();
            } else {
                AuthenticatorTestUI.credStore = null;
            }

            return creds;
        }

        static set credentialsToUse(value: any) {
            debugger;
            AuthenticatorTestUI.credStore = value;
        }
    }

    describe("Authenticator", () => {
        it("settingsReturnedFromStorage", () => {
            const fakeToken = "fakeToken";
            const fakeSecret = "fakeSecret";

            const settings = new authenticator.AuthenticationSettings();
            settings.token = fakeToken;
            settings.secret = fakeSecret;

            const clientInformation = authenticator.getStoredCredentials();
            assert.ok(clientInformation, "Didn't get client information");

            assert.strictEqual(clientInformation.clientToken, fakeToken, "Incorrect token");
            assert.strictEqual(clientInformation.clientTokenSecret, fakeSecret, "Incorrect secret");
        });

        it("settingsCanBeCleared", () => {
            const fakeToken = "fakeToken";
            const fakeSecret = "fakeSecret";

            const settings = new authenticator.AuthenticationSettings();
            settings.token = fakeToken;
            settings.secret = fakeSecret;

            authenticator.clearClientInformation();

            assert.ok(!settings.token && !settings.secret, "Shouldn't find settings");
        });
    });

    describe("AuthenticatorViewModel", () => {
        afterEach(cleanupExperienceHost);
        it("canInstantiateViewModel", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            assert.ok(vm, "No view model created");
        });

        it("changingPasswordRaisesEvent", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            let eventRaised = false;

            vm.addEventListener("passwordChanged", () => eventRaised = true);
            vm.password = "test";

            assert.ok(eventRaised, "No password changed");
        });

        it("changingUsernameRaisesEvent", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            let eventRaised = false;

            vm.addEventListener("usernameChanged", () => eventRaised = true);
            vm.username = "test";

            assert.ok(eventRaised, "No password changed");
        });

        it("canAuthenticateInitiallyFalse", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            assert.ok(!vm.canAuthenticate, "Shouldn't be able to authenticate with no user/pass");
        });

        it("settingUsernameEnablesCanAuthenticate", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            assert.ok(!vm.canAuthenticate, "Shouldn't be able to authenticate before we set a username");

            vm.username = "test";
            assert.ok(vm.canAuthenticate, "Authentication should be possible with a valid username");
        });

        it("allowUsernameIsInitiallyTrue", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            assert.ok(vm.allowUsernameEntry, "Expceted to be able to enter the username");
        });

        it("allowUsernameRaisesChangeEvent", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            assert.ok(vm.allowUsernameEntry, "Expceted to be able to enter the username");
            let allowUsernameEntryChangedEventRaised = false;

            vm.addEventListener("allowUsernameEntryChanged", () => allowUsernameEntryChangedEventRaised = true);
            vm.allowUsernameEntry = false;

            assert.ok(allowUsernameEntryChangedEventRaised, "Didn't get change event for username entry");
        });

        it("settingPasswordOnlyShouldn'tEnableAuthentication", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            assert.ok(!vm.canAuthenticate, "Shouldn't be able to authenticate before we set a username");

            vm.password = "test";
            assert.ok(!vm.canAuthenticate, "Authentication shouldn't be possible with only a password");
        });

        it("settingUsernameAndPasswordShouldEnableAuthentication", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            assert.ok(!vm.canAuthenticate, "Shouldn't be able to authenticate before we set a username");

            vm.username = "test";
            vm.password = "test";
            
            assert.ok(vm.canAuthenticate, "Authentication should be enabled");
        });

        it("settingNonStringUsernameDoesn'tEnableAuthentication", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            assert.ok(!vm.canAuthenticate, "Shouldn't be able to authenticate before we set a username");

            vm.username = <any>1;
            assert.ok(!vm.canAuthenticate, "Authentication should be possible with an invalid");
        });

        it("passwordEntryDisabledOnCreation", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            assert.ok(!vm.allowPasswordEntry, "Shouldn't be able to enter password with no user");
        });

        it("passwordEntryEnabledWhenUserSet", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            assert.ok(!vm.allowPasswordEntry, "Shouldn't be able to enter password with no user");

            vm.username = "test";
            assert.ok(vm.allowPasswordEntry, "Should be able to enter password with a username");
        });

        it("canSuccessfullyAuthenticate", () => {
            const vm = new authenticator.AuthenticatorViewModel();

            vm.username = testCredentials.user;
            vm.password = testCredentials.password;

            return vm.authenticate();
        });

        it("canSaveCredentials", async () => {
            authenticator.clearClientInformation();

            const vm = new authenticator.AuthenticatorViewModel();
            vm.username = testCredentials.user;
            vm.password = testCredentials.password;

            const tokenResult = await vm.authenticate();
            const clientInformation = Codevoid.Storyvoid.Authenticator.saveAccessToken(tokenResult);
            const tokenInformation = new authenticator.AuthenticationSettings();

            assert.ok(clientInformation, "No client information");
            assert.ok(clientInformation.clientToken, "No token information");
            assert.ok(clientInformation.clientTokenSecret, "No secret information");

            assert.strictEqual(tokenInformation.token, clientInformation.clientToken, "Token saved doesn't match the one from the service");
            assert.strictEqual(tokenInformation.secret, clientInformation.clientTokenSecret, "Secret saved doesn't match the one from the service");

            authenticator.clearClientInformation();
        });

        it("whenAuthenticatingIsWorkingIsTrueAndBecomesFalseWhenCompleted", async () => {
            const vm = new authenticator.AuthenticatorViewModel();
            let isWorkingBecameTrue = false;
            let canAuthenticateIsFalse = false;
            let allowPasswordEntryIsFalse = false;
            let allowUsernameEntryIsFalse = false;

            vm.addEventListener("isWorkingChanged", () => {
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

            await vm.authenticate();
            assert.ok(isWorkingBecameTrue, "Expected isWorking to have become true during authentication");
            assert.ok(canAuthenticateIsFalse, "Expected canAuthenticate to become false during authentication");
            assert.ok(allowPasswordEntryIsFalse, "Expected allowPasswordEntry to become false during authentication");
            assert.ok(allowUsernameEntryIsFalse, "Expected allowUsernameEntry to become false during authentication");
            assert.ok(!vm.isWorking, "Should have completed authentication");
            assert.ok(vm.canAuthenticate, "Should be able to authenticate again");
            assert.ok(vm.allowPasswordEntry, "Should be able to enter password again");
            assert.ok(vm.allowUsernameEntry, "Should be able to enter username again");
        });

        it("whenAuthenticatingIsWorkingIsTrueAndBecomesFalseWhenCompletedWithError", async () => {
            const vm = new authenticator.AuthenticatorViewModel();
            let isWorkingBecameTrue = false;

            vm.addEventListener("isWorkingChanged", () => {
                if (vm.isWorking) {
                    isWorkingBecameTrue = true;
                }
            });

            try {
                await vm.authenticate();
                assert.ok(false, "Expected to fail authentication");
            } catch (e) {
                assert.ok(!isWorkingBecameTrue, "Expected isWorking to not have become true during authentication");
                assert.ok(!vm.isWorking, "Should have completed authentication");
            }
        });

        it("canFailureToAuthenticateIsCorrectlyPropagated", async () => {
            const vm = new authenticator.AuthenticatorViewModel();

            vm.username = testCredentials.user;
            vm.password = "foo";

            try {
                await vm.authenticate();
                assert.ok(false, "Expected to complete authentication");
            } catch(e) {
                assert.strictEqual(vm.authenticationError, 401, "Expected auth error");
                assert.strictEqual(vm.authenticationErrorMessage, Codevoid.Storyvoid.Authenticator.friendlyMessageForError(401), "Wrong error message");
                assert.ok(true, "Didn't expect to fail authentication");
            }
        });

        it("authenticationErrorPropertyRaisesEvent", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            let authenticationErrorChanged = false;
            vm.addEventListener("authenticationErrorChanged", () => authenticationErrorChanged = true);
            vm.authenticationError = 1;

            assert.ok(authenticationErrorChanged, "Authentication error didn't change");
        });

        it("authenticationErrorMessagePropertyRaisesEvent", () => {
            const vm = new authenticator.AuthenticatorViewModel();
            let authenticationErrorMessageChanged = false;
            vm.addEventListener("authenticationErrorMessageChanged", () => authenticationErrorMessageChanged = true);
            vm.authenticationError = 401;

            assert.ok(authenticationErrorMessageChanged, "Authentication error didn't change");
        });

        it("authenticationErrorIsResetWhenReauthenticating", async () => {
            const vm = new authenticator.AuthenticatorViewModel();
            let authenticationErrorWasReset = false;
            let authenticationErrorMessageWasReset = false;

            vm.username = testCredentials.user;
            vm.password = "foo";

            try {
                await vm.authenticate();
                assert.ok(false, "Expected to fails authentication");
            } catch (e) {
                assert.strictEqual(vm.authenticationError, 401, "Expected auth error");

                vm.addEventListener("authenticationErrorChanged", () => {
                    if (vm.authenticationError === 0) {
                        authenticationErrorWasReset = true;
                        if (!vm.authenticationErrorMessage) {
                            authenticationErrorMessageWasReset = true;
                        }
                    }
                });
            }

            try {
                await vm.authenticate()
                assert.ok(false, "shouldn't have succeeded");
            } catch(e) {
                assert.ok(authenticationErrorWasReset, "Should have been reset");
                assert.ok(authenticationErrorMessageWasReset, "message wasn't reset");
                assert.strictEqual(vm.authenticationError, 401, "Incorrect error code");
            }
        });
    });
}