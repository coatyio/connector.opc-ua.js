/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { DataType } from "node-opcua-client";

import { CallEventData, RemoteCallErrorCode, RemoteCallErrorMessage, ReturnEvent } from "coaty/com";
import { Controller } from "coaty/controller";
import { CoatyObject } from "coaty/model";
import { NodeUtils } from "coaty/runtime-node";

import { OpcuaConnector, OpcuaOptions } from "./opcua-connector";

/**
 * Defines an OPC UA method input argument to be mapped to a parameter of the
 * associated Call event operation.
 */
export interface OpcuaInputArgumentMapping {

    /**
     * The name or index of the Call event parameter to be mapped to this OPC UA
     * method input argument. If the given parameter has not been specified in
     * the Call event, the associated OPC UA method is not invoked and a Return
     * event with an InvalidParameters error is published.
     */
    parameter: string | number;

    /** The OPC UA data type of this input argument. */
    dataType: string | DataType;

    /**
     * A function that validates the value of the associated Call event
     * parameter (optional).
     *
     * The function should return `false`, if validation fails; otherwise
     * `true`. If validation fails or if the function throws an error, the
     * associated OPC UA method is not invoked and a Return event with an
     * InvalidParameters error is published.
     *
     * If this property is not specified, the parameter is not validated and the
     * associated OPC UA method is called with the given (maybe coerced)
     * parameter value as input argument.
     */
    validateParameter?: (value: any) => boolean;

    /**
     * A coercion function that coerces the value of the associated Call event
     * parameter (optional).
     *
     * If not specified, no coercion takes place and the original value is used.
     *
     * If the coercion function throws an error, the OPC UA method is not
     * invoked and a Return event with an InvalidParameters error is published.
     *
     * @remarks Coercion always takes place after parameter validation (see
     * property `validateParameter`).
     */
    coerceParameter?: (value: any) => any;
}

/**
 * Defines a one-to-one mapping from a Call-Return event operation to an OPC UA
 * method call.
 */
export interface OpcuaCallReturnMapping {

    /** 
     * The name of the Call event operation to be mapped to an OPC UA method
     * call.
     */
    operation: string;

    /**
     * The operation context to be matched against the context filter of the
     * Call event (optional).
     */
    operationContext?: CoatyObject;

    /**
     * An array of mappings for OPC UA method input arguments associated with
     * specific Call event parameters.
     *
     * The order of mappings must mirror the order of OPC UA input arguments.
     * Superfluous Call event parameters are ignored. If input argument mappings
     * for unknown Call event parameters are specified, the associated OPC UA
     * method is not invoked and a Return event with an InvalidParameters error
     * is published.
     */
    inputArguments: OpcuaInputArgumentMapping[];

    /**
     * A coercion function that coerces the array of result (i.e. output
     * argument) values of the OPC UA method call to the result value of the
     * associated Return event (optional).
     *
     * If not specified, a default coercion takes place: If the array of output
     * argument values contains just a single value, this value is passed as a
     * result value. If the array of output argument values is empty,
     * `undefined` is passed as result value. Otherwise, the array of output
     * argument values is passed unchanged.
     *
     * If the coercion function throws an error, a Return event with a "Bad
     * OPC UA method call" error (error code 1) is published.
     */
    coerceOutputArguments?: (resultValues: any[]) => any;

}

/**
 * Configuration options for the `OpcuaRemoteOperationController` to be defined
 * on the `opcuaRemoteOperationOptions` property.
 *
 * Defines remote operation calls to be observed and mapped onto OPC UA method
 * calls by the `OpcuaRemoteOperationController` as defined by the
 * `OpcuaOptions.dataSources` property of this interface.
 *
 * Example:
 * ```ts
 * const producerNamespaceUri = "urn:NodeOPCUA-Server-default";
 * const opcuaRemoteOperationOptions: OpcuaRemoteOperationOptions = {
 *     endpointUrl: "opc.tcp://139.23.56.3:4334/UA/Producer",
 *     connectionOptions: { ... },
 *     dataSources: {
 *         // Object node providing the AlertTemperature method.
 *         "PLC2": {
 *             browsePath: {
 *                 rootNode: "RootFolder",
 *                 relativePath: `/Objects/[${producerNamespaceUri}]:S7-1500 PLC 2`,
 *             },
 *         },
 *         // Method node for AlertTemperature method.
 *         "PLC2.AlertTemperature": {
 *             browsePath: {
 *                 rootNode: "RootFolder",
 *                 relativePath: `/Objects/[${producerNamespaceUri}]:S7-1500 PLC 2.[${producerNamespaceUri}]:AlertTemperature`,
 *             },
 *         },
 *     },
 *     calls: {
 *          "PLC2": {
 *              "PLC2.AlertTemperature": {
 *                  operation: "alertTemperature",
 *                  inputArguments: [
 *                      {
 *                          parameter: "temp",
 *                          dataType: "Double",
 *                      },
 *                      {
 *                          parameter: "isTooLow",
 *                          dataType: "Boolean",
 *                      },
 *                  ],
 *              },
 *          },
 *     },
 * };
 * ```
 */
export interface OpcuaRemoteOperationOptions extends OpcuaOptions {

    /**
     * An object hash of Call-Return mappings to be associated with OPC UA
     * object node data sources that provide method node data sources to be
     * called. Object and method node data sources are defined by the
     * `OpcuaOptions.dataSources` property of this interface.
     */
    calls: { [objectDataSourceIdentifier: string]: { [methodDataSourceIdentifier: string]: OpcuaCallReturnMapping } };
}

/**
 * This controller maps incoming Call events to OPC UA method calls.
 *
 * It connects to OPC UA server, observes incoming Call events, invokes
 * associated OPC UA method calls, and responds with Return events containing
 * the output arguments of the OPC UA method calls.
 *
 * Mappings from Call events to OPC UA method calls are configured on a
 * controller option named `opcuaRemoteOperationOptions` which must implement
 * the `OpcuaRemoteOperationOptions` interface. You can also implement
 * application specific Call event parameter validation and coercion functions
 * as well as a function to coerce OPC UA method output arguments to a Return
 * event result value.
 *
 * An incoming Call event is responded with a Return error event in the
 * following cases:
 * - Call event parameters cannot be mapped onto OPC UA method input arguments,
 *   because they are either not present on the Call event, or parameter
 *   validation or coercion fails.
 * - The OPC UA method call fails, i.e. the returned status code is not "Good".
 * - The OPC UA method output arguments cannot be coerced to a Return event
 *   result value.
 *
 * @remarks This controller only runs in a Node.js runtime, not in a browser.
 */
export class OpcuaRemoteOperationController extends Controller {

    private _opcuaConnector: OpcuaConnector;
    private _stopped$ = new Subject();

    onInit() {
        super.onInit();
        const opcuaOpts = this.options.opcuaRemoteOperationOptions as OpcuaRemoteOperationOptions;
        if (!opcuaOpts) {
            NodeUtils.logError("OpcuaRemoteOperationOptions must be specified for OpcuaRemoteOperationController.");
            return;
        }

        this._opcuaConnector = new OpcuaConnector(opcuaOpts);
        this._opcuaConnector
            .on("error", error => this.traceOpcuaError(error))
            .on("sessionCreated", () => {
                Object.entries(opcuaOpts.calls).forEach(([objectSourceId, methods]) => {
                    const objectDataSource = opcuaOpts.dataSources[objectSourceId];
                    if (!objectDataSource) {
                        return;
                    }
                    Object.entries(methods).forEach(([methodSourceId, callReturnMapping]) => {
                        const methodDataSource = opcuaOpts.dataSources[methodSourceId];
                        if (!methodDataSource) {
                            return;
                        }
                        this.communicationManager.observeCall(
                            this.identity,
                            callReturnMapping.operation,
                            this.getOperationContextFor(callReturnMapping))
                            .pipe(
                                takeUntil(this._stopped$),
                            )
                            .subscribe(event => {
                                let opcuaInputArgs;
                                try {
                                    opcuaInputArgs = this._createOpcuaInputArgs(event.eventData, callReturnMapping.inputArguments);
                                } catch (error) {
                                    event.returnEvent(ReturnEvent.withError(
                                        this.identity,
                                        RemoteCallErrorCode.InvalidParameters,
                                        RemoteCallErrorMessage.InvalidParameters));
                                    return;
                                }
                                this._opcuaConnector.call(objectDataSource, methodDataSource, opcuaInputArgs)
                                    .then(resultValues => {
                                        event.returnEvent(ReturnEvent.withResult(
                                            this.identity,
                                            this._coerceOutputArguments(resultValues, callReturnMapping)));
                                    })
                                    .catch(error => {
                                        event.returnEvent(ReturnEvent.withError(
                                            this.identity,
                                            1,
                                            "Bad OPC UA method call"));
                                    });
                            });
                    });
                });
            });
    }

    onCommunicationManagerStarting() {
        super.onCommunicationManagerStarting();
        this._opcuaConnector && this._opcuaConnector.connect();
    }

    onCommunicationManagerStopping() {
        super.onCommunicationManagerStopping();
        this._stopped$.next();
        this._stopped$.complete();
        this._opcuaConnector && this._opcuaConnector.disconnect();
    }

    /**
     * Overwrite this method to provide a remote operation context for observing
     * Call events for a given remote operation.
     *
     * By default, if specified, the operation context of the given
     * `callReturnMapping` is returned. Otherwise, `undefined` is returned.
     *
     * Do not call this method in your application code, it is called by this
     * controller internally.
     *
     * @param callReturnMapping maps a Call event to an OPC UA method call
     */
    protected getOperationContextFor(callReturnMapping: OpcuaCallReturnMapping) {
        return callReturnMapping.operationContext;
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

    private _createOpcuaInputArgs(eventData: CallEventData, inputArgs: OpcuaInputArgumentMapping[]) {
        return inputArgs.map(inputArg => {
            let paramValue: any;
            if (typeof inputArg.parameter === "string") {
                paramValue = eventData.getParameterByName(inputArg.parameter);
            } else {
                paramValue = eventData.getParameterByIndex(inputArg.parameter);
            }
            if (paramValue === undefined) {
                throw new Error();
            }
            if (inputArg.validateParameter !== undefined && !inputArg.validateParameter(paramValue)) {
                throw new Error();
            }
            if (inputArg.coerceParameter !== undefined) {
                paramValue = inputArg.coerceParameter(paramValue);
            }
            return {
                dataType: inputArg.dataType,
                value: paramValue,
            };
        });
    }

    private _coerceOutputArguments(resultValues: any[], callReturnMapping: OpcuaCallReturnMapping) {
        const coerceFunc = callReturnMapping.coerceOutputArguments;
        if (coerceFunc !== undefined) {
            return coerceFunc(resultValues);
        }
        if (resultValues.length === 0) {
            return undefined;
        }
        if (resultValues.length === 1) {
            return resultValues[0];
        }
        return resultValues;
    }

}
