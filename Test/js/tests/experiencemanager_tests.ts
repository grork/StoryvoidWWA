﻿/// <reference path="..\..\tsc\libs\qunit.d.ts" static="true" />
/// <reference path="..\..\tsc\libs\codevoidtest.d.ts" static="true" />
/// <reference path="..\..\..\App\js\ui\core.ts" />

module CodevoidTests {
    export interface ExperienceInformation {
        model: Codevoid.UICore.ViewModel;
        view: any;
    }

    export class UnitTestExperienceHost implements Codevoid.UICore.ExperienceHost {
        public experiences: ExperienceInformation[] = [];

        addExperienceForModel(viewModel: Codevoid.UICore.ViewModel) {
            var experienceForModel = this.getExperienceForModel(viewModel);

            if (experienceForModel) {
                if (experienceForModel.again) {
                    experienceForModel.again();
                }

                return;
            }

            var viewInfo = Codevoid.UICore.Experiences.getExperienceForModel(viewModel, Codevoid.UICore.ExperienceTypes.UNITTEST);
            this.experiences.push({
                model: viewModel,
                view: new viewInfo.ctor(null, { viewModel: viewModel }),
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
        constructor(public container: any, options: Codevoid.UICore.ExperienceCreationOptions) {
            WinJS.UI.setOptions(this, options);
        }
    }

    export class SimpleUnitTestUIWithAgain extends SimpleUnitTestUI {
        again() {
            this.wasNotified = true;
        }
        public wasNotified: boolean = false;
    }
}

module CodevoidTests.ExperienceManagerTests {
    import HTMLExperienceElement = Codevoid.UICore.HTMLExperienceElement;

    QUnit.module("ExperienceManagerWwa");

    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;

    QUnit.test("canInstantiateWwaExperienceManager", function (assert) {
        var container = getPlayground();

        var host = new Codevoid.UICore.WwaExperienceHost(container);

        assert.ok(host, "No manager found");
        assert.strictEqual(host.host, container, "Container didn't match");
    });

    QUnit.test("wwaExperienceGetsAddedToDom", function (assert) {
        var container = getPlayground();
        var host = new Codevoid.UICore.WwaExperienceHost(container);

        var viewModel = {
            experience: {
                wwa: "Codevoid.UICore.Control"
            },
        };

        host.addExperienceForModel(viewModel);

        assert.ok(container.children, "No Children collection");
        assert.strictEqual(container.children.length, 1, "Expected one child");
    });

    QUnit.test("wwaAddingSameViewModelDoesn'tCreateSecondExperience", function (assert) {
        var container = getPlayground();
        var host = new Codevoid.UICore.WwaExperienceHost(container);

        var viewModel = {
            experience: {
                wwa: "Codevoid.UICore.Control"
            },
        };

        host.addExperienceForModel(viewModel);

        assert.ok(container.children, "No Children collection");
        assert.strictEqual(container.children.length, 1, "Expected one child");

        host.addExperienceForModel(viewModel);
        assert.ok(container.children, "No Children collection");
        assert.strictEqual(container.children.length, 1, "Expected one child");
    });

    QUnit.test("wwaCanAddMoreThanOneExperience", function (assert) {
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

        assert.ok(container.children, "No children collection");
        assert.strictEqual(container.children.length, 2, "Unexpected number of children");
    });

    QUnit.test("wwaControlElementSetCorrectly", function (assert) {
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

        assert.strictEqual(controlElement.getAttribute("data-win-control"), experienceInfo.identifier, "Incorrect control created, or not attribute set");
        assert.strictEqual(controlElement.model, experience, "No experience set");
        assert.ok(controlElement.winControl, "No winControl");
        assert.ok(controlElement.winControl.viewModel, "no view model set");
    });

    QUnit.test("wwaAddingSameViewModelDoesn'tReplaceControl", function (assert) {
        var container = getPlayground();
        var host = new Codevoid.UICore.WwaExperienceHost(container);
        var viewModel = {
            experience: {
                wwa: "Codevoid.UICore.Control",
            }
        };
        var experienceInfo = Codevoid.UICore.Experiences.getExperienceForModel(viewModel, Codevoid.UICore.ExperienceTypes.WWA);

        host.addExperienceForModel(viewModel);
        var controlElement = <HTMLExperienceElement>container.firstElementChild;

        assert.strictEqual(controlElement.getAttribute("data-win-control"), experienceInfo.identifier, "Incorrect control created, or not attribute set");
        assert.strictEqual(controlElement.model, viewModel, "No experience set");
        assert.ok(controlElement.winControl, "No winControl");
        assert.ok(controlElement.winControl.viewModel, "no view model set");

        host.addExperienceForModel(viewModel);
        assert.strictEqual(container.children.length, 1, "Expected one child");
        assert.strictEqual(container.firstElementChild, controlElement, "Element was recreated");
    });

    QUnit.test("wwaCanRemoveExperienceUsingModel", function (assert) {
        var container = getPlayground();
        var host: Codevoid.UICore.ExperienceHost = new Codevoid.UICore.WwaExperienceHost(container);
        var wwaHost: Codevoid.UICore.WwaExperienceHost = <Codevoid.UICore.WwaExperienceHost>host;
        var experience = { experience: { wwa: "Codevoid.UICore.Control" } };

        host.addExperienceForModel(experience);

        assert.strictEqual(wwaHost.host.children.length, 1, "Only expected on child");

        host.removeExperienceForModel(experience);

        assert.strictEqual(wwaHost.host.children.length, 0, "Didn't expect any children");
    });

    QUnit.test("wwaRemovingExperienceDisposesExperience", function (assert) {
        var container = getPlayground();
        var host: Codevoid.UICore.ExperienceHost = new Codevoid.UICore.WwaExperienceHost(container);
        var wwaHost: Codevoid.UICore.WwaExperienceHost = <Codevoid.UICore.WwaExperienceHost>host;
        var experience = { experience: { wwa: "CodevoidTests.TestControl" } };
        var experienceUIInstance: CodevoidTests.TestControl;

        host.addExperienceForModel(experience);
        assert.strictEqual(wwaHost.host.children.length, 1, "Only expected on child");

        experienceUIInstance = <CodevoidTests.TestControl>(<Codevoid.UICore.HTMLControlElement>wwaHost.host.children[0]).winControl;

        host.removeExperienceForModel(experience);

        assert.strictEqual(wwaHost.host.children.length, 0, "Didn't expect any children");
        assert.ok(experienceUIInstance.disposed, "Control wasn't disposed");
    });

    QUnit.test("wwaRemovingAnNonAddedExperienceDoesn'tCrash", function (assert) {
        var container = getPlayground();
        var host: Codevoid.UICore.ExperienceHost = new Codevoid.UICore.WwaExperienceHost(container);
        var wwaHost: Codevoid.UICore.WwaExperienceHost = <Codevoid.UICore.WwaExperienceHost>host;
        var experience = { experience: { wwa: "Codevoid.UICore.Control" } };

        host.addExperienceForModel(experience);

        assert.strictEqual(wwaHost.host.children.length, 1, "Only expected one child");

        host.removeExperienceForModel({ experience: {} });

        assert.strictEqual(wwaHost.host.children.length, 1, "Only expected one child");
    });

    QUnit.module("ExperienceManagerUnitTest");

    QUnit.test("unitCanInstantiateWExperienceManager", function (assert) {
        var host = new CodevoidTests.UnitTestExperienceHost();
        assert.ok(host, "No manager found");
    });

    QUnit.test("unitCanAddMoreThanOneExperience", function (assert) {
        var host = new CodevoidTests.UnitTestExperienceHost();

        var viewModel1 = {
            experience: {
                unittest: "CodevoidTests.SimpleUnitTestUI",
            }
        };

        host.addExperienceForModel(viewModel1);

        var viewModel2 = {
            experience: {
                unittest: "CodevoidTests.SimpleUnitTestUI",
            }
        };

        host.addExperienceForModel(viewModel2);

        assert.ok(host.experiences, "No children collection");
        assert.strictEqual(host.experiences.length, 2, "Unexpected number of children");

        assert.ok(host.experiences[0].view.viewModel, "No view model found");
        assert.strictEqual(host.experiences[0].view.viewModel, viewModel1, "Incorrect view model found");

        assert.ok(host.experiences[1].view.viewModel, "No view model found");
        assert.strictEqual(host.experiences[1].view.viewModel, viewModel2, "Incorrect view model found");
    });

    QUnit.test("canAddSameViewModelTwiceWithoutDuplicates", function (assert) {
        var host = new CodevoidTests.UnitTestExperienceHost();

        var viewModel1 = {
            experience: {
                unittest: "CodevoidTests.SimpleUnitTestUI",
            }
        };

        host.addExperienceForModel(viewModel1);
        host.addExperienceForModel(viewModel1);

        assert.ok(host.experiences, "No children collection");
        assert.strictEqual(host.experiences.length, 1, "Unexpected number of children");

        assert.ok(host.experiences[0].view.viewModel, "No view model found");
        assert.strictEqual(host.experiences[0].view.viewModel, viewModel1, "Incorrect view model found");
    });

    QUnit.test("addingSameViewModelNotifiesViewModel", function (assert) {
        var host = new CodevoidTests.UnitTestExperienceHost();

        var viewModel1 = {
            experience: {
                unittest: "CodevoidTests.SimpleUnitTestUIWithAgain",
            },
        };

        host.addExperienceForModel(viewModel1);
        assert.ok(host.experiences, "No children collection");
        assert.strictEqual(host.experiences.length, 1, "Unexpected number of children");
        assert.ok(host.experiences[0].view.viewModel, "No view model found");
        assert.strictEqual(host.experiences[0].view.viewModel, viewModel1, "Incorrect view model found");

        assert.ok(!host.getExperienceForModel(viewModel1).wasNotified, "Shouldn't have been notified yet");

        host.addExperienceForModel(viewModel1);
        assert.strictEqual(host.experiences.length, 1, "Unexpected number of children");
        assert.ok(host.getExperienceForModel(viewModel1).wasNotified, "Wasn't notified");
    });

    QUnit.test("unitCanRemoveExperienceUsingModel", function (assert) {
        var host: Codevoid.UICore.ExperienceHost = new CodevoidTests.UnitTestExperienceHost();
        var unitHost: CodevoidTests.UnitTestExperienceHost = <CodevoidTests.UnitTestExperienceHost>host;
        var experience = { experience: { unittest: "CodevoidTests.SimpleUnitTestUI" } };

        host.addExperienceForModel(experience);

        assert.strictEqual(unitHost.experiences.length, 1, "Only expected on child");

        host.removeExperienceForModel(experience);

        assert.strictEqual(unitHost.experiences.length, 0, "Didn't expect any children");
    });

    QUnit.test("unitRemovingAnNonAddedExperienceDoesn'tCrash", function (assert) {
        var host: Codevoid.UICore.ExperienceHost = new CodevoidTests.UnitTestExperienceHost();
        var unitHost: CodevoidTests.UnitTestExperienceHost = <CodevoidTests.UnitTestExperienceHost>host;
        var experience = { experience: { unittest: "CodevoidTests.SimpleUnitTestUI" } };

        host.addExperienceForModel(experience);

        assert.strictEqual(unitHost.experiences.length, 1, "Only expected one child");

        host.removeExperienceForModel({ experience: {} });

        assert.strictEqual(unitHost.experiences.length, 1, "Only expected one child");
    });

    QUnit.test("unitGettingExperienceForModelReturnsExperience", function (assert) {
        var host = new CodevoidTests.UnitTestExperienceHost();
        var model = {
            experience: {
                unittest: "CodevoidTests.SimpleUnitTestUI",
            }
        };

        host.addExperienceForModel(model);

        var xp = host.getExperienceForModel(model);
        assert.ok(xp, "No experience found");
        assert.notStrictEqual(xp, model, "Shouldn't have gotten the model back");
        assert.ok(xp instanceof CodevoidTests.SimpleUnitTestUI, "Incorrect experience created");
    });
}