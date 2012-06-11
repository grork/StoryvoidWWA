(function () {
    "use strict";

    var baseUrl = "https://www.instapaper.com/api/1/";

    // Account Urls
    var AccountEndPoints = {
        access_token: baseUrl + "oauth/access_token",
        verify_credentials: baseUrl + "account/verify_credentials"
    };

    var BookmarksEndPoints = {
        list: baseUrl + "bookmarks/list",
        add: baseUrl + "bookmarks/add",
        deleteBookmark: baseUrl + "bookmarks/delete",
        updateReadProgress: baseUrl + "bookmarks/update_read_progress",
        star: baseUrl + "bookmarks/star",
        unstar: baseUrl + "bookmarks/unstar",
        archive: baseUrl + "bookmarks/archive",
        unarchive: baseUrl + "bookmarks/unarchive",
        getText: baseUrl + "bookmarks/get_text",
    };

    var FolderEndPoints = {
        list: baseUrl + "folders/list",
        add: baseUrl + "folders/add",
        deleteFolder: baseUrl + "folders/delete",
        setOrder: baseUrl + "folders/set_order",
    };

    function extractSingleItemFromJSONArray(data) {
        return extractDataFromJSON(data, true);
    }

    function extractDataFromJSON(data, reduceSingleItemToObject) {
        var objectData = JSON.parse(data);
        appassert(objectData, "didn't parse object data");
        appassert(Array.isArray(objectData), "Wasn't an array");

        if (objectData.length === 1) {
            if (objectData[0].type === "error") {
                throw new Codevoid.ArticleVoid.InstapaperApi.InstapaperApiException(objectData[0].error_code, objectData[0].message);
            }

            if (reduceSingleItemToObject) {
                objectData = objectData[0];
            }
        }

        return objectData;
    }
    
    function extractArrayFromResponse(data) {
        return extractDataFromJSON(data, false);
    }

    function handleSingleItemJSONError(error) {
        return WinJS.Promise.wrapError(extractSingleItemFromJSONArray(error.response));
    }

    WinJS.Namespace.define("Codevoid.ArticleVoid.InstapaperApi", {
        InstapaperApiException: WinJS.Class.derive(Error, function InstapaperApiException_Constructor(error, message) {
            this.error = error;
            this.message = message;
        }, {
            error: 0,
            message: String.empty,
        }),
        Accounts: WinJS.Class.define(function Accounts_Constructor(clientInformation) {
            this._clientInformation = clientInformation;
        },
        {
            _clientInformation: null,
            getAccessToken: function getAccessToken(username, password) {
                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, AccountEndPoints.access_token);
                request.data = [
                    { key: "x_auth_username", value: username },
                    { key: "x_auth_password", value: password },
                    { key: "x_auth_mode", value: "client_auth" }
                ];

                return request.send().then(function extractTokenInfo(responseData) {
                    appassert(responseData, "Didn't get response data");
                    var nameValuePairs = responseData.split("&");
                    var result = {};
                    for (var i = 0; i < nameValuePairs.length; i++) {
                        (function (item) {
                            var tokenParts = item.split("=");
                            var key = decodeURIComponent(tokenParts[0]);
                            result[key] = decodeURIComponent(tokenParts[1]);
                        })(nameValuePairs[i]);
                    }

                    return result;
                });
            },
            verifyCredentials: function verifyCredentials() {
                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, AccountEndPoints.verify_credentials);
                return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
            }
        }),
        Bookmarks: WinJS.Class.define(function Bookmarks_Constructor(clientInformation) {
            this._clientInformation = clientInformation;
        },
        {
            _clientInformation: null,
            list: function list(parameters) {
                var data = [];
                if (parameters) {
                    if (parameters.limit) {
                        data.push({ key: "limit", value: parameters.limit });
                    }

                    if (parameters.folder_id) {
                        data.push({ key: "folder_id", value: parameters.folder_id });
                    }
                    if (parameters.have && parameters.have.length) {
                        appassert(Array.isArray(parameters.have, "expected 'have' parameter to be an array"));
                        appassert(parameters.have.length > 0, "didn't actually supply any parameters");

                        var haveStrings = [];
                        parameters.have.forEach(function (have) {
                            haveStrings.push(Codevoid.ArticleVoid.InstapaperApi.Bookmarks._convertHaveObjectToString(have));
                        });

                        appassert(haveStrings.length > 0, "didn't get any have strings to send");
                        data.push({ key: "have", value: haveStrings.join(",") });
                    }
                }

                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.list);

                if (data.length) {
                    request.data = data;
                }

                return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError).then(function stripMetaAndUserObject(data) {
                    appassert(Array.isArray(data), "Expected array for data");
                    appassert(data.length > 1, "expected at least 2 objects");
                    // Dump the meta object...
                    data.shift();
                    // .. and the user object.
                    data.shift();
                    return data;
                });
            },
            add: function add(parameters) {
                if (!parameters.url) {
                    throw new Error("Requires URL");
                }

                var data = [{ key: "url", value: parameters.url }];

                if (parameters.title) {
                    data.push({ key: "title", value: parameters.title });
                }

                if (parameters.description) {
                    data.push({ key: "description", value: parameters.description });
                }

                if (parameters.folder_id) {
                    data.push({ key: "folder_id", value: parameters.folder_id });
                }

                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.add);
                request.data = data;
                return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
            },
            deleteBookmark: function deleteBookmark(bookmark_id) {
                if (!bookmark_id) {
                    throw new Error("Requires bookmark ID to delete");
                }

                var data = [{ key: "bookmark_id", value: bookmark_id }];
                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.deleteBookmark);
                request.data = data;
                return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
            },
            updateReadProgress: function updateReadProgress(parameters) {
                if (!parameters.bookmark_id) {
                    throw new Error("Requires Bookmark ID");
                }

                if ((parameters.progress < 0.0) || (parameters.progress > 1.0)) {
                    throw new Error("Must have valid progres between 0.0 and 1.0");
                }

                if (!parameters.progress_timestamp) {
                    throw new Error("Requires timestamp");
                }

                var data = [{ key: "bookmark_id", value: parameters.bookmark_id },
                           { key: "progress", value: parameters.progress },
                           { key: "progress_timestamp", value: parameters.progress_timestamp }];

                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.updateReadProgress);
                request.data = data;
                return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
            },
            star: function star(bookmark_id) {
                if (!bookmark_id) {
                    throw new Error("Bookmark ID required");
                }

                var data = [{ key: "bookmark_id", value: bookmark_id }];

                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.star);
                request.data = data;

                return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
            },
            unstar: function unstar(bookmark_id) {
                if (!bookmark_id) {
                    throw new Error("Bookmark ID required");
                }

                var data = [{ key: "bookmark_id", value: bookmark_id }];

                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.unstar);
                request.data = data;

                return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
            },
            archive: function archive(bookmark_id) {
                if(!bookmark_id) {
                    throw new Error("Bookmark ID required");
                }

                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.archive);
                request.data = [{ key: "bookmark_id", value: bookmark_id }]

                return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
            },
            unarchive: function unarchive(bookmark_id) {
                if (!bookmark_id) {
                    throw new Error("Bookmark ID required");
                }

                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.unarchive);
                request.data = [{ key: "bookmark_id", value: bookmark_id }];
                
                return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
            },
            getText: function getText(bookmark_id) {
                if (!bookmark_id) {
                    throw new Error("bookmark ID required");
                }

                var data = [{ key: "bookmark_id", value: bookmark_id }];
                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.getText);
                request.data = data;

                return request.send().then(function (response) {
                    return response;
                }, handleSingleItemJSONError);
            },
        }, {
            _convertHaveObjectToString: function _convertHaveToString(have) {
                if (!isNaN(have)) {
                    return have.toString();
                }

                appassert(have.id, "Needs an ID at minimum");
                var haveString = have.id.toString();
                if (have.hash) {
                    haveString += ":" + have.hash;
                }

                if (have.progress) {
                    if (!have.progressLastChanged) {
                        throw new Error("No progress last changed provided");
                    }

                    haveString += ":" + have.progress + ":" + have.progressLastChanged;
                }

                return haveString;
            },
        }),
        Folders: WinJS.Class.define(function Folders_Constructor(clientInformation) {
            this._clientInformation = clientInformation;
        }, {
            _clientInformation: null,
            list: function list() {
                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, FolderEndPoints.list);
                return request.send().then(extractArrayFromResponse, handleSingleItemJSONError);
            },
            add: function add(title) {
                if (!title) {
                    throw new Error("Title is required to create a folder");
                }

                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, FolderEndPoints.add);
                request.data = [{ key: "title", value: title }];
                return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
            },
            deleteFolder: function deleteFolder(folder_id) {
                if (!folder_id) {
                    throw new Error("Folder ID is required to delete a folder");
                }

                var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, FolderEndPoints.deleteFolder);
                request.data = [{ key: "folder_id", value: folder_id }];
                return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
            }
        }),
    });
})();