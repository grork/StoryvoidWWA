# Storyvoid
Storyvoid is an application for reading, syncing, and adding article in an
Instapaper account. This repo is for the Typescript/UWP version.

## Prerequisites
- Windows 10
- Visual Studio **2017**
- Windows 10 SDK 10.0.17763.0 (Typescript, C++, Windows tools)

## Building
### Looking around, but not building
If you only want to look around, and don’t need to build, just open
`Storyvoid.sln`.

### Building, but not using
1. Run `copy_placeholder_keys.cmd`
2. Open `Storyvoid.sln`
3. Build!

### Building, using & running
1. Run `copy_placeholder_keys.cmd`
2. Open `Storyvoid.sln`
3. Open `App\Keys.ts` , place your API keys (Details below) in the appropriate
   fields
4. (Optional) Open `Test\Keys.ts`, place your API Keys (Details below) in the
   appropriate fields
5. Build!

### Why API Keys & where to get them
Because API keys are secrets, and unique to applications & their owners, the API
keys needed to run the applications & execute test are not included in this
code.

Instead, there are template files that can be placed in the correct locations,
with the correct information, to be able to build & run.

#### Instapaper API Access Keys
These are the *bare minimum* keys you need to obtain, and are what allow the app
itself to run & connect to Instapaper. To obtain these keys, request them from
[Instapaper](https://www.instapaper.com/main/request_oauth_consumer_token).

#### Twitter API Keys
These are only required for running the full test suite. If you don’t want to or
intend to run the full test suite, you don’t need to obtain them. If you do, go
the [Twitter Developer
Portal](https://developer.twitter.com/en/docs/developer-portal/overview) and
follow their ‘Create app’ flow. You’ll need both the client ID & secret, and
generate an access token a specific account & app.

### Configuring API Keys
Within the two projects, there are two files: `App\Keys.ts`, and `Test\Keys.ts`,
which are required to build, and contain the keys to run. 

For most keys, it should be easy to place them based on the field name & inline
comment. However, for the `Test\Keys.ts`, you need to run specific test to
capture the account tokens.

#### Obtaining account tokens using a test
1. Build, and *Debug* (not just run) the Test project
2. Set a breakpoint on `InstapaperApi_tests.js`, on the result of
   `getAccessToken`
3. In the ‘Test to run’ text box, enter `canGetAccessToken` & click ‘Run Test’
4. Inspect the values of `tokenInfo` to obtain the token & token secret values

If you don’t want to use a debugger, you can use a tool such as
[Fiddler](https://www.telerik.com/fiddler) to capture the service response. See
Fiddlers documentation on how to configure SSL decryption. 

### Why do I get warnings?
Because the certificates that are used to *ship* this app are not included, you
will get packaging warnings on build such as:
> Certificate file 'StoryVoidTest.pfx' not found

These can safely be ignored unless you are shipping.

## Releasing
This is a some-what manual process because of the support for having the store
build and the deployed build side by site. Additionally, this helps keeps the
key files more stable

### 1: Change the version in `package.appxmanifest`
We manually manage versions, so you need to go in, with an editor, and change
the version

1. Open `App\package.appxmanifest` using the code view (Right Click, View Code)
2. Change the commented out `Identity` line to have the new version
3. Change the non-commented out `Identity` line to have the *same* version
4. Save it, commit it ('cause you don't want to lose track of your versions)

### 2: Change the project, manifest sections to be the *production* versions
Because we have separate package identities, we need to manually update things
when we're ready to ship. I like to use Visual Studio code here, just because
these are text changes, and you don't want Visual Studios helping hand getting
in the way

**NOTE: You will not be committing these changes**

1. Open `App\package.appxmanifest`, and remove the `<Identity` line, and
   uncomment, well, the commented out line
2. Open `App\App.jsproj`, and search for `Store Submission`
3. Remove the `PackageCertificateKeyFile` & `PackageCertificateThumbprint`
   elements preceding this comment.
4. Uncomment the commented out `PackageCertificateKeyFile` &
   `PackageCertificateThumbprint` elements

### 3: Build for the Store
To prevent accidentally picking up the wrong items, or shipping the wrong build,
we're going to clean everything

1. Close Visual Studio
2. Copy `App_StoreKey.pfx` from wherever you’ve stored to `App\App_StoreKey.pfx`
3. Uninstall any versions of the app, or the tests that you have installed
   1. Open PowerShell
   2. `Get-AppxPackage -Name *Storyvoid* | Remove-AppxPackage`
4. Scorch the repo so that it's clean as a whistle
   1. `cd <where your repo is>`
   2. `git clean -x -d -f -e packages` (Want to avoid downloading packages
      again)
5. Open the solution in Visual Studio
   1. Change the default project to `App`
   2. Change your flavour to `Release` and `x64`
6. Batch Build all the flavours
   1. Build/Batch Build
   2. Select all `Release` flavours for `App`
   3. Select all `Release` flavours for `Codevoid`
   4. Click `Batch Build`
   5. Wait
7. Create the package for the store
   1. Right click the `App` Project
   2. Select `Store/Create App Packages...`
   3. Select appropriate type of package, Select next
   4. Make sure All the flavours are checked, along with `Generate App Bundle`
      being `Always`, and checking the `Include Full PDB Symbol Files`
   5. Click 'Create'
   6. Note the file path where it has put the upload package
   7. Skip the WACK testing unless you think you've changed something dangerous
      (aka native code)

### 4: Submit to the Store
This is done through the store dashboard, and some of the steps are dependent on
if you are publishing a new build to everyone or a package flight. Ultimately,
this is very easy to follow, so just navigate to the dashboard, and follow the
flow there:

https://partner.microsoft.com/en-us/dashboard/products/9NBLGGH4QJ68