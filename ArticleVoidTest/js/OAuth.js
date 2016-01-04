(function () {
    "use strict";

    function stringKeySorter(first, second) {
        appassert(first && first.key, "first param was falsey");
        appassert(second && second.key, "second param was falsey");

        return first.key.localeCompare(second.key);
    }

    function rfc3986encodeURIComponent(unencoded) {
        /* replace ! */      /* replace ' */    /* replace ( */  /* repalce ) */     /* replace * */
        return encodeURIComponent(unencoded).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A');
    }

    function _encodeKeyValuePairAndInsert(item, destination) {
        appassert(item, "No item provided");
        appassert(destination, "no destination provided");
        appassert(Array.isArray(destination), "destination wasn't an array");
        appassert(item.key, "Item didn't have key");

        destination.push({ key: rfc3986encodeURIComponent(item.key), value: rfc3986encodeURIComponent(item.value) });
    }

    WinJS.Namespace.define("Codevoid.OAuth", {
        ParameterEncoder: WinJS.Class.define(function ParameterEncoderConstructor(options) {
            if (options) {
                this._delimeter = options.delimeter || this._delimeter;
                this._shouldQuoteValues = options.shouldQuoteValues || this._shouldQuoteValues;
            }
        }, {
            _delimeter: "&",
            _shouldQuoteValues: false,
            getEncodedStringForData: function () {
                // We need to build a new array straight off, and then sort that
                // theres no point in merging then iterating again.

                var mergedAndEncodedItems = [];
                for (var i = 0; i < arguments.length; i++) {
                    var argument = arguments[i];
                    if (!argument) {
                        continue
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

                var stringifiedItems = [];
                for (i = 0; i < mergedAndEncodedItems.length; i++) {
                    stringifiedItems.push(this._keyValuePairToString(mergedAndEncodedItems[i]));
                }

                return stringifiedItems.join(this._delimeter);
            },
            _mergeAndEncode: function _mergeAndEncode(source, destination) {
                appassert(source && Array.isArray(source), "Source wasn't an array");
                appassert(destination && Array.isArray(destination), "destination isn't array");

                for (var i = 0; i < source.length; i++) {
                    _encodeKeyValuePairAndInsert(source[i], destination);
                }
            },
            _keyValuePairToString: function _keyValuePairToString(keyValuePair) {
                var result = keyValuePair.key + "=";
                if (!this._shouldQuoteValues) {
                    result += keyValuePair.value;
                } else {
                    result += "\"" + keyValuePair.value + "\"";
                }

                return result;
            }
        }),
    });

    WinJS.Namespace.define("Codevoid.OAuth", {
        ClientInformation: WinJS.Class.define(function ClientSecretConstructor(id, secret, token, tokenSecret) {
            appassert(id, "ID Required");
            appassert(secret, "secret required");

            this._id = id;
            this._secret = secret;
            this._token = token;
            this._tokenSecret = tokenSecret;
        }, {
            _id: null,
            _secret: null,
            _token: null,
            _tokenSecret: null,
            _userAgentHeaderInstance: null,
            clientId: {
                get: function clientId_get() {
                    return this._id;
                }
            },
            clientSecret: {
                get: function clientSecret_get() {
                    return this._secret;
                }
            },
            clientToken: {
                get: function clientToken_get() {
                    return this._token;
                }
            },
            clientTokenSecret: {
                get: function clientTokenSecret_get() {
                    return this._tokenSecret;
                }
            },
            productName: "Codevoid OAuth Helper",
            productVersion: "0.1",
            getUserAgentHeader: function getUserAgentHeader() {
                if (!this._userAgentHeader) {
                    this._userAgentHeader = new Windows.Web.Http.Headers.HttpProductInfoHeaderValue(this.productName, this.productVersion);
                }

                return this._userAgentHeader;
            },
        }),
        OAuthRequest: WinJS.Class.define(function OAuthRequestConstructor(clientInformation, url, operation) {
            appassert(clientInformation, "no client information supplied");
            appassert(url, "No URL Supplied");

            this._clientInformation = clientInformation;
            this._url = url;

            switch (operation) {
                case Codevoid.OAuth.OAuthRequest.Operations.GET:
                    this._operation = Windows.Web.Http.HttpMethod.get;
                    break;

                case Codevoid.OAuth.OAuthRequest.Operations.POST:
                default:
                    this._operation = Windows.Web.Http.HttpMethod.post;
                    break;
            }
        },
        {
            _clientInformation: null,
            _url: null,
            _data: null,
            _operation: null,
            data: {
                get: function get_data() {
                    return this._data;
                },
                set: function set_data(value) {
                    this._data = value;
                }
            },
            _generateAuthHeader: function _generateAuthHeader() {
                // Allow nonce, timestamp to be overridden for testing
                var nonce = this._nonce || Math.floor(Math.random() * 1000000000);
                var timestamp = this._timestamp || Math.round(new Date().getTime() / 1000.0);

                console.log("OAuth nonce: " + nonce);
                console.log("OAuth timestamp: " + timestamp);

                // Build OAuth Items
                var oAuthHeaders = [
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
                var encoder = new Codevoid.OAuth.ParameterEncoder();
                var encodedParams = encoder.getEncodedStringForData(oAuthHeaders, this.data);

                // Get signature
                var encodedParams = this._operation + "&" + rfc3986encodeURIComponent(this._url) + "&" + rfc3986encodeURIComponent(encodedParams);
                var signature = this._getSignatureForString(encodedParams);

                // Build items for parameter encoding for header
                var authOAuthHeaders = [{ key: "oauth_signature", value: signature }].concat(oAuthHeaders);
                var headerEncoder = new Codevoid.OAuth.ParameterEncoder({ shouldQuoteValues: true, delimeter: ", " });

                // Get header string
                var header = headerEncoder.getEncodedStringForData(authOAuthHeaders);
                return header;
            },
            _getSignatureForString: function _getSignatureForString(data) {
                // Get the key. For getting auth, this doesn't include the token secret
                var keyText = this._clientInformation.clientSecret + "&" + (this._clientInformation.clientTokenSecret || "");
                var keyMaterial = Windows.Security.Cryptography.CryptographicBuffer.convertStringToBinary(keyText, Windows.Security.Cryptography.BinaryStringEncoding.Utf8);
                var macAlgorithmProvider = Windows.Security.Cryptography.Core.MacAlgorithmProvider.openAlgorithm("HMAC_SHA1");
                var key = macAlgorithmProvider.createKey(keyMaterial);

                // Hash the actual string to generate the signature
                var tbs = Windows.Security.Cryptography.CryptographicBuffer.convertStringToBinary(data, Windows.Security.Cryptography.BinaryStringEncoding.Utf8);
                var signatureBuffer = Windows.Security.Cryptography.Core.CryptographicEngine.sign(key, tbs);
                var signature = Windows.Security.Cryptography.CryptographicBuffer.encodeToBase64String(signatureBuffer);
                return signature;
            },
            send: function send() {
                return this._sendCore().then(function (content) {
                    return content.readAsStringAsync();
                });
            },
            retrieveRawContent: function retrieveRawContent() {
                return this._sendCore();
            },
            _sendCore: function _sendCore() {
                // Calculate the data state (E.g. body or URL pay load)
                // Note that this does not use HttpFormUrlEncodedContent to handle the encoding, because
                // of the way we need to handle the headers, and body encoding & payload to calcuate
                // the OAuth hash to authenticate the request. Alternative here would be to drop down
                // to C++/C# and implement message filters ourselves. We're in JS; that's something for
                // consideration another day.
                var url = this._url;
                var bodyDataEncoder = new Codevoid.OAuth.ParameterEncoder();
                var content;

                if (this._data) {
                    switch (this._operation) {
                        case Windows.Web.Http.HttpMethod.get:
                            url += "?" + bodyDataEncoder.getEncodedStringForData(this._data);
                            break;

                        case Windows.Web.Http.HttpMethod.post:
                            content = new Windows.Web.Http.HttpStringContent(bodyDataEncoder.getEncodedStringForData(this._data));
                            content.headers.contentType.mediaType = "application/x-www-form-urlencoded";
                            break;
                    }
                }

                // Set up the request with the operation type, authentication header, user agentm & other headers if needed
                var request = new Windows.Web.Http.HttpRequestMessage(this._operation, new Windows.Foundation.Uri(url));
                var authHeaderPayload = this._generateAuthHeader();
                var authHeader = new Windows.Web.Http.Headers.HttpCredentialsHeaderValue("OAuth", authHeaderPayload);
                request.headers.authorization = authHeader;
                request.headers.userAgent.append(this._clientInformation.getUserAgentHeader());

                // Don't attach the content if we don't have any; this will confuse the crap out of the
                // HttpClient goo and might set "null" or "undefined" as string payload if we tried to
                // set the content property to those values.
                if (content) {
                    request.content = content;
                }

                var httpClient = new Windows.Web.Http.HttpClient();

                // Note that we're using sendRequestAsync rather than getRequestAsync/postRequestAsync
                // versions to allow for a more linear code path, rather than splitting the method calls
                // themselves.
                var operation = httpClient.sendRequestAsync(request).then(function (responseMessage) {
                    var error;

                    if(!responseMessage.isSuccessStatusCode) {
                        // When we barf, start the error
                        // payload to look normative
                        return WinJS.Promise.join({
                            status: responseMessage.statusCode,
                            response: responseMessage.content.readAsStringAsync(),
                        }).then(function (result) {
                            return WinJS.Promise.wrapError(result);
                        });
                    }

                    return responseMessage.content;
                });

                return operation;
            }
        }, {
            Operations: {
                GET: "GET",
                POST: "POST",
            },
        })
    });
})();