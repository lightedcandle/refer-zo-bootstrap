# Scoped App Boundary

Zo computers may host both the generic Script Factory runtime and scoped app
build surfaces. Keep them separate.

## Generic Factory Runtime

Generic, reusable runtime belongs under:

```text
/home/workspace/refer-zo-bootstrap
```

Generic runtime can include transport, registry, heartbeat, contract, talkback,
schema, route-manifest, and verification scripts. It must not encode one app's
routes, labels, demo data, product language, or approval policy.

## Scoped App Surfaces

App-specific build artifacts belong under the app profile or project folder:

```text
/home/workspace/<PROFILE>
/home/workspace/Projects/<AppName>
```

Examples include route-specific manifests, product plans, demo data, profile
vocabulary, UI copy, and app-specific manifest generators.

## Promotion Rule

If a scoped app teaches a reusable pattern, promote only the generalized
capability into `refer-zo-bootstrap`. Keep the scoped input data in the app
folder. For route work, the generic factory should apply a manifest; the app
scope should generate the manifest.
