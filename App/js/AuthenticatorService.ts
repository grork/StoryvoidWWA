namespace Codevoid.Storyvoid.Authenticator {
    const clientID = "PLACEHOLDER";
    const clientSecret = "PLACEHOLDER";

    const tokenInformationSettingName = "usertokens";
    const tokenSettingName = "token";
    const tokenSecretSettingName = "secret";

    export const _tokenSettingInformation = {
        root: tokenInformationSettingName,
        token: tokenSettingName,
        secret: tokenSecretSettingName,
    };

    export function applyUserAgentSettings(clientInformation: Codevoid.OAuth.ClientInformation): Codevoid.OAuth.ClientInformation {
        var packageVersion = Windows.ApplicationModel.Package.current.id.version;
        var versionAsString = packageVersion.major + "." + packageVersion.minor + "." + packageVersion.build + "." + packageVersion.revision;

        clientInformation.productName = "Codevoid Storyvoid";
        clientInformation.productVersion = versionAsString;

        return clientInformation;
    }

    export function getStoredCredentials(): Codevoid.OAuth.ClientInformation {
        const store = Windows.Storage.ApplicationData.current.localSettings;
        const tokens = store.values[tokenInformationSettingName];

        if (tokens
            && tokens.hasKey(tokenSettingName)
            && tokens.hasKey(tokenSecretSettingName)) {
            return Codevoid.Storyvoid.Authenticator.applyUserAgentSettings(new Codevoid.OAuth.ClientInformation(clientID, clientSecret, tokens[tokenSettingName], tokens[tokenSecretSettingName]));
        }

        return null;
    }

    export function saveAccessToken(tokenDetails: Codevoid.Storyvoid.InstapaperApi.IAccessTokenInformation): Codevoid.OAuth.ClientInformation {
        const store = Windows.Storage.ApplicationData.current.localSettings;
        const userTokens = new Windows.Storage.ApplicationDataCompositeValue();

        userTokens[tokenSettingName] = tokenDetails.oauth_token;
        userTokens[tokenSecretSettingName] = tokenDetails.oauth_token_secret;
        store.values[tokenInformationSettingName] = userTokens;

        return Codevoid.Storyvoid.Authenticator.applyUserAgentSettings(new Codevoid.OAuth.ClientInformation(clientID, clientSecret, userTokens[tokenSettingName], userTokens[tokenSecretSettingName]));
    }

    export function clearClientInformation(): void {
        const storage = Windows.Storage.ApplicationData.current.localSettings;
        storage.values.remove(tokenInformationSettingName);
    }

    export function friendlyMessageForError(code: number): string {
        let message = "";
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
    }

    export class AuthenticatorViewModel extends Codevoid.Utilities.EventSource implements Codevoid.UICore.ViewModel {
        public readonly experience = { wwa: "Codevoid.Storyvoid.UI.Authenticator" };
        private _username: string = null;
        private _password: string = null;
        private _isWorking: boolean = false
        private _authenticationError: number = 0;
        private _authenticationErrorMessage: string = "";
        private _canAuthenticate: boolean = false;
        private _allowPasswordEntry: boolean = false;
        private _allowUsernameEntry: boolean = true;
        public holdWorkingStateOnSuccess: boolean = false
        public credentialAcquisitionComplete: Codevoid.Utilities.Signal;

        constructor() {
            super();

            Codevoid.Utilities.addEventListeners(this, {
                usernameChanged: this._evaluateCanAuthenticate.bind(this),
                isWorkingChanged: this._isWorkingChanged.bind(this),
                authenticationErrorChanged: this._authenticationErrorChanged.bind(this)
            });
        }

        //#region Property Accessors
        public get username(): string {
            return this._username;
        }

        public set username(value: string) {
            this.setValue("username", value);
        }

        public get password(): string {
            return this._password;
        }

        public set password(value: string) {
            this.setValue("password", value);
        }

        public get isWorking(): boolean {
            return this._isWorking;
        }

        public set isWorking(value: boolean) {
            this.setValue("isWorking", value);
        }

        public get authenticationError(): number {
            return this._authenticationError;
        }

        public set authenticationError(value: number) {
            this.setValue("authenticationError", value);
        }

        public get authenticationErrorMessage(): string {
            return this._authenticationErrorMessage;
        }

        public set authenticationErrorMessage(value: string) {
            this.setValue("authenticationErrorMessage", value);
        }

        public get canAuthenticate(): boolean {
            return this._canAuthenticate;
        }

        public set canAuthenticate(value: boolean) {
            this.setValue("canAuthenticate", value);
        }

        public get allowPasswordEntry(): boolean {
            return this._allowPasswordEntry;
        }

        public set allowPasswordEntry(value: boolean) {
            this.setValue("allowPasswordEntry", value);
        }

        public get allowUsernameEntry(): boolean {
            return this._allowUsernameEntry;
        }

        public set allowUsernameEntry(value: boolean) {
            this.setValue("allowUsernameEntry", value);
        }
        //#endregion
        
        private setValue<T>(name: string, newValue: T): void {
            const propertyName = `_${name}`;
            const oldValue = this[name];
            if (oldValue === newValue) {
                return;
            }

            this[propertyName] = newValue;
            this.dispatchEvent(`${name}Changed`, {
                previous: oldValue,
                current: newValue,
            });
        }

        private _evaluateCanAuthenticate(): void {
            this.allowUsernameEntry = true;

            if (this.username && ((typeof this.username) === "string")) {
                this.canAuthenticate = true;
                this.allowPasswordEntry = true;
            } else {
                this.canAuthenticate = false;
                this.allowPasswordEntry = false;
            }
        }

        private _isWorkingChanged() {
            if (this.isWorking) {
                this.canAuthenticate = false;
                this.allowPasswordEntry = false;
                this.allowUsernameEntry = false;
            } else {
                this._evaluateCanAuthenticate();
            }
        }

        private _authenticationErrorChanged() {
            const message = Codevoid.Storyvoid.Authenticator.friendlyMessageForError(this.authenticationError);
            if (this.authenticationErrorMessage === message) {
                return;
            }

            this.authenticationErrorMessage = message;
        }

        public async authenticate(minimumDuration?: number): Promise<InstapaperApi.IAccessTokenInformation> {
            // Reset authentication state
            this.authenticationError = 0;

            if (!this.canAuthenticate) {
                return Promise.reject(new Error("Expected Credentials to be supplied to allow authentication"));
            }

            const authenticationComplete = new Codevoid.Utilities.Signal();
            const clientInformation = Codevoid.Storyvoid.Authenticator.applyUserAgentSettings(new Codevoid.OAuth.ClientInformation(clientID, clientSecret));
            const accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

            this.isWorking = true;

            try {
                const [token, _] = await Promise.all([
                    accounts.getAccessToken(this.username, this.password),
                    Codevoid.Utilities.timeout(minimumDuration || 0)
                ]);

                if (!this.holdWorkingStateOnSuccess) {
                    this.isWorking = false;
                }

                authenticationComplete.complete(token);
            } catch(errorResult) {
                this.isWorking = false;
                this.authenticationError = errorResult.status || 0;
                authenticationComplete.error(errorResult);
            }

            return await authenticationComplete.promise;
        }

        public async promptForCredentials(): Promise<Codevoid.Storyvoid.InstapaperApi.IAccessTokenInformation> {
            this.credentialAcquisitionComplete = new Codevoid.Utilities.Signal();
            Codevoid.UICore.Experiences.currentHost.addExperienceForModel(this);
            return await this.credentialAcquisitionComplete.promise;
        }
    }

    export interface IAuthenticatorPropertyChanged<T> {
        readonly previous: T;
        readonly current: T;
    }

    export interface AuthenticatorViewModel {
        addEventListener(name: "passwordChanged", handler: (eventData: Utilities.EventObject<IAuthenticatorPropertyChanged<string>>) => any, useCapture?: boolean): void;
        addEventListener(name: "usernameChanged", handler: (eventData: Utilities.EventObject<IAuthenticatorPropertyChanged<string>>) => any, useCapture?: boolean): void;
        addEventListener(name: "allowUsernameEntryChanged", handler: (eventData: Utilities.EventObject<IAuthenticatorPropertyChanged<boolean>>) => any, useCapture?: boolean): void;
        addEventListener(name: "isWorkingChanged", handler: (eventData: Utilities.EventObject<IAuthenticatorPropertyChanged<boolean>>) => any, useCapture?: boolean): void;
        addEventListener(name: "authenticationErrorChanged", handler: (eventData: Utilities.EventObject<IAuthenticatorPropertyChanged<number>>) => any, useCapture?: boolean): void;
        addEventListener(name: "authenticationErrorMessageChanged", handler: (eventData: Utilities.EventObject<IAuthenticatorPropertyChanged<string>>) => any, useCapture?: boolean): void;
    }
}