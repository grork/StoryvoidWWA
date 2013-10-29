/// <reference path="..\..\tsc\libs\winjs.d.ts" static="true" />
/// <reference path="..\..\tsc\libs\codevoid.d.ts" static="true" />

module Codevoid.UICore {
    export interface ViewModel {
        experience: any;
    }

    export interface HTMLControlElement extends HTMLElement {
        winControl: Control;
    }

    export interface ExperienceCreationOptions {
        viewModel: ViewModel;
    }

    export interface ExperienceInformation {
        identifier: string;
        ctor: (container: any, options: ExperienceCreationOptions) => void;
    }

    export interface HTMLExperienceElement extends HTMLElement {
        model: ViewModel;
    }
    
    export interface ExperienceHost {
        addExperienceForModel(viewModel: ViewModel);
        removeExperienceForModel(viewModel: ViewModel);
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

    class NullExperienceHost implements ExperienceHost {
        constructor() {
        }
        addExperienceForModel(viewModel: ViewModel) {
        }
        removeExperienceForModel(viewModel: ViewModel) {
        }
    }

    export class Experiences {
        public static getExperienceForModel(viewModel: ViewModel, viewType: string): ExperienceInformation {
            if (!viewModel.experience) {
                throw new Error("Can't get a view for a model that doesn't have a view");
            }

            var view: string = viewModel.experience[viewType];
            if (!view) {
                throw new Error("Can't get view for the supplied view type:" + viewType);
            }

            var ctor = WinJS.Utilities.getMember(view);
            return {
                identifier: view,
                ctor: ctor,
            };
        }
        
        private static _currentHost: ExperienceHost;
        public static get currentHost(): ExperienceHost {
            if (!Experiences._currentHost) {
                this._currentHost = new NullExperienceHost();
            }
            return Experiences._currentHost;
        }

        public static initializeHost(host: ExperienceHost) {
            Experiences._currentHost = host;
        }
    }

    export class WwaExperienceHost implements ExperienceHost {
        constructor(public host: HTMLElement) {
        }
        private findExperienceForModel(viewModel: ViewModel) : HTMLExperienceElement {
            for (var i = 0; i < this.host.children.length; i++) {
                if (viewModel === (<HTMLExperienceElement>this.host.children[i]).model) {
                    return <HTMLExperienceElement>this.host.children[i];
                    break;
                }
            }

            return null;
        }
        addExperienceForModel(viewModel: ViewModel) {
            // See if there is already an experience for this model
            // and if there is, just bail.
            if (this.findExperienceForModel(viewModel)) {
                return;
            }

            var controlElement = <HTMLElement>document.createElement("div");
            WinJS.Utilities.addClass(controlElement, "dialog");
            var viewInfo = Experiences.getExperienceForModel(viewModel, ExperienceTypes.WWA);
            controlElement.setAttribute("data-win-control", viewInfo.identifier);
            (<HTMLControlElement>controlElement).winControl = new viewInfo.ctor(controlElement, { viewModel: viewModel });
            (<HTMLExperienceElement>controlElement).model = viewModel;

            this.host.appendChild(controlElement);
        }

        removeExperienceForModel(viewModel: ViewModel) {
            var experience: HTMLExperienceElement = this.findExperienceForModel(viewModel);
            
            if (!experience) {
                return;
            }

            Codevoid.Utilities.DOM.removeChild(this.host, experience);
        }
    }
}