module Codevoid.Storyvoid {
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
            Telemetry._client = new Codevoid.Utilities.Mixpanel.MixpanelClient("57368bf65c0e0bd64fec363806164133");
            return Telemetry._client.initializeAsync().then(() => {
                Telemetry._client.dropEventsForPrivacy = !(new Settings.TelemetrySettings()).telemeteryCollectionEnabled;
                Telemetry._client.start();

                if (!Telemetry._client.hasSuperProperty("distinct_id")) {
                    var settings = new Settings.TelemetrySettings();
                    if (!settings.installID) {
                        settings.installID = Codevoid.Utilities.GuidHelper.generateGuidAsString();
                    }

                    Telemetry._client.setSuperPropertyAsString("distinct_id", settings.installID);
                }
            });
        }

        static get instance(): Codevoid.Utilities.Mixpanel.MixpanelClient {
            return Telemetry._client;
        }
    }
}