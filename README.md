# Configuration

Create a ``use-cdn.conf.js`` file in the cwd of your test runner. (This often is
the top directory of your project.) It must export an object with the following
options:

* ``cdn: string`` (optional): The CDN to use for those packages that don't have
  a ``cdn`` field. This effectively lets you define a default CDN for the whole
  configuration.

* ``cdns: object`` (optional): this object allows configuring the various CDNs
  that you use in your configuration. A key of this object is the name of a CDN
  and the values are objects that contain configuration settings. See ``CDN
  Configuration`` below.

* ``resolvers: object`` (optional): this object allows configuring the various
  version resolvers that you use in your configuration. A key of this object is
  the name of a version resolver and the values are objects that contain
  configuration settings. See ``Version Resolver Configuration`` below.

* ``packages: object``: an array of package configuration. See ``Package
  Configuration`` below.

## CDN Configuration

A CDN configuration may contain the following settings:

* ``url: string`` (optional): you would use this to override the default URL
  associated with the CDN. This may be useful if you want to use a mirror of the
  CDN, for instance.

* ``resolver: string`` (optional): The version resolver to use for this CND. If
  a resolver is not provided, the ``npm`` resolver is used.

## Version Resolver Configuration

A version resolver configuration may contain the following settings:

* ``url: string`` (optional): you would use this to override the default URL
  associated with the resolver. This may be useful if you want to use a mirror
  of the version resolver, for instance.

## Package Configuration

Each package configuration is an object with the following fields:

* ``package: string``: the name of the package. The specific format is dependent
  on the CDN you use.

* ``resolveAs: string`` (optional): This is the package name that should be used
  while resolving the package. Unfortunately, it is possible for a package to be
  published to a CDN under a name and to a resolver under a different name. A
  good example of this is Bootstrap, which is published to Cdnjs as
  ``twitter-bootstrap`` and to NPM as ``bootstrap``. A configuration that
  fetches Bootstrap from Cdnjs but uses NPM as the version resolver would have
  to use ``package: "twitter-bootstrap", resolveAs: "bootstrap"``.

* ``cdn: string`` (optional): the CDN to use to fetch the package. Default:
  ``unpkg``.

* ``version: string``: the version of the package. The specific format is
  dependent on the CDN you use.

* ``files``: a list of files to get from the CDN.

**NOTE**: use-cdn does not allow fetching the same package from two different
CDNs in the same configuration. This is invalid:

```
{
  packages: [{
    package: "foo",
    cdn: "unpkg",
    [...],
  }, {
    package: "foo",
    cdn: "cdnjs",
    [...],
  }],
}
```

The name ``"foo"`` is duplicated. You also cannot have a ``resolveAs`` parameter
which has the same value as another ``resolveAs`` or ``package`` field. This is
invalid:

```
{
  packages: [{
    package: "foo",
    resolveAs: "bar",
    cdn: "unpkg",
    [...],
  }, {
    package: "bar",
    cdn: "cdnjs",
    [...],
  }],
}
```

The name ``"bar"`` is duplicated.

## What's a version resolver? Why do I need one?

Suppose I have a package that I advertise as working with "the latest version of
jQuery". In my test suite I want to test my code wiht "the latest version of
jQuery". The problem is that "the latest version of jQuery" is a moving
target. I'd like it if my test suite would just automatically load the latest
version rather than require me to manually update the version number loaded in
the tests every time a new jQuery version is released. Note that if I *don't
want* to automatically get the latest version but rather to manually update the
version myself, I can specify a ``"jquery"`` package with a specific version
number. But if I do want the latest version, I need a way to tell ``use-cdn``
that I want the latest. Or if I want the latest ``"rc"``, I'd have update
version numbers manually. The same thing happens if I want to setup a test suite
that runs with, say, the latest version of jQuery 2. If ``use-cdn`` allowed only
a literal and complete version number, then I'd have to chase new releases.

A version resolver solves these issues. The ``npm`` cli tool is a good example
of a tools that provides good version resolution. You can specify a package
version with a tag like ``"latest"`` or ``"dev"`` or ``"rc"``. And you can
specify a package version like ``"2"``, which means "the latest version in the
``"2.x"`` series".

The problem for ``use-cdn`` is that some CDNs peform version resolution, and
some don't. ``unpkg.com``, for instance, performs version resolution in the same
way ``npm`` does. However, ``cdnjs.com`` does not perform version resolution. So
for CNDs that don't provide their own resolution method, an external version
resolver can be used to provide some useful resolving semantics.

## Configuration Examples

Here is an example that uses the ``unpkg.com`` CDN (which is the default), but
overrides the default URL to use ``https://mirror/``:

```
const semver = require("semver");

module.exports = {
  cdns: {
    unpkg: {
      url: "https://mirror/",
      resolver: "native",
    },
  },
  resolvers: {
    unpkg: {
      url: "https://mirror/",
    }
  }
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

## ``unpkg``

The package available on this CDN are those published to ``npmjs.com``.

This CDN has a native version resolver which resolves version numbers in the
same way the ``npm`` version resolver does. The ``version`` string is any single
version number supported by NPM. For instance,

* ``1`` refers to the latest version is the 1.x series.

* ``latest`` refers to whatever version the ``latest`` dist-tag resolves to.

## ``cdnjs``

The package available on this CDN are those specifically published to this CDN.

This CDN does not have a native version resolver.

# Version Resolvers Supported

## ``npm``

This is a resolver that uses ``registry.npmjs.org`` to resolve versions and
tags. This is the default resolver for **ALL** CDNs for which you do not specify
another resolver.

## ``null``

This is a resolver that just returns the version or tag passed to it. If asked
to resolve ``"1"``, it will return ``"1"``. This resolver may be useful if you
want to set specific versions manually. Using the ``"null"`` resolver for such
cases allows you to skip the network requests that would be made for resolving.

## ``unpkg``

This is the resolver you get when specifying the ``"native"`` resolver on the
``"unpkg"`` CDN. This resolver queries ``unpkg.com`` to resolve tags and version
numbers. In theory, this resolver performs the same resolution as the ``npm``
resolver since ``unpkg`` simply exposes the packages available on
``npm``. However, this resolver uses ``unpkg.com`` whereas the ``npm`` resolver
uses ``registry.npmjs.org``.

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

This library caches from run to run the *file contents* it gets from the
CDNs. If a file that is needed is in the cache, then the CDN is not accessed
again to fetch this file.

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
and a ``foo.css`` from *different versions of the pacakge*.

That's a problem that happens only rarely but this library does prevent it,
because it is rather easy to prevent. It resolves tags to a specific version
number **once per run and uses the same version number for the whole run**. So
in the scenario above, version 1.2.3 would be used. Then on subsequent runs
``latest`` would resolve to the new version number.

Note, however, that version resolution is performed anew with each *invocation*
of ``use-cdn``. Say you run ``use-cdn`` once and it resolves ``foo@1`` to
``foo@1.2.3`` or ``foo@latest`` to ``foo@1.2.3``. If you run ``use-cdn`` again,
it will resolve the version again. If version 1.3 was released before your
second run, then ``foo@1`` and ``foo@latest`` will resolve to this new version.

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
