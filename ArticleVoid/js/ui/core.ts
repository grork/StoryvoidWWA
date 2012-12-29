﻿/// <reference path="..\..\tsc\libs\winjs.d.ts" static="true" />
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
        ctor: (container: any, viewModel: ViewModel) => any;
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
            return _currentHost;
        }

        public static initializeHost(host: ExperienceHost) {
            _currentHost = host;
        }
    }

    export class WwaExperienceHost implements ExperienceHost {
        constructor(public host: HTMLElement) {
        }

        addExperienceForModel(viewModel: ViewModel) {
            var controlElement = document.createElement("div");
            WinJS.Utilities.addClass(controlElement, "dialog");
            var viewInfo = Experiences.getExperienceForModel(viewModel, ExperienceTypes.WWA);
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