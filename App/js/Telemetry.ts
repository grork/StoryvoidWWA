module Codevoid.Storyvoid {
    export class Telemetry {
        private static _client: Codevoid.Utilities.Mixpanel.MixpanelClient;
        static initialize(): WinJS.Promise<any> {
            // Test token
            Telemetry._client = new Codevoid.Utilities.Mixpanel.MixpanelClient("57368bf65c0e0bd64fec363806164133");
            return Telemetry._client.initializeAsync().then(() => {
                Telemetry._client.start();
            });
        }

        static get instance(): Codevoid.Utilities.Mixpanel.MixpanelClient {
            return Telemetry._client;
        }
    }
}