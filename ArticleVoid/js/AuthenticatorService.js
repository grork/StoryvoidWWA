(function () {
    "use strict";
    var property = Codevoid.Utilities.property;

    var clientID = "PLACEHOLDER";
    var clientSecret = "PLACEHOLDER";

    var tokenInformationSettingName = "usertokens";
    var tokenSettingName = "token";
    var tokenSecretSettingName = "secret";

    WinJS.Namespace.define("Codevoid.ArticleVoid.Authenticator", {
        _tokenSettingInformation: {
            root: tokenInformationSettingName,
            token: tokenSettingName,
            secret: tokenSecretSettingName,
        },
        getClientInformation: function getClientInformation(overrideCredentials) {
            var store = Windows.Storage.ApplicationData.current.roamingSettings;
            var tokens = store.values[tokenInformationSettingName];
            
            if (tokens
                && tokens.hasKey(tokenSettingName)
                && tokens.hasKey(tokenSecretSettingName)) {
                return WinJS.Promise.as(new Codevoid.OAuth.ClientInfomation(clientID, clientSecret, tokens[tokenSettingName], tokens[tokenSecretSettingName]));
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

                return new Codevoid.OAuth.ClientInfomation(clientID, clientSecret, userTokens[tokenSettingName], userTokens[tokenSecretSettingName]);
            });
        },
        clearClientInformation: function clearClientInformation() {
            var storage = Windows.Storage.ApplicationData.current.roamingSettings;
            storage.values.remove(tokenInformationSettingName);
        },

        AuthenticatorViewModel: WinJS.Class.mix(WinJS.Class.define(function () {
            this._evaluateCanAuthenticate = this._evaluateCanAuthenticate.bind(this);
            this.addEventListener("usernameChanged", this._evaluateCanAuthenticate);
        }, {
            experience: {
                wwa: "Codevoid.ArticleVoid.UI.Authenticator",
            },
            username: property("username", null),
            password: property("password", null),
            isWorking: property("isWorking", false),
            authenticationError: property("authenticationFailed", 0),
            canAuthenticate: property("canAuthenticate", false),
            allowPasswordEntry: property("allowPasswordEntry", false),
            credentialAcquisitionComplete: null,
            _evaluateCanAuthenticate: function () {
                if (this.username && (typeof this.username === "string")) {
                    this.canAuthenticate = true;
                    this.allowPasswordEntry = true;
                } else {
                    this.canAuthenticate = false;
                    this.allowPasswordEntry = false;
                }
            },
            authenticate: function () {
                var accounts = new Codevoid.ArticleVoid.InstapaperApi.Accounts(new Codevoid.OAuth.ClientInfomation(clientID, clientSecret));
                var tokenPromise = WinJS.Promise.as();
                var didPrompt = false;

                if (!this.canAuthenticate) {
                    tokenPromise = this.promptForCredentials();
                    didPrompt = true;
                }

                return tokenPromise.then(function () {
                    this.isWorking = true;
                    return accounts.getAccessToken(this.username, this.password);
                }.bind(this)).then(function (result) {
                    if (didPrompt) {
                        Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this);
                    }

                    this.isWorking = false;
                    return result;
                }.bind(this), function (err) {
                    this.isWorking = false;

                    if (err === Codevoid.ArticleVoid.Authenticator.AuthenticatorViewModel.Cancelled) {
                        if (didPrompt) {
                            Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this);
                        }
                    } else {
                        this.authenticationError = err.status;
                    }

                    return WinJS.Promise.wrapError(err);
                }.bind(this));
            },
            promptForCredentials: function promptForCredentials() {
                this.credentialAcquisitionComplete = new Codevoid.Utilities.Signal();
                Codevoid.UICore.Experiences.currentHost.addExperienceForModel(this);
                return this.credentialAcquisitionComplete.promise;
            },
        }, {
            Cancelled: { cancelled: true },
        }), WinJS.Utilities.eventMixin),
    });
})();