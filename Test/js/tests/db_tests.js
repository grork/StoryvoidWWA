// Originally sourced from https://github.com/aaronpowell/db.js/tree/master/tests/public/specs
// Ported from node/jasmine to qunit. Mostly becuase thats what I had. Tough. :p

(function () {
    "use strict";

    function waitFor(testAssert, clause, timeout, existingSignal, dontThrowOnTimeout) {
        if (timeout === undefined) {
            timeout = 1000;
        }

        var signal = existingSignal || new WinJS._Signal();

        if (timeout < 1) {
            if (!dontThrowOnTimeout) {
                testAssert.ok(false, "timed out waiting");
            }
            signal.complete();
            return;
        }

        if (clause()) {
            signal.complete();
        } else {
            setTimeout(waitFor.bind(this, testAssert,clause, timeout - 5, signal, dontThrowOnTimeout), 5);
        }

        return signal._promise;
    }

    function runTestWithCleanup(assert, before, test, after) {
        const complete = assert.async();

        if (before) {
            before = WinJS.Promise.as(before(assert));
        } else {
            before = WinJS.Promise.as();
        }

        const boundAfter = after.bind(this, assert);
        before.then(test.bind(this, assert)).then(boundAfter, boundAfter).done(complete, complete);
    }

    QUnit.module("testHelpers");

    QUnit.test("waitForTest", function waitForTest(assert) {
        var isDone = false;
        const complete = assert.async();
        setTimeout(function () { isDone = true; }, 100);
        waitFor(assert, function () { return isDone; }).done(function () {
            assert.ok(isDone, "Didn't actually set isDone");
            complete();
        });
    });

    QUnit.test("waitForTestWithTimeout", function waitForTestWithTimeout(assert) {
        var isDoneTimeout = false;
        const complete = assert.async();
        setTimeout(function () { isDoneTimeout = true; }, 5000);
        waitFor(assert, function () { return isDoneTimeout; }, 100, null, true).done(function () {
            assert.ok(!isDoneTimeout, "Test didn't timeout.");
            complete();
        });
    });

    QUnit.test("runBeforeAndAfterTest", function runBeforeAndAfterTest(originalAssert) {
        var wasRunBefore = false;
        var wasRunTest = false;
        var wasRunAfter = false;

        var b = function before(beforeAssert) {
            beforeAssert.ok(!wasRunBefore, "Was Run before already set");
            beforeAssert.ok(!wasRunTest, "Test was run before");
            beforeAssert.ok(!wasRunAfter, "Was Run After already set");

            WinJS.Promise.timeout(100).then(() => {
                wasRunBefore = true;
            });

            return waitFor(beforeAssert, () => wasRunBefore);
        }

        var t = function theTest(testAssert) {
            testAssert.ok(wasRunBefore, "Was Run before not set");
            testAssert.ok(!wasRunTest, "Test was run before");
            testAssert.ok(!wasRunAfter, "Was Run After already set");

            WinJS.Promise.timeout(100).then(() => {
                wasRunTest = true;
            });

            return waitFor(testAssert, () => wasRunTest);
        }

        var a = function after(afterAssert) {
            afterAssert.ok(wasRunBefore, "Was Run before already set");
            afterAssert.ok(wasRunTest, "Test wasn't run");
            afterAssert.ok(!wasRunAfter, "Was Run After already set");

            WinJS.Promise.timeout(100).then(() => {
                wasRunAfter = true;
            });

            return waitFor(afterAssert, () => wasRunAfter).then(() => {
                // Full validation
                afterAssert.ok(wasRunBefore && wasRunTest && wasRunAfter, "not all parts were run");
            });
        }

        runTestWithCleanup(originalAssert, b, t, a);
    });

    QUnit.module("dbase");

    const dbName = "testDb";
    const indexedDB = window.indexedDB;
    var currentServer;

    function before(beforeAssert) {
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

        return waitFor(beforeAssert, () => done);
    }

    var dbId = 0;
    function after(afterAssert) {
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

        return waitFor(afterAssert, () => done);
    }

    function dbTestWrapper(testFn) {
        return function (testAssert) {
            runTestWithCleanup(testAssert, before, testFn, after);
        }
    }

    function openDbSuccessfully(assert) {
        db.open({
            server: dbName,
            version: 1
        }).done(function (s) {
            currentServer = s;
        });

        return waitFor(assert, () => currentServer).then(function () {
            assert.ok(currentServer, "Current server was never set");
        });
    }

    function closeClearsCache(assert) {
        return db.open({
            server: dbName,
            version: 1
        }).then(function (s) {
            currentServer = s;
            currentServer.close();
        }).then(function () {
            var cache = db._getCache();
            assert.strictEqual(cache[dbName], undefined, "DB Was still in the cache");
        });
    }

    function usesProvidedSchema(assert) {
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

        return waitFor(assert, () => server).then(function () {
            assert.ok(server, "no database returned");
            server.close();
            var done =  false;

            var req = indexedDB.open( dbName );
            req.onsuccess = function ( e ) {
                var db = e.target.result;
                    
                assert.strictEqual(db.objectStoreNames.length, 1, "Didn't find expected store names");
                assert.strictEqual(db.objectStoreNames[0], "test", "Expected store name to match");
                    
                db.close();
                done = true;
            };

            return waitFor(assert, () => done);
        });
    }

    function objectStoreNamesPropertyContainsTableNames(assert) {
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

        return waitFor(assert, () => server).then(function () {
            assert.ok(server, "no database returned");

            assert.ok(server.objectStoreNames, "expected list of object stores");
            assert.strictEqual(server.objectStoreNames.length, 1, "only expected on object store");
            assert.strictEqual(server.objectStoreNames[0], "test", "wrong store name returned");
            server.close();
        });
    }

    function failsWhenMissingKeyPathOnSchema(assert) {
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
            assert.ok(false, "should have failed");
            server = s;
        }, function (e) {
            assert.ok(true, "Failed badly");
        });
    }

    function callsUpgradeOnCreate(assert) {
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

        return waitFor(assert, () => server).then(function () {
            assert.ok(upgradeWasCalled, "Upgrade wasn't called");
            assert.ok(upgradeHadServerObject, "Upgrade wasn't passed a server object");
            assert.ok(server, "no database returned");
            server.close();
            var done = false;

            var req = indexedDB.open(dbName);
            req.onsuccess = function (e) {
                var db = e.target.result;

                assert.strictEqual(db.objectStoreNames.length, 1, "Didn't find expected store names");
                assert.strictEqual(db.objectStoreNames[0], "test", "Expected store name to match");

                db.close();
                done = true;
            };

            return waitFor(assert, () => done);
        });
    }

    function canUseExistingTransactionForOperations(assert) {
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

        return waitFor(assert, () => server).then(function() {
            return server.query("test").execute();
        }).then(function(results) {
            assert.ok(true, "expected results");
            assert.strictEqual(results.length, 1, "Didn't find right number of results");
            assert.strictEqual(results[0].name, "bob", "data wasn't correct");
            server.close();
            return true;
        });
    }

    function canDeleteDb(assert) {
        return db.open({
            server: dbName,
            version: 1
        }).then(function (s) {
            currentServer = s;
            currentServer.close();
        }).then(function () {
            var cache = db._getCache();
            assert.strictEqual(cache[dbName], undefined, "DB Was still in the cache");

            return db.deleteDb(dbName);
        }).then(function deleted(e) {
            assert.ok(true, "DB wasn't deleted");
        }, function errored(e) {
            assert.ok(false, "DB failed to be deleted");
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
        return function (originalAssert) {
            runTestWithCleanup(originalAssert, function wrapper_Before() {
                return before(originalAssert).then(function () {
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

                    return waitFor(originalAssert, () => currentServer);
                });
            }, testFn.bind(this, originalAssert), after.bind(this, originalAssert));
        }
    }

    function canInsertItemIntoStore(assert) {
        assert.ok(currentServer, "need current server");
        var item = { firstName: "Aaron", lastName: "Powell" };

        currentServer.add("test", item).done(function (records) {
            assert.ok(records, "Didn't get any records back");
            assert.strictEqual(records.length, 1, "Got more than one record back");
            item = records[0];
        });

        return waitFor(assert, () => item.id).then(function () {
            assert.strictEqual(item.id, 1, "Item wasn't the first ID, or didn't have one");
        });
    }

    function canInsertMultipleItemsIntoStore(assert) {
        assert.ok(currentServer, "need current server");
        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };
        var item2 = {
            firstName: "John",
            lastName: "Smith"
        };

        currentServer.add("test", [item1, item2]).done(function (items) {
            assert.ok(items, "no items returned");
            assert.strictEqual(items.length, 2, "incorrect number of items returned");

            item1.id = items[0].id;
            item2.id = items[1].id;
        });

        return waitFor(assert, () => item1.id).then(function () {
            assert.strictEqual(item1.id, 1, "item 1 had incorrect id");
            assert.strictEqual(item2.id, 2, "item 2 had incorrect id");
        });
    }

    function canInsertItemWithPutIntoStore(assert) {
        assert.ok(currentServer, "need current server");
        var item = { firstName: "Aaron", lastName: "Powell" };

        currentServer.put("test", item).done(function (records) {
            assert.ok(records, "Didn't get any records back");
            assert.strictEqual(records.length, 1, "Got more than one record back");
            item = records[0];
        });

        return waitFor(assert, () => item.id).then(function () {
            assert.strictEqual(item.id, 1, "Item wasn't the first ID, or didn't have one");
        });
    }

    function canInsertMultipleItemsWithPutIntoStore(assert) {
        assert.ok(currentServer, "need current server");
        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };
        var item2 = {
            firstName: "John",
            lastName: "Smith"
        };

        currentServer.put("test", [item1, item2]).done(function (items) {
            assert.ok(items, "no items returned");
            assert.strictEqual(items.length, 2, "incorrect number of items returned");

            item1.id = items[0].id;
            item2.id = items[1].id;
        });

        return waitFor(assert, () => item1.id).then(function () {
            assert.strictEqual(item1.id, 1, "item 1 had incorrect id");
            assert.strictEqual(item2.id, 2, "item 2 had incorrect id");
        });
    }

    function canUpdateMultipleItemsWithPutIntoStore(assert) {
        assert.ok(currentServer, "need current server");
        var item1 = {
            firstName: "Aaron",
            lastName: "Powell"
        };
        var item2 = {
            firstName: "John",
            lastName: "Smith"
        };

        currentServer.put("test", [item1, item2]).done(function (items) {
            assert.ok(items, "no items returned");
            assert.strictEqual(items.length, 2, "incorrect number of items returned");

            item1.id = items[0].id;
            item2.id = items[1].id;
        });

        return waitFor(assert, () => item1.id).then(function () {
            assert.strictEqual(item1.id, 1, "item 1 had incorrect id");
            assert.strictEqual(item2.id, 2, "item 2 had incorrect id");
        }).then(function () {
            item1.firstName = "Erin";
            item2.firstName = "Jon";
            return currentServer.put("test", [item1, item2]);
        }).then(function () {
            return currentServer.query("test").execute();
        }).then(function (results) {
            assert.ok(results, "Didn't get any query results");
            assert.strictEqual(results.length, 2, "Got unexpected number of results");

            assert.strictEqual(results[0].firstName, "Erin", "Name didn't match the updated value");
            assert.strictEqual(results[1].firstName, "Jon", "Name didn't match updated value");
        });
    }

    QUnit.test("canInsertItemIntoStore", dbTestWrapperCreateDb(canInsertItemIntoStore));
    QUnit.test("canInsertMultipleItemsIntoStore", dbTestWrapperCreateDb(canInsertMultipleItemsIntoStore));
    QUnit.test("canInsertItemWithPutIntoStore", dbTestWrapperCreateDb(canInsertItemWithPutIntoStore));
    QUnit.test("canInsertMultipleItemsWithPutIntoStore", dbTestWrapperCreateDb(canInsertMultipleItemsWithPutIntoStore));
    QUnit.test("canUpdateMultipleItemsWithPutIntoStore", dbTestWrapperCreateDb(canUpdateMultipleItemsWithPutIntoStore));

    QUnit.module("dbaseRemove");

    function canRemoveAddedItem(assert) {
        assert.ok(currentServer, "need current server");
        var item = { firstName: "Aaron", lastName: "Powell" };

        currentServer.add("test", item).done(function (records) {
            assert.ok(records, "Didn't get any records back");
            assert.strictEqual(records.length, 1, "Got more than one record back");
            item = records[0];
        });

        return waitFor(assert, () => item.id).then(function () {
            return currentServer.remove("test", item.id);
        }).then(function () {
            var done = false;
            currentServer.get("test", item.id).done(function (removed) {
                assert.strictEqual(removed, undefined, "Expected item to be removed");
                done = true;
            });

            return waitFor(assert, () => done);
        });
    }

    function removingNonExistantItemDoesntError(assert) {
        assert.ok(currentServer, "need current server");
        var item = { firstName: "Aaron", lastName: "Powell" };

        currentServer.add("test", item).done(function (records) {
            assert.ok(records, "Didn't get any records back");
            assert.strictEqual(records.length, 1, "Got more than one record back");
            item = records[0];
        });

        return waitFor(assert, () => item.id).then(function () {
            return currentServer.remove("test", "xxx");
        }).then(function (data) {
            assert.ok(!data, "Expected no data");
        });
    }

    QUnit.test("canRemoveAddedItem", dbTestWrapperCreateDb(canRemoveAddedItem));
    QUnit.test("removingNonExistantItemDoesntError", dbTestWrapperCreateDb(removingNonExistantItemDoesntError));

    QUnit.module("dbaseQuery");

    function canGetById(assert) {
        assert.ok(currentServer, "need current server");

        var item = {
            firstName: "Aaron",
            lastName: "Powell"
        };

        currentServer.add("test", item).done(function (data) {
            assert.ok(data, "Didn't get data");
            assert.strictEqual(data.length, 1, "Inserted more data than expected");
            item = data[0]
        });

        return waitFor(assert, () => item.id).then(function () {
            var done = false;
            currentServer.get("test", item.id).done(function (data) {
                assert.ok(data, "didn't get data back");
                assert.strictEqual(data.id, item.id, "ID's didn't match");
                assert.strictEqual(data.firstName, item.firstName, "First names didn't match");
                assert.strictEqual(data.lastName, item.lastName, "Last names didn't match");
                done = true;
            });

            return waitFor(assert, () => done);
        });
    }

    function gettingInvalidIdReturnsNull(assert) {
        assert.ok(currentServer, "need current server");

        var done = false;
        currentServer.get("test", 7).done(function (data) {
            assert.ok(data === undefined, "Didn't expect to get any data");
            done = true;
        });

        return waitFor(assert, () => done);
    };

    function canGetAll(assert) {
        assert.ok(currentServer, "need current server");

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

        return waitFor(assert, () => done).then(function () {
            done = false;

            currentServer.query("test").execute().done(function (results) {
                assert.ok(results, "no results");
                assert.strictEqual(results.length, 2, "Incorrect number of results");
                assert.strictEqual(results[0].firstName, item1.firstName, "item 1 First names don't match");
                assert.strictEqual(results[1].firstName, item2.firstName, "item 2 First names don't match");

                done = true;
            });

            return waitFor(assert, () => done);
        });
    }

    function canQueryASingleProperty(assert) {
        assert.ok(currentServer, "need a server");

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

        return waitFor(assert, () => done).then(function () {
            done = false;

            currentServer.query("test").filter("firstName", "Aaron").execute().done(function (results) {
                assert.ok(results, "no results");
                assert.strictEqual(results.length, 2, "Incorrect number of results");
                assert.strictEqual(results[0].firstName, item1.firstName, "item 1 First names don't match");
                assert.strictEqual(results[1].firstName, item3.firstName, "item 2 First names don't match");

                done = true;
            });

            return waitFor(assert, () => done);
        });
    }

    function canQueryUsingFilterFunction(assert) {
        assert.ok(currentServer, "need a server");

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

        return waitFor(assert, () => done).then(function () {
            done = false;

            currentServer.query("test").filter(function (data) {
                return data.firstName === "Aaron" && data.lastName === "Powell";
            }).execute().done(function (results) {
                assert.ok(results, "no results");
                assert.strictEqual(results.length, 2, "Incorrect number of results");
                assert.strictEqual(results[0].firstName, item1.firstName, "item 1 First names don't match");
                assert.strictEqual(results[1].firstName, item3.firstName, "item 2 First names don't match");

                done = true;
            });

            return waitFor(assert, () => done);
        });
    }

    QUnit.test("canGetById", dbTestWrapperCreateDb(canGetById));
    QUnit.test("canGetAll", dbTestWrapperCreateDb(canGetAll));
    QUnit.test("gettingInvalidIdReturnsNull", dbTestWrapperCreateDb(gettingInvalidIdReturnsNull));
    QUnit.test("canQueryASingleProperty", dbTestWrapperCreateDb(canQueryASingleProperty));
    QUnit.test("canQueryUsingFilterFunction", dbTestWrapperCreateDb(canQueryUsingFilterFunction));

    QUnit.module("dbaseIndexes");

    function canCreateDbWithIndexes(assert) {
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
            assert.ok(s, "Expected a completed DB");
            currentServer = s;
        });

        return waitFor(assert, () => currentServer).then(function () {
            var done;
            currentServer.close();

            var req = indexedDB.open(dbName, 1);
            req.onsuccess = function (e) {
                var res = e.target.result;

                var transaction = res.transaction('test');
                var store = transaction.objectStore('test');

                assert.strictEqual(store.indexNames.length, 1, "Didn't find correct number of indexes");
                assert.strictEqual(store.indexNames[0], "firstName", "Index names didn't match");

                e.target.result.close();
                done = true;
            };

            return waitFor(assert, () => done);
        });
    }

    function canQueryDbUsingIndexes(assert) {
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
            assert.ok(s, "Expected a completed DB");
            currentServer = s;
        });
        var done;

        return waitFor(assert, () => currentServer).then(function () {

            currentServer.add("test", [item1, item2, item3]).done(function () {
                done = true;
            });

            return waitFor(assert, () => done);
        }).then(function () {
            assert.ok(done, "Previous data wasn't complete")
            done = false;
            currentServer.index("test", "firstName").only("Aaron").done(function (results) {
                assert.ok(results, "Expected a result set");
                assert.strictEqual(results.length, 2, "didn't get back expected record counts");
                done = true;
            });

            return waitFor(assert, () => done);
        });
    }

    function canQueryDbIndexForNonExistantItem(assert) {
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
            assert.ok(s, "Expected a completed DB");
            currentServer = s;
        });
        var done;

        return waitFor(assert, () => currentServer).then(function () {

            currentServer.add("test", [item1]).done(function () {
                done = true;
            });

            return waitFor(assert, () => done);
        }).then(function () {
            assert.ok(done, "Previous data wasn't complete")
            done = false;
            currentServer.index("test", "firstName").only("Bob").done(function (results) {
                assert.ok(results, "Expected a result set");
                assert.strictEqual(results.length, 0, "didn't get back expected record counts");
                done = true;
            });

            return waitFor(assert, () => done);
        });
    }

    QUnit.test("canCreateDbWithIndexes", dbTestWrapper(canCreateDbWithIndexes));
    QUnit.test("canQueryDbUsingIndexes", dbTestWrapper(canQueryDbUsingIndexes));
    QUnit.test("canQueryDbIndexForNonExistantItem", dbTestWrapper(canQueryDbIndexForNonExistantItem));
})();