/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import { Subject } from "rxjs";
import { filter, takeUntil } from "rxjs/operators";

import { IoActor } from "@coaty/core";
import { IoActorController } from "@coaty/core/io-routing";
import { NodeUtils } from "@coaty/core/runtime-node";

import { OpcuaConnector, OpcuaDataSource, OpcuaOptions } from "./opcua-connector";

/**
 * Configuration options for the `OpcuaIoActorController` to be defined on the
 * `opcuaIoActorOptions` property.
 *
 * Defines IO actors for an `OpcuaIoActorController`. The given IO actor objects
 * are associated with OPC UA variables as defined by the
 * `OpcuaOptions.dataSources` property of this interface. Whenever a new IO
 * value is received by a defined IO actor, the value is written to its
 * associated OPC UA data source variable.
 *
 * Example:
 * ```ts
 * const opcuaIoActorOptions: OpcuaIoActorOptions = {
 *     endpointUrl: "opc.tcp://139.23.56.3:4334/UA/Producer",
 *     connectionOptions: { ... },
 *     dataSources: {
 *         "PLC1.Tag1": {
 *             nodeIdentifier: { namespaceUri: "urn:NodeOPCUA-Server-default", identifierWithType: "i=2001" },
 *             dataType: "Int32",
 *         },
 *     },
 *     ioActors: {
 *          "PLC1.Tag1": {
 *              name: "S7-1500 PLC 1.Tag1",
 *              objectId: Runtime.newUuid(),
 *              objectType: CoreTypes.OBJECT_TYPE_IO_ACTOR,
 *              coreType: "IoActor",
 *              valueType: "plc.Tag1[Int32]",
 *          },
 *     },
 * };
 * ```
 */
export interface OpcuaIoActorOptions extends OpcuaOptions {

    /**
     * An object hash of IO actors to be associated with OPC UA variables to be
     * written as defined by the `OpcuaOptions.dataSources` property of this
     * interface.
     */
    ioActors: { [dataSourceIdentifier: string]: IoActor };
}

/**
 * Connect to OPC UA server and map IO values received by IO actors to OPC UA
 * variables.
 *
 * Each IO value received by an IO actor is written as an OPC UA variable value.
 * Mappings are configured on a controller option named `opcuaIoActorOptions`
 * which must implement the `OpcuaIoActorOptions` interface.
 *
 * By default, IO values are written unchanged as OPC UA variable values. You
 * can implement a specific data value coercion by defining a `coerceValue`
 * function in the associated `OpcuaDataSource`.
 *
 * To perform application-specific side effects on write operations or
 * conditional writes, subclass this controller and overwrite the protected
 * method `writeDataValue`.
 *
 * @remarks This controller only runs in a Node.js runtime, not in a browser.
 */
export class OpcuaIoActorController extends IoActorController {

    private _opcuaConnector: OpcuaConnector;
    private _stopped$ = new Subject();

    onInit() {
        super.onInit();
        const opcuaOpts = this.options.opcuaIoActorOptions as OpcuaIoActorOptions;
        if (!opcuaOpts) {
            NodeUtils.logError("OpcuaIoActorOptions must be specified for OpcuaIoActorController.");
            return;
        }

        this._opcuaConnector = new OpcuaConnector(opcuaOpts);
        this._opcuaConnector
            .on("error", error => this.traceOpcuaError(error))
            .on("sessionCreated", () => {
                Object.entries(opcuaOpts.ioActors).forEach(([sourceId, ioActor]) => {
                    const dataSource = opcuaOpts.dataSources[sourceId];
                    if (!dataSource) {
                        return;
                    }
                    this.observeIoValue<any>(ioActor)
                        .pipe(
                            takeUntil(this._stopped$),
                            filter(dataValue => dataValue !== undefined),
                        )
                        .subscribe(dataValue => this.writeDataValue(dataSource, dataValue));
                });
            });
    }

    onCommunicationManagerStarting() {
        super.onCommunicationManagerStarting();
        this._opcuaConnector?.connect();
    }

    onCommunicationManagerStopping() {
        super.onCommunicationManagerStopping();
        this._stopped$.next();
        this._stopped$.complete();
        this._opcuaConnector?.disconnect();
    }

    onDispose() {
        this._opcuaConnector?.removeAllListeners();
    }

    /**
     * Overwrite this method to perform side effects on writing a single data
     * value or to perform conditional writes.
     *
     * By default, the given data value is written to the given OPC UA data
     * source variable. If an error occurs it is emitted by the
     * `traceOpcuaError` method.
     *
     * @param dataSource an OPC UA data source for a variable to be written
     * @param dataValue the value to be written
     */
    protected writeDataValue(dataSource: OpcuaDataSource, dataValue: any) {
        this._opcuaConnector.writeVariableValue(dataSource, dataValue)
            .catch(error => this._opcuaConnector.emit("error", error));
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
