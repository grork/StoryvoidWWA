module Codevoid.Utilities {
    import st = Windows.Storage;

    export abstract class SettingsCore {
        private _settingsContainer: st.ApplicationDataContainer;

        constructor(protected _containerName: string,
            private _parentContainer: st.ApplicationDataContainer,
            private _defaults: { [id: string]: any }) {
        }

        private get containerCreated(): boolean {
            return this._parentContainer.containers.hasKey(this._containerName);
        }

        private get container(): st.ApplicationDataContainer {
            if (!this._settingsContainer) {
                this._settingsContainer = this._parentContainer.createContainer(this._containerName, st.ApplicationDataCreateDisposition.always);
            }

            return this._settingsContainer;
        }

        protected getValueOrDefault<T>(name: string): T {
            if (!this.containerCreated) {
                return this._defaults[name];
            }

            var settingValue = this.container.values.lookup(name);
            
            // If value wasn't actually there, just return the
            // default value.
            if (settingValue == null) {
                return this._defaults[name];
            }

            return <T>settingValue;
        }

        protected setValue<T>(name: string, value: T): void {
            // Don't create the value if it's the same as the default, and the
            // container doesn't exist.
            if (!this.containerCreated && (this._defaults[name] == value)) {
                return;
            }

            this.container.values.insert(name, value);
        }

        protected clearValue(name: string): void {
            if (!this.containerCreated) {
                return;
            }

            this.container.values.remove(name);
        }

        public removeAllSettings(): void {
            if (!this.containerCreated) {
                return;
            }

            this._parentContainer.deleteContainer(this._containerName);
        }
    }
}