/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import { IoSource } from "@coaty/core";
import { IoSourceController } from "@coaty/core/io-routing";
import { NodeUtils } from "@coaty/core/runtime-node";

import { OpcuaConnector, OpcuaDataSource, OpcuaOptions } from "./opcua-connector";

/**
 * Configuration options for the `OpcuaIoSourceController` to be defined on the
 * `opcuaIoSourceOptions` property.
 *
 * Defines IO sources for an `OpcuaIoSourceController`. The given IO source
 * objects are associated with monitored OPC UA items as defined by the
 * `OpcuaOptions.dataSources` property of this interface.
 *
 * Example:
 * ```ts
 * const opcuaIoSourceOptions: OpcuaIoSourceOptions = {
 *     endpointUrl: "opc.tcp://139.23.56.3:4334/UA/Producer",
 *     connectionOptions: { ... },
 *     dataSources: {
 *         "PLC1.Tag1": {
 *             nodeIdentifier: { namespaceUri: "urn:NodeOPCUA-Server-default", identifierWithType: "i=2001" },
 *             shouldMonitorItem: true,
 *             samplingInterval: 1000,
 *         },
 *     },
 *     ioSources: {
 *          "PLC1.Tag1": {
 *              name: "S7-1500 PLC 1.Tag1",
 *              objectId: Runtime.newUuid(),
 *              objectType: CoreTypes.OBJECT_TYPE_IO_SOURCE,
 *              coreType: "IoSource",
 *              valueType: "plc.Tag1[Int32]",
 *          },
 *     },
 * };
 * ```
 */
export interface OpcuaIoSourceOptions extends OpcuaOptions {

    /**
     * An object hash of IO sources to be associated with monitored OPC UA items
     * as defined by the `OpcuaOptions.dataSources` property of this interface.
     */
    ioSources: { [dataSourceIdentifier: string]: IoSource };
}

/**
 * Connect to OPC UA server and map OPC UA variables to IO sources.
 *
 * Each value of a monitored OPC UA variable is emitted as an IO value of an
 * associated IO source. Mappings are configured on a controller option named
 * `opcuaIoSourceOptions` which must implement the `OpcuaIoSourceOptions`
 * interface.
 *
 * By default, monitored OPC UA data values are passed unchanged as IO values.
 * You can implement a specific data value coercion by defining a `coerceValue`
 * function in the associated `OpcuaDataSource`.
 *
 * @remarks This controller only runs in a Node.js runtime, not in a browser.
 */
export class OpcuaIoSourceController extends IoSourceController {

    private _opcuaConnector: OpcuaConnector;

    onInit() {
        super.onInit();
        const opcuaOpts = this.options.opcuaIoSourceOptions as OpcuaIoSourceOptions;
        if (!opcuaOpts) {
            NodeUtils.logError("OpcuaIoSourceOptions must be specified for OpcuaIoSourceController.");
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
                const ioSource = opcuaOpts.ioSources[dataSourceIdentifier];
                if (!ioSource) {
                    return;
                }
                this.publish(ioSource, dataValue);
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
