(function () {
    "use strict";

    function property(name, defaultValue) {
        var propertyName = "_" + name + "Storage";
        return {
            get: function property_getter() {
                if (!(propertyName in this)) {
                    return defaultValue;
                }

                return this[propertyName];
            },
            set: function property_setter(newValue) {
                var oldValue = this[name];
                if (oldValue === newValue) {
                    return;
                }

                this[propertyName] = newValue;
                this.dispatchEvent(name + "Changed", {
                    previous: oldValue,
                    current: newValue,
                });
            },
        };
    }

    var clientID = "PLACEHOLDER";
    var clientSecret = "PLACEHOLDER";

    var tokenInformationSettingName = "usertokens";
    var tokenSettingName = "token";
    var tokenSecretSettingName = "secret";

    WinJS.Namespace.define("Codevoid.Storyvoid.Authenticator", {
        _tokenSettingInformation: {
            root: tokenInformationSettingName,
            token: tokenSettingName,
            secret: tokenSecretSettingName,
        },
        applyUserAgentSettings: function applyUserAgentSettings(clientInformation) {
            var packageVersion = Windows.ApplicationModel.Package.current.id.version;
            var versionAsString = packageVersion.major + "." + packageVersion.minor + "." + packageVersion.build + "." + packageVersion.revision;

            clientInformation.productName = "Codevoid Storyvoid";
            clientInformation.productVersion = versionAsString;

            return clientInformation;
        },
        getStoredCredentials: function getStoredCredentials() {
            var store = Windows.Storage.ApplicationData.current.localSettings;
            var tokens = store.values[tokenInformationSettingName];
            
            if(tokens
                && tokens.hasKey(tokenSettingName)
                && tokens.hasKey(tokenSecretSettingName)) {
                return Codevoid.Storyvoid.Authenticator.applyUserAgentSettings(new Codevoid.OAuth.ClientInformation(clientID, clientSecret, tokens[tokenSettingName], tokens[tokenSecretSettingName]));
            }

            return null;
        },
        saveAccessToken: function saveAccessToken(tokenDetails) {
            var store = Windows.Storage.ApplicationData.current.localSettings;

            var userTokens = new Windows.Storage.ApplicationDataCompositeValue();
            userTokens[tokenSettingName] = tokenDetails.oauth_token;
            userTokens[tokenSecretSettingName] = tokenDetails.oauth_token_secret;
            store.values[tokenInformationSettingName] = userTokens;

            return Codevoid.Storyvoid.Authenticator.applyUserAgentSettings(new Codevoid.OAuth.ClientInformation(clientID, clientSecret, userTokens[tokenSettingName], userTokens[tokenSecretSettingName]));
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
                    message = "Looks like you've entered the wrong username, or password for Instapaper. Check them, and give it another try!";
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
                wwa: "Codevoid.Storyvoid.UI.Authenticator",
            },
            username: property("username", null),
            password: property("password", null),
            isWorking: property("isWorking", false),
            authenticationError: property("authenticationError", 0),
            authenticationErrorMessage: property("authenticationErrorMessage", ""),
            canAuthenticate: property("canAuthenticate", false),
            allowPasswordEntry: property("allowPasswordEntry", false),
            allowUsernameEntry: property("allowUsernameEntry", true),
            holdWorkingStateOnSuccess: false,
            credentialAcquisitionComplete: null,
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
            authenticate: function (minimumDuration) {
                // Reset authentication state
                this.authenticationError = 0;

                if (!this.canAuthenticate) {
                    return WinJS.Promise.wrapError(new Error("Expected Credentials to be supplied to allow authentication"));
                }

                var authenticationComplete = new Codevoid.Utilities.Signal();

                var clientInformation = Codevoid.Storyvoid.Authenticator.applyUserAgentSettings(new Codevoid.OAuth.ClientInformation(clientID, clientSecret));
                var accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

                this.isWorking = true;

                WinJS.Promise.join([
                    accounts.getAccessToken(this.username, this.password),
                    WinJS.Promise.timeout(minimumDuration || 0)
                ]).done(function (result) {
                    if (!this.holdWorkingStateOnSuccess) {
                        this.isWorking = false;
                    }

                    authenticationComplete.complete(result[0]);
                }.bind(this), function (errorResult) {
                    var err = errorResult[0];
                    this.isWorking = false;

                    this.authenticationError = err.status || 0;

                    authenticationComplete.error(err);
                }.bind(this));

                return authenticationComplete.promise;
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
                var message = Codevoid.Storyvoid.Authenticator.friendlyMessageForError(this.authenticationError);
                if (this.authenticationErrorMessage === message) {
                    return;
                }

                this.authenticationErrorMessage = message;
            },
            promptForCredentials: function promptForCredentials() {
                this.credentialAcquisitionComplete = new Codevoid.Utilities.Signal();
                Codevoid.UICore.Experiences.currentHost.addExperienceForModel(this);
                return this.credentialAcquisitionComplete.promise;
            },
        }), WinJS.Utilities.eventMixin),
    });
})();