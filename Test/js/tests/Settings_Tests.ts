module CodevoidTests {
    import st = Windows.Storage;

    class SettingsTest extends Codevoid.Utilities.SettingsCore {
        constructor(name: string) {
            super(name, st.ApplicationData.current.localSettings);
        }

        public get name(): string {
            return this._containerName;
        }

        public get hasCreated(): boolean {
            return this.getValueOrDefault("hasCreated", true);
        }
    }

    function getSettings(name?: string): SettingsTest {
        var containerName = name || Date.now() + "";

        return new SettingsTest(containerName);
    }

    function settingsTest(name: string, testBody: (settings: SettingsTest) => void): void {
        test(name, () => {
            var containerName = Date.now() + "";
            var settings = new SettingsTest(containerName);

            try {
                testBody(settings);
            } finally {
                settings.removeAllSettings();
            }
        });
    }

    QUnit.module("SettingsCore");

    test("CanInstantiateWithoutCreatingContainer", () => {
        var containerName = Date.now() + "";
        var settings = new SettingsTest(containerName);
        notStrictEqual(settings, null, "Expected to create instance");

        var hasContainer = st.ApplicationData.current.localSettings.containers.hasKey(containerName);

        ok(!hasContainer, "Didn't expect container to be created");
    });

    settingsTest("ContainerCreatedOnPropertyAccess", (settings: SettingsTest) => {
        var value = settings.hasCreated;
        ok(value, "Setting returned in correctly");

        var containerExists = st.ApplicationData.current.localSettings.containers.hasKey(settings.name);
        ok(containerExists, "Container should have been created");
    });

    settingsTest("DefaultValueReturnedWhenValueNotSet", (settings: SettingsTest) => {
        ok(settings.hasCreated, "Expected default value");
    });

    settingsTest("StoredValueReturnedFromSettings", (settings: SettingsTest) => {
        var container = st.ApplicationData.current.localSettings.createContainer(settings.name, st.ApplicationDataCreateDisposition.always);
        container.values["hasCreated"] = false;

        ok(!settings.hasCreated, "Expected value to be false");
    });
}