# Changelog

<a name="2.3.0"></a>
# [2.3.0](https://github.com/coatyio/connector.opc-ua.js/compare/v2.2.0...v2.3.0) (2020-07-01)

This feature release supports explicit OPC UA configuration options for client subscriptions, monitoring parameters, and browse descriptions.

### Features

* **connector:** support optional browse description options for `OpcuaConnector.browse` functionality ([44cf00e](https://github.com/coatyio/connector.opc-ua.js/commit/44cf00ee51e9d06c2e26c6cbf6506b324ade42d1))
* **connector:** support optional client subscription options for OpcuaConnector monitoring functionality ([5a06c93](https://github.com/coatyio/connector.opc-ua.js/commit/5a06c9376d78ed24966d1c3ae72ff57df90559be))
* **connector:** support optional monitoring parameters for OpcuaConnector monitoring functionality ([dfde2b9](https://github.com/coatyio/connector.opc-ua.js/commit/dfde2b90d6eb4173b99b83027c5fbf1c7cbdc2a9))

<a name="2.2.0"></a>
# [2.2.0](https://github.com/coatyio/connector.opc-ua.js/compare/v2.1.0...v2.2.0) (2020-06-03)

This minor release upgrades its Coaty JS dependency to v2.2.0.

### Bug Fixes

* **example:** add missing communication namespace in producer agent ([9a109a2](https://github.com/coatyio/connector.opc-ua.js/commit/9a109a2d6557ac22bf0a973154c328b6c49d1d95))

<a name="2.1.0"></a>
# [2.1.0](https://github.com/coatyio/connector.opc-ua.js/compare/v2.0.0...v2.1.0) (2020-05-29)

This minor release upgrades its Coaty JS dependency to v2.1.1.

### Features

* **communication:** specify explicit communication namespace in example ([3dfb9d4](https://github.com/coatyio/connector.opc-ua.js/commit/3dfb9d47f6f0d04f1ea14651a037c7dd3b5236d2))

<a name="2.0.0"></a>
# [2.0.0](https://github.com/coatyio/connector.opc-ua.js/compare/v1.0.0...v2.0.0) (2020-03-09)

This major release is based on Coaty 2. It is published on npm package `@coaty/connector.opcua`.

### Features

* migrate to Coaty 2 and publish on npm package `@coaty/connector.opcua` ([2466d21](https://github.com/coatyio/connector.opc-ua.js/commit/2466d218a520816908f53bedbcf3ef2c228ffeff))

### BREAKING CHANGES

* import package from "@coaty/connector.opcua"

<a name="1.0.0"></a>
# 1.0.0 (2020-01-10)

Initial release of Coaty JS OPC UA connector.

