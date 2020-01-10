# Coaty JS - OPC UA Example

[![Powered by Coaty](https://img.shields.io/badge/Powered%20by-Coaty-FF8C00.svg)](https://coaty.io)
[![TypeScript](https://img.shields.io/badge/Source%20code-TypeScript-007ACC.svg)](http://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

This example demonstrates how the specialized controllers provided by the [Coaty
JS OPC UA connector](https://github.com/coatyio/connector.opc-ua.js) can be
leveraged to transform OPC UA data sources into Coaty Sensor Things, IO routing
sources/actors, and raw MQTT messages, and to map Coaty remote operation calls
to OPC UA method calls.

## Installation and Build

To begin with, make sure that the `Node.js` JavaScript runtime (version 8 or
higher) is globally installed on your target machine. Download and installation
details can be found [here](http://nodejs.org/).

Then, checkout the example sources from
[here](https://github.com/coatyio/connector.opc-ua.js/tree/master/example),
install dependencies and build the example:

```sh
npm install
npm run build
```

## Run Example

The example consists of the following components:

* an OPC UA server with an exemplary data model (see
  `opcua-server/producer-server.ts`),
* a Coaty producer agent (see `producer/agent.ts`) with controllers that
  * monitor readable OPC UA data sources and publish them as IO routing sources, as
      Sensor Things objects, and as raw (non-Coaty) MQTT messages,
  * observe IO values from an IO routing actor and write them into an OPC UA
    variable,
  * observe "alertTemperature" remote operation calls and map them onto
    associated OPC UA method calls.
* a Coaty consumer agent (see `consumer/agent.ts`) with controllers that
  * observe the IO sources, Sensor Things observations, and raw MQTT messages
    published by the producer agent,
  * publish an "alertTemperature" remote operation call if a temperature
    observation is out of normal operating range.

To run the example, execute the following npm run commands in separate
terminals:

```sh
# Start OPC UA server
npm run opcua:server

# Start OPC UA commander
# (optional, just to browse OPC UA server data model)
npm run opcua:commander

# Start Coaty Broker
npm run broker

# Start Coaty Producer Agent
npm run producer

# Start Coaty Consumer Agent
npm run consumer
```

While running, the consumer agent will output the observed IO sources, Sensor
Things observations, and raw MQTT messages on the console.

## Project Structure

The example makes use of the following controllers provided by the Coaty JS OPC
UA package:

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

These controllers are specified as Coaty container components in the producer
agent of the example (see `producer/agent.ts`) and completely configured by
controller configuration options.

---
Copyright (c) 2020 Siemens AG. This work is licensed under a
[Creative Commons Attribution-ShareAlike 4.0 International License](http://creativecommons.org/licenses/by-sa/4.0/).
