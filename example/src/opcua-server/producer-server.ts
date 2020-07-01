/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import * as os from "os";

import { standardUnits } from "node-opcua-data-access";
import { OPCUAServer } from "node-opcua-server";
import { StatusCodes } from "node-opcua-status-code";
import { CallMethodResultOptions } from "node-opcua-types";
import { DataType, Variant, VariantOptions } from "node-opcua-variant";

import { NodeUtils } from "@coaty/core/runtime-node";


function constructAddressSpace(srv: OPCUAServer) {

    const addressSpace = srv.engine.addressSpace;

    // ns=1, uri="urn:NodeOPCUA-Server-default"
    const namespace = addressSpace.getOwnNamespace();

    /* Devices */

    const device1 = namespace.addObject({
        organizedBy: addressSpace.rootFolder.objects,
        browseName: "S7-1500 PLC 1",
    });

    const device2 = namespace.addObject({
        organizedBy: addressSpace.rootFolder.objects,
        browseName: "S7-1500 PLC 2",
    });

    /* Variables */

    let var1 = 1;

    const variable1 = namespace.addVariable({
        componentOf: device1,
        browseName: "Tag1",
        nodeId: "ns=1;i=2001",
        dataType: "Int32",
        value: {
            get: () => new Variant({ dataType: DataType.Int32, value: var1 }),
        },
    });

    setInterval(() => variable1.setValueFromSource({ dataType: DataType.Int32, value: ++var1 }), 1000);

    namespace.addVariable({
        componentOf: device1,
        nodeId: "s=free_memory",    // a string nodeID with ns=1; (default)
        browseName: "FreeMemory",
        dataType: "Double",         // in Bytes
        value: {
            get: () => new Variant({ dataType: DataType.Double, value: os.freemem() }),
        },
    });

    namespace.addVariable({
        componentOf: device2,
        nodeId: "ns=1;b=1020FFAA",
        browseName: "Tag2",
        dataType: "String",
        // This variable is written by producer agent. It contains the latest
        // stringified value of variable1.
        value: new Variant({ dataType: DataType.String, value: "" }),
    });

    namespace.addAnalogDataItem({
        componentOf: device2,
        nodeId: "s=temperature",         // a string nodeID with ns=1; (default)
        browseName: "Temperature",
        definition: "37 + RND(-3, 3)",
        valuePrecision: 0.5,
        engineeringUnitsRange: { low: 0, high: 200 },
        instrumentRange: { low: -100, high: +200 },
        engineeringUnits: standardUnits.degree_celsius,
        dataType: "Double",
        value: {
            get: () => new Variant({ dataType: DataType.Double, value: 6 * Math.random() - 3 + 37.0 }),
        },
    });

    namespace
        .addMethod(device2, {
            browseName: "AlertTemperature",
            inputArguments: [
                {
                    name: "temperature",
                    description: { text: "specifies the alerted temperature value" },
                    dataType: DataType.Double,
                },
                {
                    name: "low",
                    description: { text: "specifies whether temperature is too low (true)" },
                    dataType: DataType.Boolean,
                },
                {
                    name: "high",
                    description: { text: "specifies whether temperature is too high (true)" },
                    dataType: DataType.Boolean,
                },
            ],
            outputArguments: [
                {
                    name: "confirmation",
                    description: { text: "a confirmation message" },
                    dataType: DataType.String,
                },
            ],
        })
        .bindMethod((inputArguments, context, callback) => {
            const temperature = inputArguments[0].value as number;
            const tooLow = inputArguments[1].value as boolean;
            const tooHigh = inputArguments[2].value as boolean;
            const confirmation = `temperature=${temperature}, tooLow=${tooLow}, tooHigh=${tooHigh}`;

            // NodeUtils.logInfo(`AlertTemperature method called with ${confirmation}`);

            const callMethodResult: CallMethodResultOptions = {
                statusCode: StatusCodes.Good,
                outputArguments: [{
                    dataType: DataType.String,
                    value: confirmation,
                }],
            };
            callback(null, callMethodResult);
        });
}

const server = new OPCUAServer({
    port: 4334, // the port of the listening socket of the server
    resourcePath: "/UA/Producer", // this path will be added to the endpoint resource name
    buildInfo: {
        productName: "Producer",
        buildNumber: "7658",
        buildDate: new Date(),
    },
});

server.initialize()
    .then(() => constructAddressSpace(server))
    .then(() => server.start())
    .then(() => {
        NodeUtils.logInfo(`Server is now listening... (press CTRL+C to stop)`);
        const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        NodeUtils.logInfo(`Primary server endpoint url: ${endpointUrl}`);
        server.engine.addressSpace.getNamespaceArray().forEach(ns => {
            NodeUtils.logInfo(`namespace ${ns.index}: ${ns.namespaceUri}`);
        });
    })
    .then(() => {
        server.on("newChannel", channel =>
            NodeUtils.logInfo(`Client connected on channel ${channel.channelId} from ${channel.remoteAddress}:${channel.remotePort}`));
        server.on("closeChannel", channel =>
            NodeUtils.logInfo(`Client disconnected on channel ${channel.channelId} from ${channel.remoteAddress}:${channel.remotePort}`));
        server.on("create_session", session =>
            NodeUtils.logInfo(`Session ${session.sessionName} created on channel ${session.channelId}`));
        server.on("session_closed", (session, reason) =>
            NodeUtils.logInfo(`Session ${session.sessionName} closed on channel ${session.channelId} because ${reason}`));
    })
    .catch(error => {
        NodeUtils.logError(error, `Server failed to start.`);
        console.error(error);
        NodeUtils.logInfo(`Exiting...`);
        process.exit(-1);
    });
