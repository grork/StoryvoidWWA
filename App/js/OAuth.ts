namespace Codevoid.OAuth {
    function localAssert(condition: boolean, message: string) {
        if (condition) {
            return;
        }

        debugger;
        console.debug(message);
    }

    function stringKeySorter(first: NameValuePair, second: NameValuePair): number {
        localAssert(!!(first && first.key), "first param was falsey");
        localAssert(!!(second && second.key), "second param was falsey");

        return first.key.localeCompare(second.key);
    }

    function rfc3986encodeURIComponent(unencoded: string): string {
        /* replace ! */      /* replace ' */    /* replace ( */  /* repalce ) */     /* replace * */
        return encodeURIComponent(unencoded).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A');
    }

    function _encodeKeyValuePairAndInsert(item: NameValuePair, destination: NameValuePair[]): void {
        localAssert(!!item, "No item provided");
        localAssert(!!destination, "no destination provided");
        localAssert(Array.isArray(destination), "destination wasn't an array");
        localAssert(!!item.key, "Item didn't have key");

        destination.push({ key: rfc3986encodeURIComponent(item.key), value: rfc3986encodeURIComponent(<string>item.value) });
    }

    export enum Operations {
        GET = "GET",
        POST = "POST"
    }

    export interface IRequestError {
        status: Windows.Web.Http.HttpStatusCode;
        response: string;
    }

    export interface IParameterEncoderOptions {
        readonly delimiter?: string;
        readonly shouldQuoteValues?: boolean;
    }

    type NameValuePairValueType = string | number | boolean;

    export interface NameValuePair {
        key: string;
        value: NameValuePairValueType;
    }

    export class ParameterEncoder {
        private _delimiter: string = "&";
        private _shouldQuoteValues: boolean = false;

        constructor(options?: IParameterEncoderOptions) {
            if (options) {
                this._delimiter = options.delimiter || this._delimiter;
                this._shouldQuoteValues = options.shouldQuoteValues || this._shouldQuoteValues;
            }
        }

        public getEncodedStringForData(...args: any[]): string {
            // We need to build a new array straight off, and then sort that
            // theres no point in merging then iterating again.

            const mergedAndEncodedItems: NameValuePair[] = [];
            for (let i = 0; i < args.length; i++) {
                let argument = args[i];
                if (!argument) {
                    continue;
                } else if (Array.isArray(argument)) {
                    // Dig one level in
                    this._mergeAndEncode(argument, mergedAndEncodedItems);
                } else {
                    // Else, just encode and put the item in
                    _encodeKeyValuePairAndInsert(argument, mergedAndEncodedItems);
                }
            }

            // Sort the newly encoded items inplace
            mergedAndEncodedItems.sort(stringKeySorter);

            const stringifiedItems = [];
            for (let item of mergedAndEncodedItems) {
                stringifiedItems.push(this._keyValuePairToString(item));
            }

            return stringifiedItems.join(this._delimiter);
        }

        private _mergeAndEncode(source: NameValuePair[], destination: NameValuePair[]): void {
            localAssert(source && Array.isArray(source), "Source wasn't an array");
            localAssert(destination && Array.isArray(destination), "destination isn't array");

            for (let item of source) {
                _encodeKeyValuePairAndInsert(item, destination);
            }
        }

        private _keyValuePairToString(keyValuePair): string {
            let result = `${keyValuePair.key}=`;

            if (!this._shouldQuoteValues) {
                result += keyValuePair.value;
            } else {
                result += `\"${keyValuePair.value}\"`;
            }

            return result;
        }
    }

    export class ClientInformation {
        private _userAgentHeader: Windows.Web.Http.Headers.HttpProductInfoHeaderValue;
        private _productName: string = "Codevoid OAuth Helper";
        private _productVersion: string = "0.1";

        constructor(private _id: string, private _secret: string, private _token?: string, private _tokenSecret?: string) { }

        public get clientId(): string {
            return this._id;
        }

        public get clientSecret(): string {
            return this._secret;
        }

        public get clientToken(): string {
            return this._token;
        }

        public get clientTokenSecret(): string {
            return this._tokenSecret;
        }

        public get productName(): string {
            return this._productName;
        }

        public set productName(productName: string) {
            this._productName = productName;
            this._userAgentHeader = null;
        }

        public get productVersion(): string {
            return this._productName;
        }

        public set productVersion(productVersion: string) {
            this._productVersion = productVersion;
            this._userAgentHeader = null;
        }

        public getUserAgentHeader(): Windows.Web.Http.Headers.HttpProductInfoHeaderValue {
            if (!this._userAgentHeader) {
                this._userAgentHeader = new Windows.Web.Http.Headers.HttpProductInfoHeaderValue(this.productName, this.productVersion);
            }

            return this._userAgentHeader;
        }
    }

    export class OAuthRequest {
        private _operation: Windows.Web.Http.HttpMethod = Windows.Web.Http.HttpMethod.post;
        public data: NameValuePair[];
        public _nonce: any;
        public _timestamp: number;

        constructor(private _clientInformation: ClientInformation, private _url: string, operation?: Operations) {
            localAssert(!!clientInformation, "no client information supplied");
            localAssert(!!_url, "No URL Supplied");

            if (operation === Codevoid.OAuth.Operations.GET) {
                this._operation = Windows.Web.Http.HttpMethod.get;
            }
        }

        private _generateAuthHeader(): string {
            // Allow nonce, timestamp to be overridden for testing
            const nonce = this._nonce || Math.floor(Math.random() * 1000000000);
            const timestamp = this._timestamp || Math.round(new Date().getTime() / 1000.0);

            // Uncomment for better debugging
            //console.log("OAuth nonce: " + nonce);
            //console.log("OAuth timestamp: " + timestamp);

            // Build OAuth Items
            const oAuthHeaders: NameValuePair[] = [
                { key: "oauth_consumer_key", value: this._clientInformation.clientId },
                { key: "oauth_nonce", value: nonce },
                { key: "oauth_signature_method", value: "HMAC-SHA1" },
                { key: "oauth_timestamp", value: timestamp },
                { key: "oauth_version", value: "1.0" }
            ];

            if (this._clientInformation.clientToken) {
                oAuthHeaders.push({ key: "oauth_token", value: this._clientInformation.clientToken });
            }

            // Generate encoded string
            const encoder = new Codevoid.OAuth.ParameterEncoder();
            let encodedParams = encoder.getEncodedStringForData(oAuthHeaders, this.data);

            // Get signature
            encodedParams = `${this._operation}&${rfc3986encodeURIComponent(this._url)}&${rfc3986encodeURIComponent(encodedParams)}`;
            const signature = this._getSignatureForString(encodedParams);

            // Build items for parameter encoding for header
            const authOAuthHeaders: NameValuePair[] = [{ key: "oauth_signature", value: <NameValuePairValueType>signature }].concat(oAuthHeaders);
            const headerEncoder = new Codevoid.OAuth.ParameterEncoder({ shouldQuoteValues: true, delimiter: ", " });

            // Get header string
            var header = headerEncoder.getEncodedStringForData(authOAuthHeaders);
            return header;
        }

        private _getSignatureForString(data: string): string {
            // Get the key. For getting auth, this doesn't include the token secret
            const keyText = `${this._clientInformation.clientSecret}&${(this._clientInformation.clientTokenSecret || "")}`;
            const keyMaterial = Windows.Security.Cryptography.CryptographicBuffer.convertStringToBinary(keyText, Windows.Security.Cryptography.BinaryStringEncoding.utf8);
            const macAlgorithmProvider = Windows.Security.Cryptography.Core.MacAlgorithmProvider.openAlgorithm("HMAC_SHA1");
            const key = macAlgorithmProvider.createKey(keyMaterial);

            // Hash the actual string to generate the signature
            const tbs = Windows.Security.Cryptography.CryptographicBuffer.convertStringToBinary(data, Windows.Security.Cryptography.BinaryStringEncoding.utf8);
            const signatureBuffer = Windows.Security.Cryptography.Core.CryptographicEngine.sign(key, tbs);
            const signature = Windows.Security.Cryptography.CryptographicBuffer.encodeToBase64String(signatureBuffer);
            return signature;
        }

        private async _sendCore(): Promise<Windows.Web.Http.IHttpContent> {
            // Calculate the data state (E.g. body or URL pay load)
            // Note that this does not use HttpFormUrlEncodedContent to handle the encoding, because
            // of the way we need to handle the headers, and body encoding & payload to calcuate
            // the OAuth hash to authenticate the request. Alternative here would be to drop down
            // to C++/C# and implement message filters ourselves. We're in JS; that's something for
            // consideration another day.
            let url = this._url;
            const bodyDataEncoder = new Codevoid.OAuth.ParameterEncoder();
            let content: Windows.Web.Http.HttpStringContent;

            if (this.data) {
                switch (this._operation) {
                    case Windows.Web.Http.HttpMethod.get:
                        url += "?" + bodyDataEncoder.getEncodedStringForData(this.data);
                        break;

                    case Windows.Web.Http.HttpMethod.post:
                        content = new Windows.Web.Http.HttpStringContent(bodyDataEncoder.getEncodedStringForData(this.data));
                        content.headers.contentType.mediaType = "application/x-www-form-urlencoded";
                        break;
                }
            }

            // Set up the request with the operation type, authentication header, user agentm & other headers if needed
            const request = new Windows.Web.Http.HttpRequestMessage(this._operation, new Windows.Foundation.Uri(url));
            const authHeaderPayload = this._generateAuthHeader();
            const authHeader = new Windows.Web.Http.Headers.HttpCredentialsHeaderValue("OAuth", authHeaderPayload);
            request.headers.authorization = authHeader;
            request.headers.userAgent.append(this._clientInformation.getUserAgentHeader());

            // Don't attach the content if we don't have any; this will confuse the crap out of the
            // HttpClient goo and might set "null" or "undefined" as string payload if we tried to
            // set the content property to those values.
            if (content) {
                request.content = content;
            }

            const httpClient = new Windows.Web.Http.HttpClient();

            // Note that we're using sendRequestAsync rather than getRequestAsync/postRequestAsync
            // versions to allow for a more linear code path, rather than splitting the method calls
            // themselves.
            const responseMessage = await httpClient.sendRequestAsync(request);
            if (!responseMessage.isSuccessStatusCode) {
                // When we barf, start the error
                // payload to look normative
                const response = await responseMessage.content.readAsStringAsync();
                throw { status: responseMessage.statusCode, response };
            }

            return responseMessage.content;
        }

        public async send(): Promise<string> {
            const content = await this._sendCore();
            return content.readAsStringAsync();
        }

        public async retrieveRawContent(): Promise<Windows.Web.Http.IHttpContent> {
            return await this._sendCore();
        }
    }
}