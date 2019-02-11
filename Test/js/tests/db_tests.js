// Originally sourced from https://github.com/aaronpowell/db.js/tree/master/tests/public/specs

(function () {
    "use strict";

    const dbName = "testDb";
    const indexedDB = window.indexedDB;
    var dbId = 0;
    var currentServer;

    function waitFor(clause, timeout, existingSignal, dontThrowOnTimeout) {
        if (timeout === undefined) {
            timeout = 1000;
        }

        var signal = existingSignal || new WinJS._Signal();

        if (timeout < 1) {
            if (!dontThrowOnTimeout) {
                assert.ok(false, "timed out waiting");
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

    function dbSetup() {
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

        return waitFor(() => done);
    }

    function dbTeardown() {
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

        return waitFor(() => done);
    }

    function dbSetupWithCreate() {
        return dbSetup().then(function () {
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
            }).then(function (s) {
                currentServer = s;
            });

            return waitFor(() => currentServer);
        });
        
    }

    describe("testHelpers", function () {
        it("waitForTest", function waitForTest() {
            var isDone = false;
            setTimeout(function () { isDone = true; }, 100);
            return waitFor(function () { return isDone; }).then(function () {
                assert.ok(isDone, "Didn't actually set isDone");
            });
        });

        it("waitForTestWithTimeout", function waitForTestWithTimeout() {
            var isDoneTimeout = false;
            setTimeout(function () { isDoneTimeout = true; }, 5000);
            return waitFor(function () { return isDoneTimeout; }, 100, null, true).then(function () {
                assert.ok(!isDoneTimeout, "Test didn't timeout.");
            });
        });
    });

    describe("dbase", function () {
        beforeEach(dbSetup);
        afterEach(dbTeardown);

        it("openDbSuccessfully", function openDbSuccessfully() {
            db.open({
                server: dbName,
                version: 1
            }).done(function (s) {
                currentServer = s;
            });

            return waitFor(() => currentServer).then(function () {
                assert.ok(currentServer, "Current server was never set");
            });
        });

        it("closeClearsCache", function closeClearsCache() {
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
        });

        it("usesProvidedSchema", function usesProvidedSchema() {
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

            return waitFor(() => server).then(function () {
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

                return waitFor(() => done);
            });
        });

        it("objectStoreNamesPropertyContainsTableNames", function objectStoreNamesPropertyContainsTableNames() {
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

            return waitFor(() => server).then(function () {
                assert.ok(server, "no database returned");

                assert.ok(server.objectStoreNames, "expected list of object stores");
                assert.strictEqual(server.objectStoreNames.length, 1, "only expected on object store");
                assert.strictEqual(server.objectStoreNames[0], "test", "wrong store name returned");
                server.close();
            });
        });

        it("failsWhenMissingKeyPathOnSchema", function failsWhenMissingKeyPathOnSchema() {
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
            }, function (e) { });
        });

        it("callsUpgradeOnCreate", function callsUpgradeOnCreate() {
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

            return waitFor(() => server).then(function () {
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

                return waitFor(() => done);
            });
        });

        it("canUseExistingTransactionForOperations", function canUseExistingTransactionForOperations() {
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
            }, upgradeCalled).done(function (s) {
                server = s;
            });

            return waitFor(() => server).then(function () {
                return server.query("test").execute();
            }).then(function (results) {
                assert.ok(true, "expected results");
                assert.strictEqual(results.length, 1, "Didn't find right number of results");
                assert.strictEqual(results[0].name, "bob", "data wasn't correct");
                server.close();
            });
        });

        it("canDeleteDb", function canDeleteDb() {
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
            });
        });
    });

    describe("dbaseAddData", function () {
        beforeEach(dbSetupWithCreate);
        afterEach(dbTeardown);

        it("canInsertItemIntoStore", function canInsertItemIntoStore() {
            assert.ok(currentServer, "need current server");
            var item = { firstName: "Aaron", lastName: "Powell" };

            currentServer.add("test", item).done(function (records) {
                assert.ok(records, "Didn't get any records back");
                assert.strictEqual(records.length, 1, "Got more than one record back");
                item = records[0];
            });

            return waitFor(() => item.id).then(function () {
                assert.strictEqual(item.id, 1, "Item wasn't the first ID, or didn't have one");
            });
        });

        it("canInsertMultipleItemsIntoStore", function canInsertMultipleItemsIntoStore() {
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

            return waitFor(() => item1.id).then(function () {
                assert.strictEqual(item1.id, 1, "item 1 had incorrect id");
                assert.strictEqual(item2.id, 2, "item 2 had incorrect id");
            });
        });

        it("canInsertItemWithPutIntoStore", function canInsertItemWithPutIntoStore() {
            assert.ok(currentServer, "need current server");
            var item = { firstName: "Aaron", lastName: "Powell" };

            currentServer.put("test", item).done(function (records) {
                assert.ok(records, "Didn't get any records back");
                assert.strictEqual(records.length, 1, "Got more than one record back");
                item = records[0];
            });

            return waitFor(() => item.id).then(function () {
                assert.strictEqual(item.id, 1, "Item wasn't the first ID, or didn't have one");
            });
        });

        it("canInsertMultipleItemsWithPutIntoStore", function canInsertMultipleItemsWithPutIntoStore() {
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

            return waitFor(() => item1.id).then(function () {
                assert.strictEqual(item1.id, 1, "item 1 had incorrect id");
                assert.strictEqual(item2.id, 2, "item 2 had incorrect id");
            });
        });

        it("canUpdateMultipleItemsWithPutIntoStore", function canUpdateMultipleItemsWithPutIntoStore() {
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

            return waitFor(() => item1.id).then(function () {
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
        });
    });

    describe("dbaseRemove", function () {
        beforeEach(dbSetupWithCreate);
        afterEach(dbTeardown);

        it("canRemoveAddedItem", function canRemoveAddedItem() {
            assert.ok(currentServer, "need current server");
            var item = { firstName: "Aaron", lastName: "Powell" };

            currentServer.add("test", item).done(function (records) {
                assert.ok(records, "Didn't get any records back");
                assert.strictEqual(records.length, 1, "Got more than one record back");
                item = records[0];
            });

            return waitFor(() => item.id).then(function () {
                return currentServer.remove("test", item.id);
            }).then(function () {
                var done = false;
                currentServer.get("test", item.id).done(function (removed) {
                    assert.strictEqual(removed, undefined, "Expected item to be removed");
                    done = true;
                });

                return waitFor(() => done);
            });
        });

        it("removingNonExistantItemDoesntError", function removingNonExistantItemDoesntError() {
            assert.ok(currentServer, "need current server");
            var item = { firstName: "Aaron", lastName: "Powell" };

            currentServer.add("test", item).done(function (records) {
                assert.ok(records, "Didn't get any records back");
                assert.strictEqual(records.length, 1, "Got more than one record back");
                item = records[0];
            });

            return waitFor(() => item.id).then(function () {
                return currentServer.remove("test", "xxx");
            }).then(function (data) {
                assert.ok(!data, "Expected no data");
            });
        });
    });

    describe("dbaseQuery", function () {
        beforeEach(dbSetupWithCreate);
        afterEach(dbTeardown);

        it("canGetById", function canGetById() {
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

            return waitFor(() => item.id).then(function () {
                var done = false;
                currentServer.get("test", item.id).done(function (data) {
                    assert.ok(data, "didn't get data back");
                    assert.strictEqual(data.id, item.id, "ID's didn't match");
                    assert.strictEqual(data.firstName, item.firstName, "First names didn't match");
                    assert.strictEqual(data.lastName, item.lastName, "Last names didn't match");
                    done = true;
                });

                return waitFor(() => done);
            });
        });

        it("canGetAll", function canGetAll() {
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

            return waitFor(() => done).then(function () {
                done = false;

                currentServer.query("test").execute().done(function (results) {
                    assert.ok(results, "no results");
                    assert.strictEqual(results.length, 2, "Incorrect number of results");
                    assert.strictEqual(results[0].firstName, item1.firstName, "item 1 First names don't match");
                    assert.strictEqual(results[1].firstName, item2.firstName, "item 2 First names don't match");

                    done = true;
                });

                return waitFor(() => done);
            });
        });

        it("gettingInvalidIdReturnsNull", function gettingInvalidIdReturnsNull() {
            assert.ok(currentServer, "need current server");

            var done = false;
            currentServer.get("test", 7).done(function (data) {
                assert.ok(data === undefined, "Didn't expect to get any data");
                done = true;
            });

            return waitFor(() => done);
        });

        it("canQueryASingleProperty", function canQueryASingleProperty() {
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

            return waitFor(() => done).then(function () {
                done = false;

                currentServer.query("test").filter("firstName", "Aaron").execute().done(function (results) {
                    assert.ok(results, "no results");
                    assert.strictEqual(results.length, 2, "Incorrect number of results");
                    assert.strictEqual(results[0].firstName, item1.firstName, "item 1 First names don't match");
                    assert.strictEqual(results[1].firstName, item3.firstName, "item 2 First names don't match");

                    done = true;
                });

                return waitFor(() => done);
            });
        });

        it("canQueryUsingFilterFunction", function canQueryUsingFilterFunction() {
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

            return waitFor(() => done).then(function () {
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

                return waitFor(() => done);
            });
        });
    });

    describe("dbaseIndexes", function () {
        beforeEach(dbSetup);
        afterEach(dbTeardown);
    
        it("canCreateDbWithIndexes", function canCreateDbWithIndexes() {
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

            return waitFor(() => currentServer).then(function () {
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

                return waitFor(() => done);
            });
        });

        it("canQueryDbUsingIndexes", function canQueryDbUsingIndexes() {
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

            return waitFor(() => currentServer).then(function () {

                currentServer.add("test", [item1, item2, item3]).done(function () {
                    done = true;
                });

                return waitFor(() => done);
            }).then(function () {
                assert.ok(done, "Previous data wasn't complete")
                done = false;
                currentServer.index("test", "firstName").only("Aaron").done(function (results) {
                    assert.ok(results, "Expected a result set");
                    assert.strictEqual(results.length, 2, "didn't get back expected record counts");
                    done = true;
                });

                return waitFor(() => done);
            });
        });

        it("canQueryDbIndexForNonExistantItem", function canQueryDbIndexForNonExistantItem() {
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

            return waitFor(() => currentServer).then(function () {

                currentServer.add("test", [item1]).done(function () {
                    done = true;
                });

                return waitFor(() => done);
            }).then(function () {
                assert.ok(done, "Previous data wasn't complete")
                done = false;
                currentServer.index("test", "firstName").only("Bob").done(function (results) {
                    assert.ok(results, "Expected a result set");
                    assert.strictEqual(results.length, 0, "didn't get back expected record counts");
                    done = true;
                });

                return waitFor(() => done);
            });
        });
    });
})();