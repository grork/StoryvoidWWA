﻿(function () {
    "use strict";
    var property = Codevoid.Utilities.property;

    var clientID = "Uzf6U3vHqc7vcMUKSj7JpYvungTSjQVEoyfyJtYtHdX6wWQ05J";
    var clientSecret = "z4KurzIZ21NFJgFopHRqObIjNEHe5uFECBzpjQ809oFNbxi0lm";

    var tokenInformationSettingName = "usertokens";
    var tokenSettingName = "token";
    var tokenSecretSettingName = "secret";

    WinJS.Namespace.define("Codevoid.ArticleVoid.Authenticator", {
        _tokenSettingInformation: {
            root: tokenInformationSettingName,
            token: tokenSettingName,
            secret: tokenSecretSettingName,
        },
        applyUserAgentSettings: function applyUserAgentSettings(clientInformation) {
            var packageVersion = Windows.ApplicationModel.Package.current.id.version;
            var versionAsString = packageVersion.major + "." + packageVersion.minor + "." + packageVersion.build + "." + packageVersion.revision;

            clientInformation.productName = "Codevoid ArticleVoid";
            clientInformation.productVersion = versionAsString;

            return clientInformation;
        },
        getStoredCredentials: function getStoredCredentials() {
            var store = Windows.Storage.ApplicationData.current.localSettings;
            var tokens = store.values[tokenInformationSettingName];
            
            if(tokens
                && tokens.hasKey(tokenSettingName)
                && tokens.hasKey(tokenSecretSettingName)) {
                return Codevoid.ArticleVoid.Authenticator.applyUserAgentSettings(new Codevoid.OAuth.ClientInformation(clientID, clientSecret, tokens[tokenSettingName], tokens[tokenSecretSettingName]));
            }

            return null;
        },
        getClientInformation: function getClientInformation(overrideCredentials) {
            var store = Windows.Storage.ApplicationData.current.localSettings;
            
            var storedCredentials = Codevoid.ArticleVoid.Authenticator.getStoredCredentials();
            if (storedCredentials) {
                return WinJS.Promise.as(storedCredentials);
            }

            var authenticator = new Codevoid.ArticleVoid.Authenticator.AuthenticatorViewModel();
            if (overrideCredentials) {
                authenticator.username = overrideCredentials.user;
                authenticator.password = overrideCredentials.password;
            }

            return authenticator.authenticate().then(function (result) {
                var userTokens = new Windows.Storage.ApplicationDataCompositeValue();
                userTokens[tokenSettingName] = result.oauth_token;
                userTokens[tokenSecretSettingName] = result.oauth_token_secret;
                store.values[tokenInformationSettingName] = userTokens;

                return new Codevoid.ArticleVoid.Authenticator.applyUserAgentSettings(new Codevoid.OAuth.ClientInformation(clientID, clientSecret, userTokens[tokenSettingName], userTokens[tokenSecretSettingName]));
            });
        },
        clearClientInformation: function clearClientInformation() {
            var storage = Windows.Storage.ApplicationData.current.localSettings;
            storage.values.remove(tokenInformationSettingName);
        },
        friendlyMessageForError: function (code) {
            var message = "";
            switch (code) {
                case 0:
                    message = "";
                    break;

                case 401:
                    message = "Looks like you've type the wrong username, or password for Instapaper. Check them, and give it another try!";
                    break;

                case 402:
                    message = "You don't appear to be an Instapaper Subscriber, which you need to be to use your account on non-iOS devices. Sorry :(";
                    break;

                default:
                    message = "Uh oh! Something went wrong, and we're not sure what. Give it a few moments, check your username & password, and try again. If it still doesn't work,  please contact us and mention error code: '" + code + "'";
                    break;
            }

            return message;
        },

        AuthenticatorViewModel: WinJS.Class.mix(WinJS.Class.define(function () {
            this._evaluateCanAuthenticate = this._evaluateCanAuthenticate.bind(this);
            this._isWorkingChanged = this._isWorkingChanged.bind(this);
            this._authenticationErrorChanged = this._authenticationErrorChanged.bind(this);
            this.addEventListener("usernameChanged", this._evaluateCanAuthenticate);
            this.addEventListener("isWorkingChanged", this._isWorkingChanged);
            this.addEventListener("authenticationErrorChanged", this._authenticationErrorChanged);
        }, {
            experience: {
                wwa: "Codevoid.ArticleVoid.UI.Authenticator",
            },
            username: property("username", null),
            password: property("password", null),
            isWorking: property("isWorking", false),
            authenticationError: property("authenticationError", 0),
            authenticationErrorMessage: property("authenticationErrorMessage", ""),
            canAuthenticate: property("canAuthenticate", false),
            allowPasswordEntry: property("allowPasswordEntry", false),
            allowUsernameEntry: property("allowUsernameEntry", true),
            credentialAcquisitionComplete: null,
            _authenticationComplete: null,
            _evaluateCanAuthenticate: function () {
                this.allowUsernameEntry = true;

                if (this.username && ((typeof this.username) === "string")) {
                    this.canAuthenticate = true;
                    this.allowPasswordEntry = true;
                } else {
                    this.canAuthenticate = false;
                    this.allowPasswordEntry = false;
                }
            },
            _tryAuthenticate: function (credentialPromise, retry) {
                var clientInformation = Codevoid.ArticleVoid.Authenticator.applyUserAgentSettings(new Codevoid.OAuth.ClientInformation(clientID, clientSecret));
                var accounts = new Codevoid.ArticleVoid.InstapaperApi.Accounts(clientInformation);

                credentialPromise.then(function () {
                    this.isWorking = true;
                    return accounts.getAccessToken(this.username, this.password);
                }.bind(this)).done(function (result) {
                    Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this);
                    this.isWorking = false;

                    this._authenticationComplete.complete(result);
                }.bind(this), function (err) {
                    this.isWorking = false;

                    // Cancelled
                    if (err && (err.name === "Canceled")) {
                        Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this);
                        this._authenticationComplete.promise.cancel();
                        return;
                    }

                    this.authenticationError = err.status || 0;

                    // Retry
                    if (!retry) {
                        this._authenticationComplete.error(err);
                        Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this);
                        return;
                    }

                    this._tryAuthenticate(this.promptForCredentials(), retry);
                }.bind(this));
            },
            _isWorkingChanged: function () {
                if (this.isWorking) {
                    this.canAuthenticate = false;
                    this.allowPasswordEntry = false;
                    this.allowUsernameEntry = false;
                } else {
                    this._evaluateCanAuthenticate();
                }
            },
            _authenticationErrorChanged: function () {
                var message = Codevoid.ArticleVoid.Authenticator.friendlyMessageForError(this.authenticationError);
                if (this.authenticationErrorMessage === message) {
                    return;
                }

                this.authenticationErrorMessage = message;
            },
            authenticate: function (retry) {
                // Reset authentication state
                this.authenticationError = 0;

                this._authenticationComplete = new Codevoid.Utilities.Signal();
                var credentialPromise = WinJS.Promise.as();

                if (!this.canAuthenticate) {
                    credentialPromise = this.promptForCredentials();
                }

                this._tryAuthenticate(credentialPromise, retry);

                return this._authenticationComplete.promise;
            },
            promptForCredentials: function promptForCredentials() {
                this.credentialAcquisitionComplete = new Codevoid.Utilities.Signal();
                Codevoid.UICore.Experiences.currentHost.addExperienceForModel(this);
                return this.credentialAcquisitionComplete.promise;
            },
        }), WinJS.Utilities.eventMixin),
    });
})();