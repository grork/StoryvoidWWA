/// <reference path="..\..\tsc\libs\qunit.d.ts" static="true" />
/// <reference path="..\..\tsc\libs\codevoidtest.d.ts" static="true" />
/// <reference path="..\ui\core.ts" />

module CodevoidTests {
    export interface ExperienceInformation {
        model: Codevoid.UICore.ViewModel;
        view: any;
    }

    export class UnitTestExperienceHost implements Codevoid.UICore.ExperienceHost {
        public experiences: ExperienceInformation[] = [];

        addExperienceForModel(viewModel: Codevoid.UICore.ViewModel) {
            var viewInfo = Codevoid.UICore.Experiences.getExperienceForModel(viewModel, Codevoid.UICore.ExperienceTypes.UNITTEST);
            this.experiences.push({
                model: viewModel,
                view: new viewInfo.ctor(null, viewModel),
            });
        }

        removeExperienceForModel(viewModel: Codevoid.UICore.ViewModel) {
            var candidateIndex: number = -1;

            this.experiences.forEach(function (item, index: number) {
                if (item.model === viewModel) {
                    candidateIndex = index;
                }
            });

            if (candidateIndex === -1) {
                return;
            }

            this.experiences.splice(candidateIndex, 1);
        }

        getExperienceForModel(viewModel: Codevoid.UICore.ViewModel) {
            var candidate = this.experiences.filter(function (item) {
                return item.model === viewModel;
            });

            if (candidate.length !== 1) {
                return null;
            }

            return candidate[0].view;
        }
    }

    export class SimpleUnitTestUI {
        constructor(public model: any) {
        }
    }
}

(function () {
    QUnit.module("ExperienceManagerWwa");

    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;

    test("canInstantiateWwaExperienceManager", function () {
        var container = getPlayground();
        
        var host = new Codevoid.UICore.WwaExperienceHost(container);

        ok(host, "No manager found");
        strictEqual(host.host, container, "Container didn't match");
    });

    test("wwaExperienceGetsAddedToDom", function () {
        var container = getPlayground();
        var host = new Codevoid.UICore.WwaExperienceHost(container);

        var viewModel = {
            experience: {
                wwa: "Codevoid.UICore.Control"
            },
        };
        
        host.addExperienceForModel(viewModel);

        ok(container.children, "No Children collection");
        strictEqual(container.children.length, 1, "Expected one child");
    });

    test("wwaCanAddMoreThanOneExperience", function () {
        var container = getPlayground();
        var host = new Codevoid.UICore.WwaExperienceHost(container);
        
        host.addExperienceForModel({
            experience: {
                wwa: "Codevoid.UICore.Control",
            }
        });

        host.addExperienceForModel({
            experience: {
                wwa: "Codevoid.UICore.Control",
            }
        });

        ok(container.children, "No children collection");
        strictEqual(container.children.length, 2, "Unexpected number of children");
    });

    test("wwaControlElementSetCorrectly", function () {
        var container = getPlayground();
        var host = new Codevoid.UICore.WwaExperienceHost(container);
        var experience = {
            experience: {
                wwa: "Codevoid.UICore.Control",
            }
        };
        var experienceInfo = Codevoid.UICore.Experiences.getExperienceForModel(experience, Codevoid.UICore.ExperienceTypes.WWA);

        host.addExperienceForModel(experience);
        var controlElement = <HTMLExperienceElement>container.firstElementChild;

        strictEqual(controlElement.getAttribute("data-win-control"), experienceInfo.identifier, "Incorrect control created, or not attribute set");
        strictEqual(controlElement.model, experience, "No experience set");
        ok(controlElement.winControl, "No winControl");
    });

    test("wwaCanRemoveExperienceUsingModel", function () {
        var container = getPlayground();
        var host = new Codevoid.UICore.WwaExperienceHost(container);
        var experience = { experience: { wwa: "Codevoid.UICore.Control" } };

        host.addExperienceForModel(experience);

        strictEqual(host.host.children.length, 1, "Only expected on child");

        host.removeExperienceForModel(experience);

        strictEqual(host.host.children.length, 0, "Didn't expect any children");
    });

    test("wwaRemovingAnNonAddedExperienceDoesn'tCrash", function () {
        var container = getPlayground();
        var host = new Codevoid.UICore.WwaExperienceHost(container);
        var experience = { experience: { wwa: "Codevoid.UICore.Control" } };

        host.addExperienceForModel(experience);

        strictEqual(host.host.children.length, 1, "Only expected one child");

        host.removeExperienceForModel({ experience: {} });
        
        strictEqual(host.host.children.length, 1, "Only expected one child");
    });

    QUnit.module("ExperienceManagerUnitTest");

    test("unitCanInstantiateWExperienceManager", function () {
        var host = new CodevoidTests.UnitTestExperienceHost();
        ok(host, "No manager found");
    });

    test("unitCanAddMoreThanOneExperience", function () {
        var host = new CodevoidTests.UnitTestExperienceHost();
        
        host.addExperienceForModel({
            experience: {
                unittest: "CodevoidTests.SimpleUnitTestUI",
            }
        });

        host.addExperienceForModel({
            experience: {
                unittest: "CodevoidTests.SimpleUnitTestUI",
            }
        });

        ok(host.experiences, "No children collection");
        strictEqual(host.experiences.length, 2, "Unexpected number of children");
    });

    test("unitCanRemoveExperienceUsingModel", function () {
        var host = new CodevoidTests.UnitTestExperienceHost();
        var experience = { experience: { unittest: "CodevoidTests.SimpleUnitTestUI" } };

        host.addExperienceForModel(experience);

        strictEqual(host.experiences.length, 1, "Only expected on child");

        host.removeExperienceForModel(experience);

        strictEqual(host.experiences.length, 0, "Didn't expect any children");
    });

    test("unitRemovingAnNonAddedExperienceDoesn'tCrash", function () {
        var host = new CodevoidTests.UnitTestExperienceHost();
        var experience = { experience: { unittest: "CodevoidTests.SimpleUnitTestUI" } };

        host.addExperienceForModel(experience);

        strictEqual(host.experiences.length, 1, "Only expected one child");

        host.removeExperienceForModel({ experience: {} });
        
        strictEqual(host.experiences.length, 1, "Only expected one child");
    });

    test("unitGettingExperienceForModelReturnsExperience", function () {
        var host = new CodevoidTests.UnitTestExperienceHost();
        var model = {
            experience: {
                unittest: "CodevoidTests.SimpleUnitTestUI",
            }
        };

        host.addExperienceForModel(model);

        var xp = host.getExperienceForModel(model);
        ok(xp, "No experience found");
        notStrictEqual(xp, model, "Shouldn't have gotten the model back");
        ok(xp instanceof CodevoidTests.SimpleUnitTestUI, "Incorrect experience created");
    });
})();