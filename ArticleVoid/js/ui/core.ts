/// <reference path="..\..\tsc\libs\winjs.d.ts" static="true" />
/// <reference path="..\..\tsc\libs\codevoid.d.ts" static="true" />

module Codevoid.UICore {
    export interface ViewModel {
        experience: any;
    }

    export interface HTMLControlElement extends HTMLElement {
        winControl: Control;
    }

    export interface ExperienceInformation {
        identifier: string;
        ctor: (element: HTMLElement, viewModel: ViewModel) => any;
    }

    export interface HTMLExperienceElement extends HTMLElement {
        model: ViewModel;
    }

    export class Control {
        element: HTMLControlElement;
        constructor(element: HTMLControlElement, options: any) {
            this.element = element;
            WinJS.UI.setOptions(this, options);
            element.winControl = this;
        }
    }

    export class ExperienceTypes {
        public static UNITTEST = "unittest";
        public static WWA = "wwa";
    }

    export var currentViewType: string = ExperienceTypes.UNITTEST;
    
    export function getExperienceForModel(viewModel: ViewModel, viewType?: string): ExperienceInformation {
        if (!viewModel.experience) {
            throw new Error("Can't get a view for a model that doesn't have a view");
        }

        var view: string = viewModel.experience[viewType || Codevoid.UICore.currentViewType];
        if (!view) {
            throw new Error("Can't get view for current view type");
        }

        var ctor = WinJS.Utilities.getMember(view);
        return {
            identifier: view,
            ctor: ctor,
        };
    }

    export class WwaExperienceHost {
        constructor(public host: HTMLElement) {
        }

        addExperienceForModel(viewModel: ViewModel) {
            var controlElement = document.createElement("div");

            var viewInfo = getExperienceForModel(viewModel, ExperienceTypes.WWA);
            controlElement.setAttribute("data-win-control", viewInfo.identifier);
            (<HTMLControlElement>controlElement).winControl = new viewInfo.ctor(controlElement, viewModel);
            (<HTMLExperienceElement>controlElement).model = viewModel;

            this.host.appendChild(controlElement);
        }

        removeExperienceForModel(viewModel: ViewModel) {
            var experience: HTMLExperienceElement;
            
            for (var i = 0; i < this.host.children.length; i++) {
                if (viewModel === (<HTMLExperienceElement>this.host.children[i]).model) {
                    experience = <HTMLExperienceElement>this.host.children[i];
                    break;
                }
            }

            if (!experience) {
                return;
            }

            this.host.removeChild(experience);
        }
    }
}