/// <reference path="..\..\tsc\libs\qunit.d.ts" static="true" />
/// <reference path="..\..\tsc\libs\codevoidtest.d.ts" static="true" />
/// <reference path="..\ui\core.ts" />

(function () {
    QUnit.module("ExperienceManager");
    
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var getPlayground = InstapaperTestUtilities.getPlayground;

    test("canInstantiateExperienceManager", function () {
        var container = getPlayground();
        
        var host = new Codevoid.UICore.WwaExperienceHost(container);

        ok(host, "No manager found");
        strictEqual(host.host, container, "Container didn't match");
    });

    test("experienceGetsAddedToDom", function () {
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

    test("canAddMoreThanOneExperience", function () {
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

    test("controlElementSetCorrectly", function () {
        var container = getPlayground();
        var host = new Codevoid.UICore.WwaExperienceHost(container);
        var experience = {
            experience: {
                wwa: "Codevoid.UICore.Control",
            }
        };
        var experienceInfo = Codevoid.UICore.getExperienceForModel(experience, Codevoid.UICore.ExperienceTypes.WWA);

        host.addExperienceForModel(experience);
        var controlElement = <HTMLExperienceElement>container.firstElementChild;

        strictEqual(controlElement.getAttribute("data-win-control"), experienceInfo.identifier, "Incorrect control created, or not attribute set");
        strictEqual(controlElement.model, experience, "No experience set");
        ok(controlElement.winControl, "No winControl");
    });

    test("canRemoveExperienceUsingModel", function () {
        var container = getPlayground();
        var host = new Codevoid.UICore.WwaExperienceHost(container);
        var experience = { experience: { wwa: "Codevoid.UICore.Control" } };

        host.addExperienceForModel(experience);

        strictEqual(host.host.children.length, 1, "Only expected on child");

        host.removeExperienceForModel(experience);

        strictEqual(host.host.children.length, 0, "Didn't expect any children");
    });

    test("removingAnNonAddedExperienceDoesn'tCrash", function () {
        var container = getPlayground();
        var host = new Codevoid.UICore.WwaExperienceHost(container);
        var experience = { experience: { wwa: "Codevoid.UICore.Control" } };

        host.addExperienceForModel(experience);

        strictEqual(host.host.children.length, 1, "Only expected on child");

        host.removeExperienceForModel({ experience: {} });

        strictEqual(host.host.children.length, 1, "Only expected on child");
    });
})();