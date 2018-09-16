﻿module Codevoid.Storyvoid {
    export function toPropertySet(properties: any): Windows.Foundation.Collections.PropertySet {
        var propertySet = new Windows.Foundation.Collections.PropertySet();

        for (var key in properties) {
            if (!properties.hasOwnProperty(key)) {
                continue;
            }

            propertySet.insert(key, properties[key]);
        }

        return propertySet;
    }
    export class Telemetry {
        private static _client: Codevoid.Utilities.Mixpanel.MixpanelClient;
        static initialize(): WinJS.Promise<any> {
            // Test token
            Telemetry._client = new Codevoid.Utilities.Mixpanel.MixpanelClient("1f655fcc3028ab7be93e6c81b243a63a");
            return Telemetry._client.initializeAsync().then(() => {
                const settings = new Settings.TelemetrySettings();
                Telemetry._client.dropEventsForPrivacy = !settings.telemeteryCollectionEnabled;
                Telemetry._client.start();

                if (!Telemetry._client.hasUserIdentity()) {
                    Telemetry._client.generateAndSetUserIdentity();
                }

                if (!settings.firstSeenDateSent) {
                    const now = new Date();
                    let name = now.valueOf().toString();
                    if (Utilities.HiddenApiHelper.isInternalUser()) {
                        name = "It Me";
                    }

                    Telemetry._client.updateProfile(
                        Utilities.Mixpanel.UserProfileOperation.set_Once,
                        toPropertySet({
                            [Utilities.Mixpanel.EngageReservedPropertyNames.created]: now,
                            [Utilities.Mixpanel.EngageReservedPropertyNames.name]: name
                        })
                    );

                    settings.firstSeenDateSent = true;
                }
            });
        }

        static get instance(): Codevoid.Utilities.Mixpanel.MixpanelClient {
            return Telemetry._client;
        }

        public static trackAppLaunched(launchType: string) {
            const deviceFamily = Windows.System.Profile.AnalyticsInfo.versionInfo.deviceFamily;
            const versionInfo = Windows.ApplicationModel.Package.current.id.version;
            Telemetry.instance.track("AppLaunched", toPropertySet({
                launchType: launchType,
                platform: deviceFamily,
                appVersion: `${versionInfo.major}.${versionInfo.minor}.${versionInfo.build}`
            }));
        }
    }
}