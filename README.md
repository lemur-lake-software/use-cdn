# Configuration

Create a ``use-cdn.conf.js`` file in the cwd of your test runner. (This often is
the top directory of your project.) It must export an object with the following
options:

* ``cdns: object`` (optional): this object allows configuring the various CDNs
  that you use in your configuration. A key of this object is the name of a CDN
  and the values are objects that contain configuration settings. See ``CDN
  Configuration`` below.

* ``packages: object``: an array of package configuration. See ``Package
  Configuration`` below.

## CDN Configuration

A CDN configuration may contain the following settings:

* ``url: string`` (optional): you would use this to override the default URL
  associated with the CDN. This may be useful if you want to use a mirror of the
  CDN, for instance.

## Package Configuration

Each package configuration is an object with the following fields:

* ``package: string``: the name of the package. The specific format is dependent
  on the CDN you use.

* ``version: string``: the version of the package. The specific format is
  dependent on the CDN you use.

* ``files``: a list of files to get from the CDN.

## Configuration Examples

Here is an example that uses the ``unpkg.com`` CDN (which is the default), but
overrides the default URL to use ``https://mirror/``:

```
const semver = require("semver");

module.exports = {
  cdns: {
    unpkg: {
      url: "https://mirror/",
    },
  },
  packages: [{
    package: "jquery",
    version: "latest",
    files: [
      "dist/jquery.js",
    ],
  }, {
    package: "bootstrap",
    version: "latest",
    files: [
      version => `dist/js/bootstrap.${semver.intersects(version, ">=4") ?
"bundle." : ""}js`,
      "dist/css/bootstrap.css",
    ],
  }],
};
```

This configuration fetches the JavaScript for the latest version of jQuery and
fetches the JavaScript and CSS for the latest version of Bootstrap. The
configuration for Bootstrap shows how a function can be used. Bootstrap 4
changed the name of the JavaScript file that should be loaded so the function
tests the version number to determine which file to request.

If you need a configuration that only contains the ``packages`` array, you can
reduce the configuration exported by your file to just that array, as in the
following example:

```
const semver = require("semver");

module.exports = [{
  package: "jquery",
  version: "latest",
  files: [
    "dist/jquery.js",
  ],
}, {
  package: "bootstrap",
  version: "latest",
  files: [
    version => `dist/js/bootstrap.${semver.intersects(version, ">=4") ?
"bundle." : ""}js`,
    "dist/css/bootstrap.css",
  ],
}];
```

# CDNs Supported

(PRs for adding other CDNs are welcome.)

## ``unpkg.com``

The package available on this CDN are those published to ``npmjs.com``. The
``version`` string is any single version number supported by NPM. For instance,

* ``1`` refers to the latest version is the 1.x series.

* ``latest`` refers to whatever version the ``latest`` dist-tag resolves to.

# Test Runners Supported

(PRs for adding other runners are welcome.)

## Karma

To use ``use-cdn`` with Karma you need to install:

```
npm install @use-cdn/cli @use-cdn/karma
```

You need to create a configuration file as described above. In your Karma
configuration you need:

```
  frameworks: ["use-cdn", ...],
  plugins: [
    "karma-*",
    "@use-cdn/karma",
  ],
```

You must list the plugin in ``plugins`` because Karma does not autodetect
plugins in NPM scopes. Also, note how the plugin name is ``@use-cdn/karma`` but
the framework name is ``use-cdn``.

The ``use-cdn`` framework unshifts the files it adds to Karma into Karma's
``files`` configuration array. So the files it adds will always be in front of
those your list in ``files``. The files it adds all have the following flags:

```
included: true,
served: true,
watched: false,
```

You must also modify your build procedure so that the ``use-cdn`` CLI tool runs
**before** Karma. For instance, your ``package.json`` could have a ``script``:

```
  "test": "use-cdn && karma start --single-run",

```

# Features

## Caching

This library caches from run to run the data it gets from the CDNs. If the data
is in the cache, then the CDN is not accessed again.

**THIS LIBRARY ASSUMES THAT THE CONTENT OF A VERSION IS IMMUTABLE.** It does not
*verify*. It simply *assumes*. If ``foo@1.2.3`` is in the cache and it is
requested again, then this library will just get it from the cache. In theory,
this can turn out to be an issue of a package is released through a package
manager and served through a CDN that allow releasing a version number and then
fixing it. Suppose Alice releases version ``foo@1.2.3``. Bob accesses it through
this library: it is cached. Then Alice realises a mistake and releases a new,
and different ``foo@1.2.3``. If Bob tries to get it through this library again,
he'll get the old release, not the new one.

This is a problem unlikely to happen in practice because:

* Sensible package managers don't allow re-releasing the same version.

* Even if a package manager and CDN happen to allow re-releasing a version. It
  is **terrible practice** and should not be done. Sensible developers don't do
  it.

This assumption simplifies the caching code. If a version is on disk, it is
available, period. We don't need to check with the CDN whether somehow it has
changed.

## Version integrity

When accessing a CDN naively, it is possible to run into a race condition if a
new release happens to be published at the same time the accesses are
done. Suppose I need to get ``foo.js`` and ``foo.css`` from ``foo@latest``. When
I grab ``foo.js`` when ``foo@latest`` is ``foo@1.2.3``, but ``foo@2.0.0``
happens to be published before I grab ``foo.css``. So now I have a ``foo.js``
and a ``foo.css`` from different versions of the pacakge.

That's a problem that happens only rarely but this library does prevent it,
because it is rather easy to prevent. It resolves tags to a specific version
number once per run and uses the same version number for the whole run. So in
the scenario above, version 1.2.3 would be used. Then on subsequent runs
``latest`` would resolve to the new version number.

# Contributing

PRs are welcome. Make sure that:

1. You add tests to maintain coverage.

2. You lint your code.

# Implementation Notes

The initial vision for this library was a Karma plugin consisting of a framework
and middleware. The middleware would wait until the suite actually makes a
request to a file to be served from a CDN to access the CDN and serve the
file. Karma does not handle this well. When a file is added to the ``files``
configuration of Karma, the file is handled in one of these ways:

* ``pattern`` is an absolute URL, in which case the pattern is taken as a
  literal URL. This pattern focibly has ``included: true`` and all the other
  options ``false``. This absolute URL completely bypasses Karma at test
  time. So if the URL is absolute, no middleware can serve it.

* ``pattern`` is not an absolute URL, in which case Karma scans the disk for
  files matching pattern. If there is no file on disk which matches, then this
  file has no further effect on the test run: Karma just prints a warning but
  otherwise ignores it.

Our framework cannot use an absolute URL because such URLs entirely bypass the
framework: this does not allow the framework to caching responses from run to
run, nor does it ensure version integrity.

If we use a non-absolute URL, the problem is that it has no effect unless
there's a file on disk that Karma can use.

In order to implement the initial vision, there would have to be a way to get
Karma to generate a ``script`` element for a resource found at a non-absolute
URL and which does not yet exist on disk when Karma processes the ``files``
configuration. This is not yet possible.

Another approach was considered whereby a Karma pluging consisting only of a
framework would fetch all the files prior to to Karma processing ``files``. This
requires that Karma handle frameworks that operate asynchronously because the
network operations for fetching files are asynchronous. Unfortunately, Karma
does not handle asynchronous frameworks. (It is possible to launch asynchronous
operations in a framework but Karma won't wait for them to be done.)
