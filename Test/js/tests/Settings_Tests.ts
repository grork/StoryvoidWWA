module CodevoidTests {
    class SettingsTest extends Codevoid.Utilities.SettingsCore {
    }

    QUnit.module("SettingsCore");

    test("CanInstantiate", () => {
        var settings = new SettingsTest(Date.now() + "");
        notStrictEqual(settings, null, "Expected to create instance");
    });
}