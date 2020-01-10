# Coaty JS - OPC UA Connector

[![Powered by Coaty](https://img.shields.io/badge/Powered%20by-Coaty-FF8C00.svg)](https://coaty.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![release](https://img.shields.io/badge/release-Conventional%20Commits-yellow.svg)](https://conventionalcommits.org/)
[![npm version](https://badge.fury.io/js/coaty-opcua.svg)](https://www.npmjs.com/package/coaty-opcua)

## Table of Contents

* [Introduction](#introduction)
* [Getting started](#getting-started)
* [Custom OPC UA controllers](#custom-opc-ua-controllers)
* [Contributing](#contributing)
* [License](#license)

## Introduction

The Coaty JS OPC UA connector seamlessly connects decentralized
[Coaty](https://coaty.io) applications to [OPC UA](https://opcfoundation.org/)
servers. It provides specialized controllers to transform OPC UA data sources
into Coaty Sensor Things, IO routing sources/actors, and raw MQTT messages, and
to map Coaty remote operation calls to OPC UA method calls.

This connector comes with complete [API
documentation](https://coatyio.github.io/connector.opc-ua.js/api/index.html)
and an [example
project](https://github.com/coatyio/connector.opc-ua.js/tree/master/example) that
demonstrates best practices and typical usage patterns.

## Installation

You can install the latest version of the OPC UA connector package in your Coaty
project as follows:

```sh
npm install coaty-opcua --save
```

This npm package targets Coaty projects using ECMAScript version `es5` and
module format `commonjs`.

> **Note**: The OPC UA connector only runs in a Node.js runtime, not in a
> browser. Internally, it depends on the npm package `node-opcua-client`.

## Getting started

The OPC UA connector package includes the following specialized Coaty JS
controllers:

* `OpcuaSensorThingsController` -  maps readable, monitored OPC UA data items to
  the Coaty Sensor Things API.
* `OpcuaMqttController` - maps readable, monitored OPC UA data items to raw
  (non-Coaty) MQTT messages.
* `OpcuaIoSourceController` - maps readable, monitored OPC UA data items to
  Coaty IO routing sources.
* `OpcuaIoActorController` - maps IO values received by Coaty IO routing actors
  to writable OPC UA data items.
* `OpcuaRemoteOperationController` - maps Coaty Call events to OPC UA method
  calls.

These controllers are ready to be used as Coaty container components and can be
completely configured by controller configuration options. Moreover, if you need
to overwrite specific base functionality of such a controller, you can subclass
it and overwrite the exposed protected methods.

## Custom OPC UA controllers

If none of the predefined OPC UA controllers satisfies your application needs,
you can build your own one easily by subclassing the base Coaty `Controller`
class and by utilizing a service class called `OpcuaConnector`, which is part of
this npm package.

This service class provides OPC UA Client functionality to be used by a Coaty
controller class:

* Connect to/disconnect from an OPC UA server and open/close an OPC UA client
  session.
* Register OPC UA data nodes to be browsed, monitored, read, or written.
* Register OPC UA methods to be called.

Details on how to use this service class can be found in the [API
documentation](https://coatyio.github.io/connector.opc-ua.js/api/index.html).
The source code of the predefined controllers is also a starting point for your
own developments.

## Contributing

If you like this connector, please consider &#x2605; starring [the project on
github](https://github.com/coatyio/connector.opc-ua.js). Contributions are
welcome and appreciated.

The recommended practice described in the [contribution
guidelines](https://github.com/coatyio/coaty-js/blob/master/CONTRIBUTING.md) of
the Coaty JS framework also applies here.

To release a new version of this package, follow these steps:

1. `npm run cut-release` - prepare a new release, including automatic
   versioning, conventional changelog, and tagging.
2. `npm run push-release` - push the prepared release to the remote git repo
3. `npm run publish-release` - publish the package on npm registry.

## License

Code and documentation copyright 2020 Siemens AG.

Code is licensed under the [MIT License](https://opensource.org/licenses/MIT).

Documentation is licensed under a
[Creative Commons Attribution-ShareAlike 4.0 International License](http://creativecommons.org/licenses/by-sa/4.0/).
