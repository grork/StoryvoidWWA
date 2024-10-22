﻿/// <reference path="..\..\..\app\js\SettingsCore.ts" />
module CodevoidTests {
    import st = Windows.Storage;

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

    function getSettings(name?: string): SettingsTest {
        var containerName = name || Date.now() + "";

        return new SettingsTest(containerName);
    }

    function settingsTest(name: string, testBody: (assert: QUnitAssert, settings: SettingsTest) => void): void {
        QUnit.test(name, (testAssert) => {
            var containerName = Date.now() + "";
            var settings = new SettingsTest(containerName);

            try {
                testBody(testAssert, settings);
            } finally {
                settings.removeAllSettings();
            }
        });
    }

    QUnit.module("SettingsCore");

    QUnit.test("CanInstantiateWithoutCreatingContainer", (assert) => {
        var containerName = Date.now() + "";
        var settings = new SettingsTest(containerName);
        assert.notStrictEqual(settings, null, "Expected to create instance");

        var hasContainer = st.ApplicationData.current.localSettings.containers.hasKey(containerName);

        assert.ok(!hasContainer, "Didn't expect container to be created");
    });

    settingsTest("ContainerNotCreatedOnPropertyRead", (assert, settings) => {
        var value = settings.hasCreated;
        assert.ok(value, "Setting returned incorrectly");

        var containerExists = st.ApplicationData.current.localSettings.containers.hasKey(settings.name);
        assert.ok(!containerExists, "Container should have been created");
    });

    settingsTest("ContainerNotCreatedOnWritingValueSameAsDefault", (assert, settings) => {
        var value = settings.hasCreated;
        assert.ok(value, "Setting returned incorrectly");

        settings.hasCreated = true;

        var containerExists = st.ApplicationData.current.localSettings.containers.hasKey(settings.name);
        assert.ok(!containerExists, "Container should have been created");
    });

    settingsTest("DefaultValueReturnedWhenValueNotSet", (assert, settings) => {
        assert.ok(settings.hasCreated, "Expected default value");
    });

    settingsTest("StoredValueReturnedFromSettings", (assert, settings) => {
        var container = st.ApplicationData.current.localSettings.createContainer(settings.name, st.ApplicationDataCreateDisposition.always);
        container.values["hasCreated"] = false;

        assert.ok(!settings.hasCreated, "Expected value to be false");
    });

    settingsTest("ValueCanBeStoredAndRetrieved", (assert, settings) => {
        var now = Date.now() + "";

        settings.otherProperty = now;

        var container = st.ApplicationData.current.localSettings.createContainer(settings.name, st.ApplicationDataCreateDisposition.always);
        assert.strictEqual(container.values["otherProperty"], now, "Saved Value differs");
        assert.strictEqual(settings.otherProperty, now, "Retreived value differs");
    });

    settingsTest("ValueCanBeStoredSecondTime", (assert, settings) => {
        var now = Date.now() + "";

        settings.otherProperty = now;

        var container = st.ApplicationData.current.localSettings.createContainer(settings.name, st.ApplicationDataCreateDisposition.always);
        assert.strictEqual(container.values["otherProperty"], now, "Saved Value differs");
        assert.strictEqual(settings.otherProperty, now, "Retreived value differs");

        now = (Date.now() + 10) + "";
        settings.otherProperty = now;
        assert.strictEqual(settings.otherProperty, now, "Second written value incorrect");
    });

    settingsTest("ValueCanBeClearedAndReturnsToDefault", (assert, settings) => {
        var now = Date.now() + "";

        settings.otherProperty = now;

        var container = st.ApplicationData.current.localSettings.createContainer(settings.name, st.ApplicationDataCreateDisposition.always);
        assert.strictEqual(container.values["otherProperty"], now, "Saved Value differs");
        assert.strictEqual(settings.otherProperty, now, "Retreived value differs");

        settings.clearOtherProperty();

        assert.strictEqual(settings.otherProperty, null, "Didn't reset value");
    });
}