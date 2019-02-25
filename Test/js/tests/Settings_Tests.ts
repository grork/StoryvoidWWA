/// <reference path="..\..\..\app\js\SettingsCore.ts" />
namespace CodevoidTests {
    import st = Windows.Storage;
    const SETTINGS_CONTEXT_KEY = "settings";

    class SettingsTest extends Codevoid.Utilities.SettingsCore {
        constructor(name: string) {
            super(name, st.ApplicationData.current.localSettings, {
                hasCreated: true,
                otherProperty: null,
            });
        }

        public get name(): string {
            return this._containerName;
        }

        public get hasCreated(): boolean {
            return this.getValueOrDefault<boolean>("hasCreated");
        }

        public set hasCreated(value: boolean) {
            this.setValue("hasCreated", value);
        }

        public get otherProperty(): string {
            return this.getValueOrDefault<string>("otherProperty");
        }

        public set otherProperty(value: string) {
            this.setValue("otherProperty", value);
        }

        public clearOtherProperty(): void {
            this.clearValue("otherProperty");
        }
    }

    function settingsWrapper(testWork: (settings: SettingsTest) => void) : Mocha.Func {
        return function() {
            let settings: SettingsTest = this[SETTINGS_CONTEXT_KEY];
            testWork(settings);
        };
    }

    describe("SettingsCore", function () {

        it("CanInstantiateWithoutCreatingContainer", () => {
            var containerName = Date.now() + "";
            var settings = new SettingsTest(containerName);
            assert.notStrictEqual(settings, null, "Expected to create instance");

            var hasContainer = st.ApplicationData.current.localSettings.containers.hasKey(containerName);

            assert.ok(!hasContainer, "Didn't expect container to be created");
        });

        describe("Using Settings", function () {
            beforeEach(function () {
                var containerName = Date.now() + "";
                var settings = new SettingsTest(containerName);

                this.currentTest.ctx[SETTINGS_CONTEXT_KEY] = settings;
            });

            afterEach(function () {
                let settings: SettingsTest = this.currentTest.ctx[SETTINGS_CONTEXT_KEY];
                if (settings) {
                    settings.removeAllSettings();
                    this.currentTest.ctx[SETTINGS_CONTEXT_KEY] = null;
                }
            });

            it("ContainerNotCreatedOnPropertyRead", settingsWrapper((settings) => {
                var value = settings.hasCreated;
                assert.ok(value, "Setting returned incorrectly");

                var containerExists = st.ApplicationData.current.localSettings.containers.hasKey(settings.name);
                assert.ok(!containerExists, "Container should have been created");
            }));

            it("ContainerNotCreatedOnWritingValueSameAsDefault", settingsWrapper((settings) => {
                var value = settings.hasCreated;
                assert.ok(value, "Setting returned incorrectly");

                settings.hasCreated = true;

                var containerExists = st.ApplicationData.current.localSettings.containers.hasKey(settings.name);
                assert.ok(!containerExists, "Container should have been created");
            }));

            it("DefaultValueReturnedWhenValueNotSet", settingsWrapper((settings) => {
                assert.ok(settings.hasCreated, "Expected default value");
            }));

            it("StoredValueReturnedFromSettings", settingsWrapper((settings) => {
                var container = st.ApplicationData.current.localSettings.createContainer(settings.name, st.ApplicationDataCreateDisposition.always);
                container.values["hasCreated"] = false;

                assert.ok(!settings.hasCreated, "Expected value to be false");
            }));

            it("ValueCanBeStoredAndRetrieved", settingsWrapper((settings) => {
                var now = Date.now() + "";

                settings.otherProperty = now;

                var container = st.ApplicationData.current.localSettings.createContainer(settings.name, st.ApplicationDataCreateDisposition.always);
                assert.strictEqual(container.values["otherProperty"], now, "Saved Value differs");
                assert.strictEqual(settings.otherProperty, now, "Retreived value differs");
            }));

            it("ValueCanBeStoredSecondTime", settingsWrapper((settings) => {
                var now = Date.now() + "";

                settings.otherProperty = now;

                var container = st.ApplicationData.current.localSettings.createContainer(settings.name, st.ApplicationDataCreateDisposition.always);
                assert.strictEqual(container.values["otherProperty"], now, "Saved Value differs");
                assert.strictEqual(settings.otherProperty, now, "Retreived value differs");

                now = (Date.now() + 10) + "";
                settings.otherProperty = now;
                assert.strictEqual(settings.otherProperty, now, "Second written value incorrect");
            }));

            it("ValueCanBeClearedAndReturnsToDefault", settingsWrapper((settings) => {
                var now = Date.now() + "";

                settings.otherProperty = now;

                var container = st.ApplicationData.current.localSettings.createContainer(settings.name, st.ApplicationDataCreateDisposition.always);
                assert.strictEqual(container.values["otherProperty"], now, "Saved Value differs");
                assert.strictEqual(settings.otherProperty, now, "Retreived value differs");

                settings.clearOtherProperty();

                assert.strictEqual(settings.otherProperty, null, "Didn't reset value");
            }));
        });
    });
}