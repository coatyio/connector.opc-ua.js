/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import { Controller } from "@coaty/core";
import { NodeUtils } from "@coaty/core/runtime-node";

import { OpcuaConnector, OpcuaDataSource, OpcuaOptions } from "./opcua-connector";

/**
 * Configuration options for the `OpcuaMqttController` to be defined on the
 * `opcuaMqttOptions` property.
 *
 * Defines MQTT topics for an `OpcuaMqttController`. The given topics are
 * associated with monitored OPC UA items as defined by the
 * `OpcuaOptions.dataSources` property of this interface.
 *
 * Example:
 * ```ts
 * const opcuaMqttOptions: OpcuaMqttOptions = {
 *     endpointUrl: "opc.tcp://139.23.56.3:4334/UA/Producer",
 *     connectionOptions: { ... },
 *     dataSources: {
 *         "PLC1.Tag1": {
 *             nodeIdentifier: { namespaceUri: "urn:NodeOPCUA-Server-default", identifierWithType: "i=2001" },
 *             shouldMonitorItem: true,
 *             samplingInterval: 1000,
 *         },
 *     },
 *     topics: {
 *         "PLC1.Tag1": "opcua/plc1/tag1",
 *     },
 * };
 * ```
 */
export interface OpcuaMqttOptions extends OpcuaOptions {

    /**
     * An object hash of MQTT topics to be associated with monitored OPC UA
     * items as defined by the `OpcuaOptions.dataSources` property of this
     * interface.
     */
    topics: { [dataSourceIdentifier: string]: string };
}

/**
 * Connect to OPC UA server and map OPC UA variables to raw (non-Coaty) MQTT
 * messages.
 *
 * Each value of a monitored OPC UA data source is published on its associated
 * MQTT topic with the data value as its payload. Topic mappings are configured
 * on a controller option named `opcuaMqttOptions` which must implement the
 * `OpcuaMqttOptions` interface.
 *
 * By default, OPC UA data values are serialized as UTF-8 encoded JSON message
 * payloads. You can implement a specific data value coercion (e.g. as a binary
 * payload) by defining a `coerceValue` function in the associated
 * `OpcuaDataSource`.
 *
 * @remarks This controller only runs in a Node.js runtime, not in a browser.
 */
export class OpcuaMqttController extends Controller {

    private _opcuaConnector: OpcuaConnector;

    onInit() {
        super.onInit();
        const opcuaOpts = this.options.opcuaMqttOptions as OpcuaMqttOptions;
        if (!opcuaOpts) {
            NodeUtils.logError("OpcuaMqttOptions must be specified for OpcuaMqttController.");
            return;
        }
        this._opcuaConnector = new OpcuaConnector(opcuaOpts);
        this._opcuaConnector
            .on("error", error => this.traceOpcuaError(error))
            .on("dataValueChange", (
                dataSourceIdentifier: string,
                dataSource: OpcuaDataSource,
                dataValue: any,
                sourceTimestamp?: Date) => {
                const topic = opcuaOpts.topics[dataSourceIdentifier];
                if (!topic) {
                    return;
                }
                this.communicationManager.publishRaw(topic, JSON.stringify(dataValue));
            });
    }

    onCommunicationManagerStarting() {
        super.onCommunicationManagerStarting();
        this._opcuaConnector?.connect();
    }

    onCommunicationManagerStopping() {
        super.onCommunicationManagerStopping();
        this._opcuaConnector?.disconnect();
    }

    onDispose() {
        this._opcuaConnector?.removeAllListeners();
    }

    /**
     * Overwrite this method to define how internal OPC UA errors within this
     * controller should be traced.
     *
     * By default, OPC UA errors are logged on the console.
     *
     * Do not call this method in your application code, it is called by this
     * controller internally.
     *
     * @param error an OPC UA error
     */
    protected traceOpcuaError(error: any) {
        NodeUtils.logError(error, `[OPC UA Error]`);
    }

}

