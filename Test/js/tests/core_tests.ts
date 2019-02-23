declare namespace Codevoid.UICore {
    export interface Control {
        value: string;
        anotherValue: string;
    }
}
namespace CodevoidTests {
    const Signal = Codevoid.Utilities.Signal;
    const getPlayground = InstapaperTestUtilities.getPlayground;
    const uicore = Codevoid.UICore;
    
    describe("UICore Controls", () => {
        beforeEach(InstapaperTestUtilities.clearPlayground);
        afterEach(InstapaperTestUtilities.clearPlayground);

        it("canInstantiateControl", () => {
            const control = new Codevoid.UICore.Control(document.createElement("div"));
            assert.ok(control, "Control couldn't be created");
        });

        it("optionsPassedToControlAreSetOnObject", () => {
            const control = new Codevoid.UICore.Control(document.createElement("div"), {
                value: "a",
                anotherValue: "b",
            });

            assert.ok(control, "Control wasn't created");
            assert.strictEqual(control.value, "a", "Value wasn't set on instance");
            assert.strictEqual(control.anotherValue, "b", "AnotherValue wasn't set on instance");
        });

        it("elementPassedToControlIsSet", () => {
            const playground = getPlayground();
            const control = new Codevoid.UICore.Control(playground);

            assert.ok(control, "Control wasn't created");
            assert.strictEqual(control.element, playground, "Controls element was incorrect");
        });


        it("errorOnGettingViewForModelWithoutView", () => {
            const model = { experience: null };
            let exceptionCaught = false;

            try {
                uicore.Experiences.getExperienceForModel(model, null);
            } catch (e) {
                exceptionCaught = true;
            }

            assert.ok(exceptionCaught, "No exception caught");
        });

        it("errorOnGettingViewForNotDefinedViewType", () => {
            const model = {
                experience: {
                    unittest: "CodevoidTests.TestControl",
                },
            };

            let exceptionCaught = false;
            try {
                uicore.Experiences.getExperienceForModel(model, "fake");
            } catch (e) {
                exceptionCaught = true;
            }

            assert.ok(exceptionCaught, "No exception caught");
        });

        it("canGetViewForSimpleModel", () => {
            const model = {
                experience: {
                    unittest: "CodevoidTests.UnitTestView",
                },
            };

            let view = uicore.Experiences.getExperienceForModel(model, "unittest");
            assert.ok(view, "Expected to get a view");
            assert.ok(view.identifier, "Expected identifier");
            assert.ok(view.ctor, "Expected constructor");
            assert.strictEqual(typeof view.ctor, "function", "Expected a function");
        });

    });
}