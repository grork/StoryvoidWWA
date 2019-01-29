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
                QUnit.assert.ok(false, "timed out waiting");
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
        QUnit.stop();

        if (before) {
            before = WinJS.Promise.as(before());
        } else {
            before = WinJS.Promise.as();
        }

        before.then(test).then(after, after).done(QUnit.start, QUnit.start);
    }

    var isDone = false;
    function waitForTest() {
        QUnit.stop();
        setTimeout(function () { isDone = true; }, 100);
        waitFor(function () { return isDone; }).done(function () {
            QUnit.assert.ok(isDone, "Didn't actually set isDone");
            QUnit.start();
        });
    }

    var isDoneTimeout = false;
    function waitForTestWithTimeout() {
        QUnit.stop();
        setTimeout(function () { isDoneTimeout = true; }, 5000);
        waitFor(function () { return isDoneTimeout; }, 100, null, true).done(function () {
            QUnit.assert.ok(!isDoneTimeout, "Test didn't timeout.");
            QUnit.start();
        });
    }

    var wasRunBefore = false;
    var wasRunTest = false;
    var wasRunAfter = false;
    function runBeforeAndAfterTest() {
        QUnit.stop();
        var b = function before() {
            QUnit.assert.ok(!wasRunBefore, "Was Run before already set");
            QUnit.assert.ok(!wasRunTest, "Test was run before");
            QUnit.assert.ok(!wasRunAfter, "Was Run After already set");
            wasRunBefore = true;
        }

        var t = function theTest() {
            QUnit.assert.ok(wasRunBefore, "Was Run before not set");
            QUnit.assert.ok(!wasRunTest, "Test was run before");
            QUnit.assert.ok(!wasRunAfter, "Was Run After already set");
            wasRunTest = true;
        }

        var a = function after() {
            QUnit.assert.ok(wasRunBefore, "Was Run before already set");
            QUnit.assert.ok(wasRunTest, "Test wasn't run");
            QUnit.assert.ok(!wasRunAfter, "Was Run After already set");
            wasRunAfter = true;
        }

        runTestWithCleanup(b, t, a);

        waitFor(function () {
            return wasRunBefore && wasRunTest && wasRunAfter;
        }).done(function () {
            QUnit.assert.ok(wasRunBefore && wasRunTest && wasRunAfter, "not all parts were run");
            QUnit.start();
        });
    }

    QUnit.module("testHelpers");
    QUnit.test("waitForTest", waitForTest);
    QUnit.test("waitForTestWithTimeout", waitForTestWithTimeout);
    QUnit.test("runBeforeAndAfterTest", runBeforeAndAfterTest);

    QUnit.module("dbase");
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
            QUnit.assert.ok(currentServer, "Current server was never set");
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
            QUnit.assert.strictEqual(cache[dbName], undefined, "DB Was still in the cache");
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
            QUnit.assert.ok(server, "no database returned");
            server.close();
            var done =  false;

            var req = indexedDB.open( dbName );
            req.onsuccess = function ( e ) {
                var db = e.target.result;
                    
                QUnit.assert.strictEqual(db.objectStoreNames.length, 1, "Didn't find expected store names");
                QUnit.assert.strictEqual(db.objectStoreNames[0], "test", "Expected store name to match");
                    
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
            QUnit.assert.ok(server, "no database returned");

            QUnit.assert.ok(server.objectStoreNames, "expected list of object stores");
            QUnit.assert.strictEqual(server.objectStoreNames.length, 1, "only expected on object store");
            QUnit.assert.strictEqual(server.objectStoreNames[0], "test", "wrong store name returned");
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
            QUnit.assert.ok(false, "should have failed");
            server = s;
        }, function (e) {
            QUnit.assert.ok(true, "Failed badly");
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
            QUnit.assert.ok(upgradeWasCalled, "Upgrade wasn't called");
            QUnit.assert.ok(upgradeHadServerObject, "Upgrade wasn't passed a server object");
            QUnit.assert.ok(server, "no database returned");
            server.close();
            var done = false;

            var req = indexedDB.open(dbName);
            req.onsuccess = function (e) {
                var db = e.target.result;

                QUnit.assert.strictEqual(db.objectStoreNames.length, 1, "Didn't find expected store names");
                QUnit.assert.strictEqual(db.objectStoreNames[0], "test", "Expected store name to match");

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
            QUnit.assert.ok(true, "expected results");
            QUnit.assert.strictEqual(results.length, 1, "Didn't find right number of results");
            QUnit.assert.strictEqual(results[0].name, "bob", "data wasn't correct");
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
            QUnit.assert.strictEqual(cache[dbName], undefined, "DB Was still in the cache");

            return db.deleteDb(dbName);
        }).then(function deleted(e) {
            QUnit.assert.ok(true, "DB wasn't deleted");
        }, function errored(e) {
            QUnit.assert.ok(false, "DB failed to be deleted");
        });
    }

    QUnit.test("openDbSuccessfully", dbTestWrapper(openDbSuccessfully));
    QUnit.test("closeClearsCache", dbTestWrapper(closeClearsCache));
    QUnit.test("usesProvidedSchema", dbTestWrapper(usesProvidedSchema));
    QUnit.test("objectStoreNamesPropertyContainsTableNames", dbTestWrapper(objectStoreNamesPropertyContainsTableNames));
    QUnit.test("failsWhenMissingKeyPathOnSchema", dbTestWrapper(failsWhenMissingKeyPathOnSchema));
    QUnit.test("callsUpgradeOnCreate", dbTestWrapper(callsUpgradeOnCreate));
    QUnit.test("canUseExistingTransactionForOperations", dbTestWrapper(canUseExistingTransactionForOperations));
    QUnit.test("canDeleteDb", dbTestWrapper(canDeleteDb));

    QUnit.module("dbaseAddData");

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
        QUnit.assert.ok(currentServer, "need current server");
        var item = { firstName: "Aaron", lastName: "Powell" };

        currentServer.add("test", item).done(function (records) {
            QUnit.assert.ok(records, "Didn't get any records back");
            QUnit.assert.strictEqual(records.length, 1, "Got more than one record back");
            item = records[0];
        });

        return waitFor(function () {
            return item.id;
        }).then(function () {
            QUnit.assert.strictEqual(item.id, 1, "Item wasn't the first ID, or didn't have one");
        });
    }

    function canInsertMultipleItemsIntoStore() {
        QUnit.assert.ok(currentServer, "need current server");
        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };
        var item2 = {
            firstName: "John",
            lastName: "Smith"
        };

        currentServer.add("test", [item1, item2]).done(function (items) {
            QUnit.assert.ok(items, "no items returned");
            QUnit.assert.strictEqual(items.length, 2, "incorrect number of items returned");

            item1.id = items[0].id;
            item2.id = items[1].id;
        });

        return waitFor(function () {
            return item1.id;
        }).then(function () {
            QUnit.assert.strictEqual(item1.id, 1, "item 1 had incorrect id");
            QUnit.assert.strictEqual(item2.id, 2, "item 2 had incorrect id");
        });
    }

    function canInsertItemWithPutIntoStore() {
        QUnit.assert.ok(currentServer, "need current server");
        var item = { firstName: "Aaron", lastName: "Powell" };

        currentServer.put("test", item).done(function (records) {
            QUnit.assert.ok(records, "Didn't get any records back");
            QUnit.assert.strictEqual(records.length, 1, "Got more than one record back");
            item = records[0];
        });

        return waitFor(function () {
            return item.id;
        }).then(function () {
            QUnit.assert.strictEqual(item.id, 1, "Item wasn't the first ID, or didn't have one");
        });
    }

    function canInsertMultipleItemsWithPutIntoStore() {
        QUnit.assert.ok(currentServer, "need current server");
        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };
        var item2 = {
            firstName: "John",
            lastName: "Smith"
        };

        currentServer.put("test", [item1, item2]).done(function (items) {
            QUnit.assert.ok(items, "no items returned");
            QUnit.assert.strictEqual(items.length, 2, "incorrect number of items returned");

            item1.id = items[0].id;
            item2.id = items[1].id;
        });

        return waitFor(function () {
            return item1.id;
        }).then(function () {
            QUnit.assert.strictEqual(item1.id, 1, "item 1 had incorrect id");
            QUnit.assert.strictEqual(item2.id, 2, "item 2 had incorrect id");
        });
    }

    function canUpdateMultipleItemsWithPutIntoStore() {
        QUnit.assert.ok(currentServer, "need current server");
        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };
        var item2 = {
            firstName: "John",
            lastName: "Smith"
        };

        currentServer.put("test", [item1, item2]).done(function (items) {
            QUnit.assert.ok(items, "no items returned");
            QUnit.assert.strictEqual(items.length, 2, "incorrect number of items returned");

            item1.id = items[0].id;
            item2.id = items[1].id;
        });

        return waitFor(function () {
            return item1.id;
        }).then(function () {
            QUnit.assert.strictEqual(item1.id, 1, "item 1 had incorrect id");
            QUnit.assert.strictEqual(item2.id, 2, "item 2 had incorrect id");
        }).then(function () {
            item1.firstName = "Erin";
            item2.firstName = "Jon";
            return currentServer.put("test", [item1, item2]);
        }).then(function () {
            return currentServer.query("test").execute();
        }).then(function (results) {
            QUnit.assert.ok(results, "Didn't get any query results");
            QUnit.assert.strictEqual(results.length, 2, "Got unexpected number of results");

            QUnit.assert.strictEqual(results[0].firstName, "Erin", "Name didn't match the updated value");
            QUnit.assert.strictEqual(results[1].firstName, "Jon", "Name didn't match updated value");
        });
    }

    QUnit.test("canInsertItemIntoStore", dbTestWrapperCreateDb(canInsertItemIntoStore));
    QUnit.test("canInsertMultipleItemsIntoStore", dbTestWrapperCreateDb(canInsertMultipleItemsIntoStore));
    QUnit.test("canInsertItemWithPutIntoStore", dbTestWrapperCreateDb(canInsertItemWithPutIntoStore));
    QUnit.test("canInsertMultipleItemsWithPutIntoStore", dbTestWrapperCreateDb(canInsertMultipleItemsWithPutIntoStore));
    QUnit.test("canUpdateMultipleItemsWithPutIntoStore", dbTestWrapperCreateDb(canUpdateMultipleItemsWithPutIntoStore));

    QUnit.module("dbaseRemove");

    function canRemoveAddedItem() {
        QUnit.assert.ok(currentServer, "need current server");
        var item = { firstName: "Aaron", lastName: "Powell" };

        currentServer.add("test", item).done(function (records) {
            QUnit.assert.ok(records, "Didn't get any records back");
            QUnit.assert.strictEqual(records.length, 1, "Got more than one record back");
            item = records[0];
        });

        return waitFor(function () {
            return item.id;
        }).then(function () {
            return currentServer.remove("test", item.id);
        }).then(function () {
            var done = false;
            currentServer.get("test", item.id).done(function (removed) {
                QUnit.assert.strictEqual(removed, undefined, "Expected item to be removed");
                done = true;
            });

            return waitFor(function () {
                return done;
            });
        });
    }

    function removingNonExistantItemDoesntError() {
        QUnit.assert.ok(currentServer, "need current server");
        var item = { firstName: "Aaron", lastName: "Powell" };

        currentServer.add("test", item).done(function (records) {
            QUnit.assert.ok(records, "Didn't get any records back");
            QUnit.assert.strictEqual(records.length, 1, "Got more than one record back");
            item = records[0];
        });

        return waitFor(function () {
            return item.id;
        }).then(function () {
            return currentServer.remove("test", "xxx");
        }).then(function (data) {
            QUnit.assert.ok(!data, "Expected no data");
        });
    }

    QUnit.test("canRemoveAddedItem", dbTestWrapperCreateDb(canRemoveAddedItem));
    QUnit.test("removingNonExistantItemDoesntError", dbTestWrapperCreateDb(removingNonExistantItemDoesntError));

    QUnit.module("dbaseQuery");

    function canGetById() {
        QUnit.assert.ok(currentServer, "need current server");

        var item = {
            firstName: "Aaron",
            lastName: "Powell"
        };

        currentServer.add("test", item).done(function (data) {
            QUnit.assert.ok(data, "Didn't get data");
            QUnit.assert.strictEqual(data.length, 1, "Inserted more data than expected");
            item = data[0]
        });

        return waitFor(function () {
            return item.id;
        }).then(function () {
            var done = false;
            currentServer.get("test", item.id).done(function (data) {
                QUnit.assert.ok(data, "didn't get data back");
                QUnit.assert.strictEqual(data.id, item.id, "ID's didn't match");
                QUnit.assert.strictEqual(data.firstName, item.firstName, "First names didn't match");
                QUnit.assert.strictEqual(data.lastName, item.lastName, "Last names didn't match");
                done = true;
            });

            return waitFor(function () {
                return done;
            });
        });
    }

    function gettingInvalidIdReturnsNull() {
        QUnit.assert.ok(currentServer, "need current server");

        var done = false;
        currentServer.get("test", 7).done(function (data) {
            QUnit.assert.ok(data === undefined, "Didn't expect to get any data");
            done = true;
        });

        return waitFor(function () {
            return done;
        });
    };

    function canGetAll() {
        QUnit.assert.ok(currentServer, "need current server");

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
                QUnit.assert.ok(results, "no results");
                QUnit.assert.strictEqual(results.length, 2, "Incorrect number of results");
                QUnit.assert.strictEqual(results[0].firstName, item1.firstName, "item 1 First names don't match");
                QUnit.assert.strictEqual(results[1].firstName, item2.firstName, "item 2 First names don't match");

                done = true;
            });

            return waitFor(function() { return done; });
        });
    }

    function canQueryASingleProperty() {
        QUnit.assert.ok(currentServer, "need a server");

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
                QUnit.assert.ok(results, "no results");
                QUnit.assert.strictEqual(results.length, 2, "Incorrect number of results");
                QUnit.assert.strictEqual(results[0].firstName, item1.firstName, "item 1 First names don't match");
                QUnit.assert.strictEqual(results[1].firstName, item3.firstName, "item 2 First names don't match");

                done = true;
            });

            return waitFor(function () { return done; });
        });
    }

    function canQueryUsingFilterFunction() {
        QUnit.assert.ok(currentServer, "need a server");

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
                QUnit.assert.ok(results, "no results");
                QUnit.assert.strictEqual(results.length, 2, "Incorrect number of results");
                QUnit.assert.strictEqual(results[0].firstName, item1.firstName, "item 1 First names don't match");
                QUnit.assert.strictEqual(results[1].firstName, item3.firstName, "item 2 First names don't match");

                done = true;
            });

            return waitFor(function () { return done; });
        });
    }

    QUnit.test("canGetById", dbTestWrapperCreateDb(canGetById));
    QUnit.test("canGetAll", dbTestWrapperCreateDb(canGetAll));
    QUnit.test("gettingInvalidIdReturnsNull", dbTestWrapperCreateDb(gettingInvalidIdReturnsNull));
    QUnit.test("canQueryASingleProperty", dbTestWrapperCreateDb(canQueryASingleProperty));
    QUnit.test("canQueryUsingFilterFunction", dbTestWrapperCreateDb(canQueryUsingFilterFunction));

    QUnit.module("dbaseIndexes");

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
            QUnit.assert.ok(s, "Expected a completed DB");
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

                QUnit.assert.strictEqual(store.indexNames.length, 1, "Didn't find correct number of indexes");
                QUnit.assert.strictEqual(store.indexNames[0], "firstName", "Index names didn't match");

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
            QUnit.assert.ok(s, "Expected a completed DB");
            currentServer = s;
        });
        var done;

        return waitFor(function () { return currentServer; }).then(function () {

            currentServer.add("test", [item1, item2, item3]).done(function () {
                done = true;
            });

            return waitFor(function () { return done; });
        }).then(function () {
            QUnit.assert.ok(done, "Previous data wasn't complete")
            done = false;
            currentServer.index("test", "firstName").only("Aaron").done(function (results) {
                QUnit.assert.ok(results, "Expected a result set");
                QUnit.assert.strictEqual(results.length, 2, "didn't get back expected record counts");
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
            QUnit.assert.ok(s, "Expected a completed DB");
            currentServer = s;
        });
        var done;

        return waitFor(function () { return currentServer; }).then(function () {

            currentServer.add("test", [item1]).done(function () {
                done = true;
            });

            return waitFor(function () { return done; });
        }).then(function () {
            QUnit.assert.ok(done, "Previous data wasn't complete")
            done = false;
            currentServer.index("test", "firstName").only("Bob").done(function (results) {
                QUnit.assert.ok(results, "Expected a result set");
                QUnit.assert.strictEqual(results.length, 0, "didn't get back expected record counts");
                done = true;
            });

            return waitFor(function () { return done; });
        });
    }

    QUnit.test("canCreateDbWithIndexes", dbTestWrapper(canCreateDbWithIndexes));
    QUnit.test("canQueryDbUsingIndexes", dbTestWrapper(canQueryDbUsingIndexes));
    QUnit.test("canQueryDbIndexForNonExistantItem", dbTestWrapper(canQueryDbIndexForNonExistantItem));
})();