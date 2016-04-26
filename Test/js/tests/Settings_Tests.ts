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

        public get otherProperty(): string {
            return this.getValueOrDefault("otherProperty", null);
        }

        public set otherProperty(value: string) {
            this.setValue("otherProperty", value);
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

    settingsTest("ContainerCreatedOnPropertyAccess", (settings) => {
        var value = settings.hasCreated;
        ok(value, "Setting returned in correctly");

        var containerExists = st.ApplicationData.current.localSettings.containers.hasKey(settings.name);
        ok(containerExists, "Container should have been created");
    });

    settingsTest("DefaultValueReturnedWhenValueNotSet", (settings) => {
        ok(settings.hasCreated, "Expected default value");
    });

    settingsTest("StoredValueReturnedFromSettings", (settings) => {
        var container = st.ApplicationData.current.localSettings.createContainer(settings.name, st.ApplicationDataCreateDisposition.always);
        container.values["hasCreated"] = false;

        ok(!settings.hasCreated, "Expected value to be false");
    });

    settingsTest("ValueCanBeStoredAndRetrieved", (settings) => {
        var now = Date.now() + "";

        settings.otherProperty = now;

        var container = st.ApplicationData.current.localSettings.createContainer(settings.name, st.ApplicationDataCreateDisposition.always);
        strictEqual(container.values["otherProperty"], now, "Saved Value differs");
        strictEqual(settings.otherProperty, now, "Retreived value differs");
    });

    settingsTest("ValueCanBeStoredSecondTime", (settings) => {
        var now = Date.now() + "";

        settings.otherProperty = now;

        var container = st.ApplicationData.current.localSettings.createContainer(settings.name, st.ApplicationDataCreateDisposition.always);
        strictEqual(container.values["otherProperty"], now, "Saved Value differs");
        strictEqual(settings.otherProperty, now, "Retreived value differs");

        now = (Date.now() + 10) + "";
        settings.otherProperty = now;
        strictEqual(settings.otherProperty, now, "Second written value incorrect");
    });
}