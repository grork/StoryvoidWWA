module Codevoid.Utilities {
    import st = Windows.Storage;

    export abstract class SettingsCore {
        private _settingsContainer: st.ApplicationDataContainer;

        constructor(protected _containerName: string,
                    private _parentContainer: st.ApplicationDataContainer) {
        }

        private get container(): st.ApplicationDataContainer {
            if (!this._settingsContainer) {
                this._settingsContainer = this._parentContainer.createContainer(this._containerName, st.ApplicationDataCreateDisposition.always);
            }

            return this._settingsContainer;
        }

        protected getValueOrDefault<T>(name: string, defaultValue: T): T {
            var settingValue = this.container.values.lookup(name);
            
            // If value wasn't actually there, just return the
            // default value.
            if (settingValue == null) {
                return defaultValue;
            }

            return settingValue;
        }

        public removeAllSettings(): void {
            if (!this._settingsContainer) {
                return;
            }

            this._parentContainer.deleteContainer(this._settingsContainer.name);
        }
    }
}