module CodevoidTests.InstapaperArticleSyncTests {

    QUnit.module("InstapaperArticleSyncTests");

    test("canInstantiateArticleSync", () => {
        var syncEngine = new Codevoid.ArticleVoid.InstapaperArticleSync();
        notStrictEqual(syncEngine, null, "Should have constructed new article sync engine");
    });
}