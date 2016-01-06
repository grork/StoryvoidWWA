// Originally sourced from https://github.com/aaronpowell/db.js/tree/master/tests/public/specs
// Ported from node/jasmine to qunit. Mostly becuase thats what I had. Tough. :p

(function () {
    "use strict";

    function waitFor(clause, timeout, existingSignal, dontThrowOnTimeout) {
        if (timeout === undefined) {
            timeout = 1000;
        }

        var signal = existingSignal || new WinJS._Signal();

        if (timeout < 1) {
            if (!dontThrowOnTimeout) {
                ok(false, "timed out waiting");
            }
            signal.complete();
            return;
        }

        if (clause()) {
            signal.complete();
        } else {
            setTimeout(waitFor.bind(this, clause, timeout - 5, signal, dontThrowOnTimeout), 5);
        }

        return signal._promise;
    }

    function runTestWithCleanup(before, test, after) {
        stop();

        if (before) {
            before = WinJS.Promise.as(before());
        } else {
            before = WinJS.Promise.as();
        }

        before.then(test).then(after, after).done(start, start);
    }

    var isDone = false;
    function waitForTest() {
        stop();
        setTimeout(function () { isDone = true; }, 100);
        waitFor(function () { return isDone; }).done(function () {
            ok(isDone, "Didn't actually set isDone");
            start();
        });
    }

    var isDoneTimeout = false;
    function waitForTestWithTimeout() {
        stop();
        setTimeout(function () { isDoneTimeout = true; }, 5000);
        waitFor(function () { return isDoneTimeout; }, 100, null, true).done(function () {
            ok(!isDoneTimeout, "Test didn't timeout.");
            start();
        });
    }

    var wasRunBefore = false;
    var wasRunTest = false;
    var wasRunAfter = false;
    function runBeforeAndAfterTest() {
        stop();
        var b = function before() {
            ok(!wasRunBefore, "Was Run before already set");
            ok(!wasRunTest, "Test was run before");
            ok(!wasRunAfter, "Was Run After already set");
            wasRunBefore = true;
        }

        var t = function theTest() {
            ok(wasRunBefore, "Was Run before not set");
            ok(!wasRunTest, "Test was run before");
            ok(!wasRunAfter, "Was Run After already set");
            wasRunTest = true;
        }

        var a = function after() {
            ok(wasRunBefore, "Was Run before already set");
            ok(wasRunTest, "Test wasn't run");
            ok(!wasRunAfter, "Was Run After already set");
            wasRunAfter = true;
        }

        runTestWithCleanup(b, t, a);

        waitFor(function () {
            return wasRunBefore && wasRunTest && wasRunAfter;
        }).done(function () {
            ok(wasRunBefore && wasRunTest && wasRunAfter, "not all parts were run");
            start();
        });
    }

    module("testHelpers");
    test("waitForTest", waitForTest);
    test("waitForTestWithTimeout", waitForTestWithTimeout);
    test("runBeforeAndAfterTest", runBeforeAndAfterTest);

    module("dbase");
    var dbName = "testDb";
    var indexedDB = window.indexedDB;
    var currentServer;

    function before() {
        var done = false;

        var req = indexedDB.deleteDatabase(dbName);

        req.onsuccess = function () {
            done = true;
        };

        req.onerror = function () {
            console.log('error deleting db', arguments);
        };

        req.onblocked = function () {
            console.log('db blocked on delete', arguments);
        };

        return waitFor(function () {
            return done;
        })
    }

    var dbId = 0;
    function after() {
        var done = false;
        if (currentServer) {
            try {
                currentServer.close();
            } catch (e) {
            }
            currentServer = null;
        }

        var reqId = dbId++;
        var req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = function () {
            console.log("deleted db: " + reqId);
            done = true;
        };

        req.onerror = function () {
            console.log("failed to delete db: " + reqId + " ", arguments);
        };

        req.onblocked = function () {
            console.log("db blocked: " + reqId + " ", arguments);
        };

        return waitFor(function () {
            return done;
        })
    }

    function dbTestWrapper(testFn) {
        return function () {
            runTestWithCleanup(before, testFn, after);
        }
    }

    function openDbSuccessfully() {
        db.open({
            server: dbName,
            version: 1
        }).done(function (s) {
            currentServer = s;
        });

        return waitFor(function () {
            return currentServer;
        }).then(function () {
            ok(currentServer, "Current server was never set");
        });
    }

    function closeClearsCache() {
        return db.open({
            server: dbName,
            version: 1
        }).then(function (s) {
            currentServer = s;
            currentServer.close();
        }).then(function () {
            var cache = db._getCache();
            strictEqual(cache[dbName], undefined, "DB Was still in the cache");
        });
    }

    function usesProvidedSchema() {
        var server;

        db.open({
            server: dbName,
            version: 1,
            schema: {
                test: {
                    key: {
                        keyPath: 'id',
                        autoIncrement: true
                    }
                }
            }
        }).done(function (s) {
            server = s;
        });

        return waitFor(function () {
            return server;
        }).then(function () {
            ok(server, "no database returned");
            server.close();
            var done =  false;

            var req = indexedDB.open( dbName );
            req.onsuccess = function ( e ) {
                var db = e.target.result;
                    
                strictEqual(db.objectStoreNames.length, 1, "Didn't find expected store names");
                strictEqual(db.objectStoreNames[0], "test", "Expected store name to match");
                    
                db.close();
                done = true;
            };

            return waitFor(function () {
                return done;
            });
        });
    }

    function objectStoreNamesPropertyContainsTableNames() {
        var server;

        db.open({
            server: dbName,
            version: 1,
            schema: {
                test: {
                    key: {
                        keyPath: 'id',
                        autoIncrement: true
                    }
                }
            }
        }).done(function (s) {
            server = s;
        });

        return waitFor(function () {
            return server;
        }).then(function () {
            ok(server, "no database returned");

            ok(server.objectStoreNames, "expected list of object stores");
            strictEqual(server.objectStoreNames.length, 1, "only expected on object store");
            strictEqual(server.objectStoreNames[0], "test", "wrong store name returned");
            server.close();
        });
    }

    function failsWhenMissingKeyPathOnSchema() {
        var server;

        return db.open({
            server: dbName,
            version: 1,
            schema: {
                test: {
                    key: "notReal"
                }
            }
        }).then(function (s) {
            ok(false, "should have failed");
            server = s;
        }, function (e) {
            ok(true, "Failed badly");
        });
    }

    function callsUpgradeOnCreate() {
        var server;
        var upgradeWasCalled = false;
        var upgradeHadServerObject = false;

        var upgradeCalled = function upgradeCalled(server, e) {
            upgradeWasCalled = true;
            upgradeHadServerObject = !!server;
        };

        db.open({
            server: dbName,
            version: 1,
            schema: {
                test: {
                    key: {
                        keyPath: 'id',
                        autoIncrement: true
                    }
                }
            }
        }, upgradeCalled).done(function (s) {
            server = s;
        });

        return waitFor(function () {
            return server;
        }).then(function () {
            ok(upgradeWasCalled, "Upgrade wasn't called");
            ok(upgradeHadServerObject, "Upgrade wasn't passed a server object");
            ok(server, "no database returned");
            server.close();
            var done = false;

            var req = indexedDB.open(dbName);
            req.onsuccess = function (e) {
                var db = e.target.result;

                strictEqual(db.objectStoreNames.length, 1, "Didn't find expected store names");
                strictEqual(db.objectStoreNames[0], "test", "Expected store name to match");

                db.close();
                done = true;
            };

            return waitFor(function () {
                return done;
            });
        });
    }

    function canUseExistingTransactionForOperations() {
        var server;
        var upgradeDone;

        var upgradeCalled = function (server, e) {
            server.add("test", { name: "bob" }).done(function () {
                upgradeDone = true;
            });
        };

        db.open({
            server: dbName,
            version: 1,
            schema: {
                test: {
                    key: {
                        keyPath: 'id',
                        autoIncrement: true
                    }
                }
            }
        }, upgradeCalled).done(function(s) {
            server = s;
        });

        return waitFor(function () {
            return server;
        }).then(function() {
            return server.query("test").execute();
        }).then(function(results) {
            ok(true, "expected results");
            strictEqual(results.length, 1, "Didn't find right number of results");
            strictEqual(results[0].name, "bob", "data wasn't correct");
            server.close();
            return true;
        });
    }

    function canDeleteDb() {
        return db.open({
            server: dbName,
            version: 1
        }).then(function (s) {
            currentServer = s;
            currentServer.close();
        }).then(function () {
            var cache = db._getCache();
            strictEqual(cache[dbName], undefined, "DB Was still in the cache");

            return db.deleteDb(dbName);
        }).then(function deleted(e) {
            ok(true, "DB wasn't deleted");
        }, function errored(e) {
            ok(false, "DB failed to be deleted");
        });
    }

    test("openDbSuccessfully", dbTestWrapper(openDbSuccessfully));
    test("closeClearsCache", dbTestWrapper(closeClearsCache));
    test("usesProvidedSchema", dbTestWrapper(usesProvidedSchema));
    test("objectStoreNamesPropertyContainsTableNames", dbTestWrapper(objectStoreNamesPropertyContainsTableNames));
    test("failsWhenMissingKeyPathOnSchema", dbTestWrapper(failsWhenMissingKeyPathOnSchema));
    test("callsUpgradeOnCreate", dbTestWrapper(callsUpgradeOnCreate));
    test("canUseExistingTransactionForOperations", dbTestWrapper(canUseExistingTransactionForOperations));
    test("canDeleteDb", dbTestWrapper(canDeleteDb));

    module("dbaseAddData");

    function dbTestWrapperCreateDb(testFn) {
        return function () {
            runTestWithCleanup(function () {
                return before().then(function () {
                    db.open({
                        server: dbName,
                        version: 1,
                        schema: {
                            test: {
                                key: {
                                    keyPath: 'id',
                                    autoIncrement: true
                                }
                            }
                        }
                    }).done(function (s) {
                        currentServer = s;
                    });

                    return waitFor(function () {
                        return currentServer;
                    });
                });
            }, testFn, after);
        }
    }

    function canInsertItemIntoStore() {
        ok(currentServer, "need current server");
        var item = { firstName: "Aaron", lastName: "Powell" };

        currentServer.add("test", item).done(function (records) {
            ok(records, "Didn't get any records back");
            strictEqual(records.length, 1, "Got more than one record back");
            item = records[0];
        });

        return waitFor(function () {
            return item.id;
        }).then(function () {
            strictEqual(item.id, 1, "Item wasn't the first ID, or didn't have one");
        });
    }

    function canInsertMultipleItemsIntoStore() {
        ok(currentServer, "need current server");
        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };
        var item2 = {
            firstName: "John",
            lastName: "Smith"
        };

        currentServer.add("test", [item1, item2]).done(function (items) {
            ok(items, "no items returned");
            strictEqual(items.length, 2, "incorrect number of items returned");

            item1.id = items[0].id;
            item2.id = items[1].id;
        });

        return waitFor(function () {
            return item1.id;
        }).then(function () {
            strictEqual(item1.id, 1, "item 1 had incorrect id");
            strictEqual(item2.id, 2, "item 2 had incorrect id");
        });
    }

    function canInsertItemWithPutIntoStore() {
        ok(currentServer, "need current server");
        var item = { firstName: "Aaron", lastName: "Powell" };

        currentServer.put("test", item).done(function (records) {
            ok(records, "Didn't get any records back");
            strictEqual(records.length, 1, "Got more than one record back");
            item = records[0];
        });

        return waitFor(function () {
            return item.id;
        }).then(function () {
            strictEqual(item.id, 1, "Item wasn't the first ID, or didn't have one");
        });
    }

    function canInsertMultipleItemsWithPutIntoStore() {
        ok(currentServer, "need current server");
        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };
        var item2 = {
            firstName: "John",
            lastName: "Smith"
        };

        currentServer.put("test", [item1, item2]).done(function (items) {
            ok(items, "no items returned");
            strictEqual(items.length, 2, "incorrect number of items returned");

            item1.id = items[0].id;
            item2.id = items[1].id;
        });

        return waitFor(function () {
            return item1.id;
        }).then(function () {
            strictEqual(item1.id, 1, "item 1 had incorrect id");
            strictEqual(item2.id, 2, "item 2 had incorrect id");
        });
    }

    function canUpdateMultipleItemsWithPutIntoStore() {
        ok(currentServer, "need current server");
        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };
        var item2 = {
            firstName: "John",
            lastName: "Smith"
        };

        currentServer.put("test", [item1, item2]).done(function (items) {
            ok(items, "no items returned");
            strictEqual(items.length, 2, "incorrect number of items returned");

            item1.id = items[0].id;
            item2.id = items[1].id;
        });

        return waitFor(function () {
            return item1.id;
        }).then(function () {
            strictEqual(item1.id, 1, "item 1 had incorrect id");
            strictEqual(item2.id, 2, "item 2 had incorrect id");
        }).then(function () {
            item1.firstName = "Erin";
            item2.firstName = "Jon";
            return currentServer.put("test", [item1, item2]);
        }).then(function () {
            return currentServer.query("test").execute();
        }).then(function (results) {
            ok(results, "Didn't get any query results");
            strictEqual(results.length, 2, "Got unexpected number of results");

            strictEqual(results[0].firstName, "Erin", "Name didn't match the updated value");
            strictEqual(results[1].firstName, "Jon", "Name didn't match updated value");
        });
    }

    test("canInsertItemIntoStore", dbTestWrapperCreateDb(canInsertItemIntoStore));
    test("canInsertMultipleItemsIntoStore", dbTestWrapperCreateDb(canInsertMultipleItemsIntoStore));
    test("canInsertItemWithPutIntoStore", dbTestWrapperCreateDb(canInsertItemWithPutIntoStore));
    test("canInsertMultipleItemsWithPutIntoStore", dbTestWrapperCreateDb(canInsertMultipleItemsWithPutIntoStore));
    test("canUpdateMultipleItemsWithPutIntoStore", dbTestWrapperCreateDb(canUpdateMultipleItemsWithPutIntoStore));

    module("dbaseRemove");

    function canRemoveAddedItem() {
        ok(currentServer, "need current server");
        var item = { firstName: "Aaron", lastName: "Powell" };

        currentServer.add("test", item).done(function (records) {
            ok(records, "Didn't get any records back");
            strictEqual(records.length, 1, "Got more than one record back");
            item = records[0];
        });

        return waitFor(function () {
            return item.id;
        }).then(function () {
            return currentServer.remove("test", item.id);
        }).then(function () {
            var done = false;
            currentServer.get("test", item.id).done(function (removed) {
                strictEqual(removed, undefined, "Expected item to be removed");
                done = true;
            });

            return waitFor(function () {
                return done;
            });
        });
    }

    function removingNonExistantItemDoesntError() {
        ok(currentServer, "need current server");
        var item = { firstName: "Aaron", lastName: "Powell" };

        currentServer.add("test", item).done(function (records) {
            ok(records, "Didn't get any records back");
            strictEqual(records.length, 1, "Got more than one record back");
            item = records[0];
        });

        return waitFor(function () {
            return item.id;
        }).then(function () {
            return currentServer.remove("test", "xxx");
        }).then(function (data) {
            ok(!data, "Expected no data");
        });
    }

    test("canRemoveAddedItem", dbTestWrapperCreateDb(canRemoveAddedItem));
    test("removingNonExistantItemDoesntError", dbTestWrapperCreateDb(removingNonExistantItemDoesntError));

    module("dbaseQuery");

    function canGetById() {
        ok(currentServer, "need current server");

        var item = {
            firstName: "Aaron",
            lastName: "Powell"
        };

        currentServer.add("test", item).done(function (data) {
            ok(data, "Didn't get data");
            strictEqual(data.length, 1, "Inserted more data than expected");
            item = data[0]
        });

        return waitFor(function () {
            return item.id;
        }).then(function () {
            var done = false;
            currentServer.get("test", item.id).done(function (data) {
                ok(data, "didn't get data back");
                strictEqual(data.id, item.id, "ID's didn't match");
                strictEqual(data.firstName, item.firstName, "First names didn't match");
                strictEqual(data.lastName, item.lastName, "Last names didn't match");
                done = true;
            });

            return waitFor(function () {
                return done;
            });
        });
    }

    function gettingInvalidIdReturnsNull() {
        ok(currentServer, "need current server");

        var done = false;
        currentServer.get("test", 7).done(function (data) {
            ok(data === undefined, "Didn't expect to get any data");
            done = true;
        });

        return waitFor(function () {
            return done;
        });
    };

    function canGetAll() {
        ok(currentServer, "need current server");

        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };
        var item2 = {
            firstName: "John",
            lastName: "Smith"
        };

        var done = false;
        currentServer.add("test", [item1, item2]).done(function () {
            done = true;
        });

        return waitFor(function () {
            return done;
        }).then(function () {
            done = false;

            currentServer.query("test").execute().done(function (results) {
                ok(results, "no results");
                strictEqual(results.length, 2, "Incorrect number of results");
                strictEqual(results[0].firstName, item1.firstName, "item 1 First names don't match");
                strictEqual(results[1].firstName, item2.firstName, "item 2 First names don't match");

                done = true;
            });

            return waitFor(function() { return done; });
        });
    }

    function canQueryASingleProperty() {
        ok(currentServer, "need a server");

        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };
        var item2 = {
            firstName: "John",
            lastName: "Smith"
        };
        var item3 = {
            firstName: "Aaron",
            lastName: "Powell"
        };

        var done = false;
        currentServer.add("test", [item1, item2, item3]).done(function () {
            done = true;
        });

        return waitFor(function () {
            return done;
        }).then(function () {
            done = false;

            currentServer.query("test").filter("firstName", "Aaron").execute().done(function (results) {
                ok(results, "no results");
                strictEqual(results.length, 2, "Incorrect number of results");
                strictEqual(results[0].firstName, item1.firstName, "item 1 First names don't match");
                strictEqual(results[1].firstName, item3.firstName, "item 2 First names don't match");

                done = true;
            });

            return waitFor(function () { return done; });
        });
    }

    function canQueryUsingFilterFunction() {
        ok(currentServer, "need a server");

        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };
        var item2 = {
            firstName: "John",
            lastName: "Smith"
        };
        var item3 = {
            firstName: "Aaron",
            lastName: "Powell"
        };

        var done = false;
        currentServer.add("test", [item1, item2, item3]).done(function () {
            done = true;
        });

        return waitFor(function () {
            return done;
        }).then(function () {
            done = false;

            currentServer.query("test").filter(function (data) {
                return data.firstName === "Aaron" && data.lastName === "Powell";
            }).execute().done(function (results) {
                ok(results, "no results");
                strictEqual(results.length, 2, "Incorrect number of results");
                strictEqual(results[0].firstName, item1.firstName, "item 1 First names don't match");
                strictEqual(results[1].firstName, item3.firstName, "item 2 First names don't match");

                done = true;
            });

            return waitFor(function () { return done; });
        });
    }

    test("canGetById", dbTestWrapperCreateDb(canGetById));
    test("canGetAll", dbTestWrapperCreateDb(canGetAll));
    test("gettingInvalidIdReturnsNull", dbTestWrapperCreateDb(gettingInvalidIdReturnsNull));
    test("canQueryASingleProperty", dbTestWrapperCreateDb(canQueryASingleProperty));
    test("canQueryUsingFilterFunction", dbTestWrapperCreateDb(canQueryUsingFilterFunction));

    module("dbaseIndexes");

    function canCreateDbWithIndexes() {
        db.open({
            server: dbName,
            version: 1,
            schema: {
                test: {
                    key: {
                        keyPath: 'id',
                        autoIncrement: true
                    },
                    indexes: {
                        firstName: {}
                    }
                }
            }
        }).done(function (s) {
            ok(s, "Expected a completed DB");
            currentServer = s;
        });

        return waitFor(function () { return currentServer; }).then(function () {
            var done;
            currentServer.close();

            var req = indexedDB.open(dbName, 1);
            req.onsuccess = function (e) {
                var res = e.target.result;

                var transaction = res.transaction('test');
                var store = transaction.objectStore('test');

                strictEqual(store.indexNames.length, 1, "Didn't find correct number of indexes");
                strictEqual(store.indexNames[0], "firstName", "Index names didn't match");

                e.target.result.close();
                done = true;
            };

            return waitFor(function () { return done; });
        });
    }

    function canQueryDbUsingIndexes() {
        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };
        var item2 = {
            firstName: "John",
            lastName: "Smith"
        };
        var item3 = {
            firstName: "Aaron",
            lastName: "Powell"
        };

        db.open({
            server: dbName,
            version: 1,
            schema: {
                test: {
                    key: {
                        keyPath: 'id',
                        autoIncrement: true
                    },
                    indexes: {
                        firstName: {}
                    }
                }
            }
        }).done(function (s) {
            ok(s, "Expected a completed DB");
            currentServer = s;
        });
        var done;

        return waitFor(function () { return currentServer; }).then(function () {

            currentServer.add("test", [item1, item2, item3]).done(function () {
                done = true;
            });

            return waitFor(function () { return done; });
        }).then(function () {
            ok(done, "Previous data wasn't complete")
            done = false;
            currentServer.index("test", "firstName").only("Aaron").done(function (results) {
                ok(results, "Expected a result set");
                strictEqual(results.length, 2, "didn't get back expected record counts");
                done = true;
            });

            return waitFor(function () { return done; });
        });
    }

    function canQueryDbIndexForNonExistantItem() {
        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };


        db.open({
            server: dbName,
            version: 1,
            schema: {
                test: {
                    key: {
                        keyPath: 'id',
                        autoIncrement: true
                    },
                    indexes: {
                        firstName: {}
                    }
                }
            }
        }).done(function (s) {
            ok(s, "Expected a completed DB");
            currentServer = s;
        });
        var done;

        return waitFor(function () { return currentServer; }).then(function () {

            currentServer.add("test", [item1]).done(function () {
                done = true;
            });

            return waitFor(function () { return done; });
        }).then(function () {
            ok(done, "Previous data wasn't complete")
            done = false;
            currentServer.index("test", "firstName").only("Bob").done(function (results) {
                ok(results, "Expected a result set");
                strictEqual(results.length, 0, "didn't get back expected record counts");
                done = true;
            });

            return waitFor(function () { return done; });
        });
    }

    test("canCreateDbWithIndexes", dbTestWrapper(canCreateDbWithIndexes));
    test("canQueryDbUsingIndexes", dbTestWrapper(canQueryDbUsingIndexes));
    test("canQueryDbIndexForNonExistantItem", dbTestWrapper(canQueryDbIndexForNonExistantItem));
})();