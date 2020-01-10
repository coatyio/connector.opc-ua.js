/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import { EventEmitter } from "events";

import {
    AttributeIds,
    BrowseDescription,
    BrowsePath,
    ClientSession,
    ClientSubscription,
    coerceNodeId,
    DataType,
    makeBrowsePath,
    MonitoringParametersOptions,
    NodeId,
    OPCUAClient,
    OPCUAClientOptions,
    readUAAnalogItem,
    ReadValueIdOptions,
    ReferenceDescription,
    TimestampsToReturn,
    UserIdentityInfo,
    UserTokenType,
    Variant,
} from "node-opcua-client";

/**
 * Defines options for connecting to an OPC UA server and monitoring OPC UA data
 * items.
 */
export interface OpcuaOptions {

    /** 
     * The specific endpoint URL of the OPC UA server, e.g.
     * "opc.tcp://localhost:4334/UA/TestServer".
     */
    endpointUrl: string;

    /**
     * Options to set up an OPC UA client (optional). See interface
     * [OPCUAClientOptions](https://github.com/node-opcua/node-opcua/blob/master/packages/node-opcua-client/source/opcua_client.ts)
     * of `node-opcua-client` package.
     */
    connectionOptions?: OPCUAClientOptions;

    /** 
     * The user identity for a connection session (optional). If not specified,
     * defaults to an unauthenticated anonymous user, i.e.
     * `UserTokenType.Anonymous`.
     *
     * See type
     * [UserIdentityInfo](https://github.com/node-opcua/node-opcua/blob/master/packages/node-opcua-client/source/opcua_client.ts)
     * of `node-opcua-client` package.
     */
    connectionUserIdentity?: UserIdentityInfo;

    /** 
     * An object hash that defines a set of OPC UA data sources to be monitored.
     * The key of each data source is used as a unique identifier for mapping
     * the data source onto a Coaty-specific publishing item.
     */
    dataSources: { [dataSourceIdentifier: string]: OpcuaDataSource };
}

/**
 * Defines characteristics of an OPC UA data source, including its NodeId or
 * browse path, and optional characteristics for monitoring and data value
 * coercion.
 */
export interface OpcuaDataSource {

    /**
     * Identifies the OPC UA item to be monitored by its fully qualified NodeId
     * (optional).
     *
     * This property should be used if the NodeId of the data item is known
     * beforehand. If only the browse path of the data item is known, use the
     * `browsePath` property instead. Note that exactly one of both properties
     * must be specified.
     */
    nodeIdentifier?: OpcuaNodeIdentifier;

    /**
     * Identifies the OPC UA data item to be monitored by its browse path
     * (optional).
     *
     * This property should be used if the NodeID of the data source is not
     * known beforehand. If the NodeId is known, use the `nodeIdentifier`
     * property instead. Note that exactly one of both properties must be
     * specified.
     *
     * The browse path consists of a root node, e.g. `"RootFolder"`, and a
     * relative path of BrowseNames to the target item, e.g.
     * `"/Objects/Server.ServerStatus.BuildInfo"`. Note that the final browse
     * name in the path must specify the item to be monitored, it must not be
     * omitted (i.e. no wildcard operation is allowed). A specification of the
     * relative path BNF can be found
     * [here](https://reference.opcfoundation.org/v104/Core/docs/Part4/A.2/).
     *
     * Note that in addition to this specification, a browse name within a
     * relative path can also be qualified with a namespace URI instead of a
     * namespace index, in the format `[<namespace-uri>]:<name>`. For example,
     * `[urn:MyOPCUA-Server-default]:MyDevice` instead of `1:MyDevice`. We
     * recommend to **always** use namespace URIs so that browse paths can be
     * persisted and resolved across OPC UA sessions.
     */
    browsePath?: { rootNode: any, relativePath: string };

    /**
     * Determines whether the OPC UA data item should be monitored (optional).
     *
     * If not specified, the item is **not** monitored by default.
     */
    shouldMonitorItem?: boolean;

    /**
     * The interval that defines the fastest rate at which MonitoredItem(s)
     * should be accessed and evaluated (optional, for monitored items only).
     * This interval is defined in milliseconds.
     * - The value 0 indicates that the Server should use the fastest practical
     *   rate.
     * - The value -1 indicates that the default sampling interval defined by
     *   the publishing interval of the Subscription is requested.
     * - A different sampling interval is used if the publishing interval is not
     *   a supported sampling interval.
     * - Any negative number is interpreted as -1.
     * - The sampling interval is not changed if the publishing interval is
     *   changed by a subsequent call to the ModifySubscription Service.
     * - The Server uses this parameter to assign the MonitoredItems to a
     *   sampling interval that it supports.
     * - The assigned interval is provided in the revisedSamplingInterval
     *   parameter.
     * - The Server shall always return a revisedSamplingInterval that is equal
     *   or higher than the requested samplingInterval.
     * - If the requested samplingInterval is higher than the maximum sampling
     *   interval supported by the Server, the maximum sampling interval is
     *   returned.
     */
    samplingInterval?: number;

    /**
     * A coercion function that coerces a given OPC UA data value to a value
     * used by application or vice versa (optional).
     *
     * If not specified, no coercion takes place and the original value is used.
     *
     * The coercion function is applied in all OPC UA related operations, i.e.
     * when reading, writing, and monitoring OPC UA items. If the coercion
     * function throws an error when invoked, the related operation is not
     * executed and the error is signalled to the invoker of the operation.
     *
     * The `forReading` parameter determines whether coercion is invoked for
     * reading/monitoring an OPC UA value or for writing the value of an OPC UA
     * item.
     *
     * @remarks The optional timestamp passed in the coercion function is a
     * `Date` indicating the last change of the passed-in value. The timestamp
     * is `undefined` if not provided in the specific OPC UA operation context).
     */
    coerceValue?: (value: any, timestamp?: Date, forReading?: boolean) => any;

    /**
     * The OPC UA data type used for writing the value of an OPC UA variable
     * (optional). Only used by writing methods of `OpcuaConnector`.
     */
    dataType?: string | DataType;

    /**
     * Extra application-specific properties (optional).
     */
    [extra: string]: any;
}

/**
 * Represents an OPC UA node using a namespace URI instead of a namespace index,
 * so that node identifiers can be persisted and resolved across OPC UA
 * sessions.
 *
 * Note: a namespace index managed by an OPC UA server might point to different
 * namespace URIs in different client sessions. For this reason, we use
 * namespace URIs to identify nodes.
 */
export interface OpcuaNodeIdentifier {

    /**
     * Specifies the namespace URI on the OPC UA server (optional). If omitted,
     * defaults to the standard OPC UA system namespace with index 0
     * ("http://opcfoundation.org/UA/").
     */
    namespaceUri?: string;

    /**
     * A string in the format "<nodeIdentifierType>=<nodeIdentifier>" as defined
     * by OPC UA. For example, "s=Device001.Tag4711" (string), "i=1234"
     * (integer), "g=01cb879b-ddd7-4edc-909c-37f23ff9e6c3" (Guid/UUID),
     * "b=FFA50037" (opaque/binary byte string).
     */
    identifierWithType: string;
}

/**
 * Represents information about an OPC UA engineering unit.
 */
export interface OpcuaEuInformation {

    /** 
     * Identifies the organization (company, standards organization) that defines the EUInformation.
     */
    namespaceUri?: string;

    /**
     * Identifier for programmatic evaluation. −1 is used if a unitId is not available.
     */
    unitId?: number;

    /**
     * The display name of the engineering unit. This is typically the
     * abbreviation of the engineering unit, for example "h" for hour or "m/s"
     * for meter per second.
     */
    displayName?: { text: string, locale: any };

    /**
     * Contains the full name of the engineering unit such as "hour" or "meter
     * per second".
     */
    description?: { text: string, locale: any };
}

/**
 * Represents metadata of an OPC UA Analog Item.
 */
export interface OpcuaAnalogDataItem {

    /** 
     * Specifies the unit for the Analog Item value, e.g., DEGC, Hertz,
     * Seconds (optional).
     */
    engineeringUnits?: OpcuaEuInformation;

    /** Defines the value range likely to be obtained in normal operation. */
    engineeringUnitsRange: { low: number, high: number };

    /** 
     * Defines the value range that can be returned by the instrument
     * (optional).
     */
    instrumentRange?: { low: number, high: number };

    /**
     * Specifies the maximum precision that the server can maintain for the item
     * based on restrictions in the target environment. For float and double
     * values, specifies the number of digits after the decimal place. For
     * DateTime values it indicates the minimum time difference in nanoseconds.
     * For example, a ValuePrecision of 20 000 000 defines a precision of 20 ms.
     * (optional).
     */
    valuePrecision?: number;

    /** 
     * A vendor-specific, human readable string that specifies how the value of
     * this data item is calculated (optional).
     *
     * Definition is non-localized and will often contain an equation that can
     * be parsed by certain clients. Example: Definition ::= "(TempA - 25) +
     * TempB".
     */
    definition?: string;
}

/**
 * A connector service that provides base OPC UA Client functionality to be used
 * by a Coaty controller class.
 *
 * Create an instance of this service class in the `onInit` method of the
 * controller passing in `OpcuaOptions`. Invoke `connect` on this service in the
 * `onCommunicationManagerStarting` method. Invoke `disconnect` on this service
 * in the `onCommunicationManagerStopping` method.
 *
 * Invoke `registerDataSources` to register OPC UA data sources at run time, in
 * addition to any data sources specified in the constructor options. 
 *
 * Register event handlers on the `OpcuaConnector.on()` method to get notified
 * of data value changes of a monitored data source item (`"dataValueChange"`
 * event), of errors (`"error"` event), and of OPC UA session establishment.
 *
 * The event handler signatures are defined as follows:
 *
 * ```ts
 * // Emitted whenever an OPC UA error occurs.
 * on("error", (error: any) => void);
 *
 * // Emitted whenever a monitored OPC UA data item changes its value.
 * on("dataValueChanged", (
 *        dataSourceIdentifier: string,
 *        dataSource: OpcuaDataSource,
 *        dataValue: any,
 *        sourceTimestamp?: Date,  // undefined if not provided by OPC UA server
 *   ) => void);
 *
 * // Emitted when the OPC UA client session has been created or closed.
 * // You can access the session object using the getter `opcuaClientSession`.
 * on("sessionCreated", () => void);
 * on("sessionClosed", () => void);
 * ```
 *
 * This class also provides convenience methods to read and write variable
 * values, to read attribute values, to read analog item metadata, to browse
 * data items, and to call OPC UA methods.
 *
 * Note: To enable debug logging on the OPC UA client library level, set the
 * process environment variable `DEBUG` to `ALL`.
 *
 * @remarks This service only runs in a Node.js runtime, not in a browser.
 */
export class OpcuaConnector extends EventEmitter {

    private _opcuaOptions: OpcuaOptions;
    private _client: OPCUAClient;
    private _session: ClientSession;
    private _clientSubscription: ClientSubscription;
    private _dataSources: Map<string, OpcuaDataSource>;

    /**
     * Creates an instance of OpcuaConnector with the given options.
     * 
     * @param opcuaOptions OPC UA options
     */
    constructor(opcuaOptions: OpcuaOptions) {
        super();
        this._opcuaOptions = opcuaOptions;
        this._dataSources = new Map(Object.entries(opcuaOptions.dataSources));
        this._client = OPCUAClient.create(opcuaOptions.connectionOptions || {});
    }

    /**
     * Gets the OPC UA client session, as defined by the interface
     * [ClientSession](https://github.com/node-opcua/node-opcua/blob/master/packages/node-opcua-client/source/client_session.ts)
     * of `node-opcua-client` package.
     *
     * The client session of the connector can be used to access OPC UA client
     * functionality which is not exposed by connector methods.
     *
     * Returns `undefined` if the OPC UA client is not connected, i.e. session
     * is not existing.
     */
    get opcuaClientSession(): ClientSession {
        return this._session;
    }

    /**
     * Asynchronously connects to the OPC UA server, creates a session emitting
     * a `sessionCreated` event, and starts monitoring OPC UA data items if
     * requested.
     */
    connect(): Promise<any> {
        return this._client.connect(this._opcuaOptions.endpointUrl)
            .then(() => this._client.createSession(this._opcuaOptions.connectionUserIdentity || { type: UserTokenType.Anonymous }))
            .then(session => session.readNamespaceArray().then(() => session))
            .then(session => {
                this._session = session;
                this.emit("sessionCreated");
                this._monitorOpcuaItemsIfRequested();
            })
            .catch(error => this.emit("error", error));
    }

    /**
     * Asynchronously disconnects from the OPC UA server, closing the client
     * session and emitting a `sessionClosed` event.
     */
    disconnect() {
        return (this._session ? this._session.close(true) : Promise.resolve())
            .catch(error => this.emit("error", error))
            .then(() => this._session && this.emit("sessionClosed"))
            .then(() => this._session = undefined)
            .then(() => this._clientSubscription = undefined)
            .then(() => this._client.disconnect())
            .catch(error => this.emit("error", error))
            .then(() => this._client = undefined);
    }

    /**
     * Register the given OPC UA data sources.
     *
     * If a given data source identifier has already been registered (e.g. if
     * specified in constructor options), the given data source is silently
     * ignored.
     *
     * @param dataSources object hash of data sources identified by a unique key
     */
    registerDataSources(dataSources: { [dataSourceIdentifier: string]: OpcuaDataSource }) {
        Object.entries(dataSources).forEach(([id, dataSource]) => {
            if (this._dataSources.has(id)) {
                return;
            }
            this._dataSources.set(id, dataSource);
            if (this._session !== undefined) {
                this._monitorOpcuaItemIfRequested(id, dataSource);
            }
        });
    }

    /**
     * Reads the value of an OPC UA variable defined by the given data source
     * and resolves it in the returned promise.
     *
     * @param dataSource OPC UA data source for an OPC UA variable
     * @returns a promise that resolves to the value of the given variable or
     * rejects if value can't be read or coerced
     */
    readVariableValue(dataSource: OpcuaDataSource): Promise<any> {
        return this._nodeIdFromDataSource(dataSource)
            .then(nodeId => this._session.readVariableValue(nodeId))
            .then(dataValue => {
                if (dataValue.statusCode.name !== "Good") {
                    throw new Error(`readVariableValue: ${dataValue.statusCode.description} ${dataSource}`);
                }
                return this._coerceDataValue(dataSource, dataValue.value.value);
            });
    }

    /**
     * Writes the value of an OPC UA variable defined by the given data source.
     *
     * @remarks The OPC UA data type of the value to write is defined by the
     * `OpcuaDataSource.dataType` property.
     *
     * @param dataSource OPC UA data source for an OPC UA variable
     * @param value value to write
     * @returns a promise that resolves if the variable as been written
     * successfully or rejects if value can't be coerced or written
     */
    writeVariableValue(dataSource: OpcuaDataSource, value: any): Promise<any> {
        return this._nodeIdFromDataSource(dataSource)
            .then(nodeId => {
                value = this._coerceDataValue(dataSource, value, undefined, false);
                return this._session.writeSingleNode(nodeId, Variant.coerce({ dataType: dataSource.dataType, value }));
            })
            .then(statusCode => {
                if (statusCode.name !== "Good") {
                    throw new Error(`writeVariableValue: ${statusCode.description} ${dataSource}`);
                }
            });
    }

    /**
     * Reads an attribute value of an OPC UA item defined by the given data
     * source and resolves it in the returned promise.
     *
     * @remarks To use this method in your application code, `import {
     * AttributeIds } from "node-opcua-client"`.
     *
     * @param dataSource OPC UA data source for an OPC UA item
     * @param attributeId an OPC UA compliant AttributeId as defined by enum
     * [AttributeIds](https://github.com/node-opcua/node-opcua/blob/master/packages/node-opcua-data-model/source/attributeIds.ts)
     * @returns a promise that resolves to the attribute value of the given item
     * or rejects if attribute value can't be read or coerced
     */
    readAttributeValue(dataSource: OpcuaDataSource, attributeId: AttributeIds): Promise<any> {
        return this._nodeIdFromDataSource(dataSource)
            .then(nodeId => this._session.read({ nodeId, attributeId }))
            .then(dataValue => {
                if (dataValue.statusCode.name !== "Good") {
                    // tslint:disable-next-line: max-line-length
                    throw new Error(`readAttributeValue: ${dataValue.statusCode.description} ${dataSource}`);
                }
                return this._coerceDataValue(dataSource, dataValue.value.value);
            });
    }

    /**
     * Reads metadata of an OPC UA Analog Item defined by the given data source.
     *
     * @remarks This method doesn't read the variable value of the analog data
     * item, only its metadata.
     *
     * @param dataSource OPC UA data source for an OPC UA Analog Item
     * @returns a promise that resolves to an `OpcuaAnalogDataItem` object or
     * rejects if analog data item cannot be read.
     */
    readAnalogDataItem(dataSource: OpcuaDataSource): Promise<OpcuaAnalogDataItem> {
        return this._nodeIdFromDataSource(dataSource)
            // Paper over a bug in node-opcua where interface
            // AnalogDataItemSnapshot erroneously uses `Variant` as property
            // value type although real values are of type `any` (i.e.
            // Variant.value).
            .then(nodeId => readUAAnalogItem(this._session, nodeId) as any as OpcuaAnalogDataItem);
    }

    /**
     * Browse the given OPC UA data item, i.e. asynchronously receive a list of
     * all its OPC UA child nodes.
     *
     * @param dataSource OPC UA data source for an OPC UA item to browse
     * @returns a promise that resolves to an array of `ReferenceDescription`
     * objects describing child nodes (imported from `node-opcua-client`) or
     * rejects if the given item couldn't be browsed.
     */
    browse(dataSource: OpcuaDataSource): Promise<ReferenceDescription[]> {
        return this._nodeIdFromDataSource(dataSource)
            .then(nodeId => this._session.browse(new BrowseDescription({ nodeId })))
            .then(browseResult => {
                if (browseResult.statusCode.name !== "Good") {
                    throw new Error(`browse: ${browseResult.statusCode.description} ${dataSource}`);
                }
                return browseResult.references;
            });
    }

    /**
     * Calls an OPC UA method on the given object node. The method is specified
     * by its method node, and the input arguments.
     *
     * @param objectDataSource OPC UA data source of the object node that
     * provides the method
     * @param methodDataSource  OPC UA data source of the method node to call
     * @param inputArguments an array of objects defining OPC UA data type and
     * value of input arguments.
     * @returns a promise that resolves to an array of result values for the
     * output arguments of the method call; the promise rejects if the given
     * method call fails.
     */
    call(
        objectDataSource: OpcuaDataSource,
        methodDataSource: OpcuaDataSource,
        inputArguments: Array<{ dataType: string | DataType, value: any }>,
    ): Promise<any[]> {
        return this._nodeIdFromDataSource(objectDataSource)
            .then(objectNodeId => this._nodeIdFromDataSource(methodDataSource)
                .then(methodNodeId => this._session.call({
                    objectId: objectNodeId,
                    methodId: methodNodeId,
                    inputArguments,
                })))
            .then(methodResult => {
                if (methodResult.statusCode.name !== "Good") {
                    throw new Error(`call: ${methodResult.statusCode.description} ${objectDataSource} ${methodDataSource}`);
                }
                return methodResult.outputArguments.map(v => v.value);
            });
    }

    private _coerceDataValue(dataSource: OpcuaDataSource, dataValue: any, dataTimestamp?: Date, forReading = true) {
        if (dataSource.coerceValue !== undefined) {
            return dataSource.coerceValue(dataValue, dataTimestamp, forReading);
        }
        return dataValue;
    }

    private _createClientSubscription() {
        if (this._clientSubscription === undefined) {
            this._clientSubscription = ClientSubscription.create(this._session, {
                // These are the default values for options provided by class
                // ClientSubscription.
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 60,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 0,
                publishingEnabled: true,
                priority: 1,
            }).on("internal_error", (err: Error) => {
                this.emit("error", err);
            });
        }
        return this._clientSubscription;
    }

    private _monitorOpcuaItemsIfRequested() {
        this._dataSources.forEach((dataSource, identifier) => this._monitorOpcuaItemIfRequested(identifier, dataSource));
    }

    private _monitorOpcuaItemIfRequested(dataSourceIdentifier: string, dataSource: OpcuaDataSource) {
        if (!dataSource.shouldMonitorItem) {
            return;
        }
        const subscription = this._createClientSubscription();
        this._nodeIdFromDataSource(dataSource)
            .then(nodeId => {
                const itemToMonitor: ReadValueIdOptions = {
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value,
                };
                const requestedParams: MonitoringParametersOptions = {
                    samplingInterval: dataSource.samplingInterval,
                    filter: null,
                    discardOldest: true,
                    queueSize: 1,
                };
                return subscription.monitor(itemToMonitor, requestedParams, TimestampsToReturn.Source);
            })
            .then(item => item
                .on("changed", dataValue => {
                    const sourceTimestamp = !dataValue.sourceTimestamp ? undefined : dataValue.sourceTimestamp as Date;
                    let value: any;
                    try {
                        value = this._coerceDataValue(dataSource, dataValue.value.value, sourceTimestamp);
                    } catch (error) {
                        // tslint:disable-next-line: max-line-length
                        this.emit("error", new Error(`Monitored item ${item.itemToMonitor.nodeId}: Coercing OPC UA data value failed: ${error}`));
                        return;
                    }
                    this.emit("dataValueChange",
                        dataSourceIdentifier,
                        dataSource,
                        value,
                        sourceTimestamp);
                })
                .on("err", (message: string) =>
                    this.emit("error", new Error(`Monitored item ${item.itemToMonitor.nodeId}: ${message}`))))
            .catch(error => this.emit("error", error));
    }

    private _nodeIdFromDataSource(dataSource: OpcuaDataSource) {
        return (dataSource.nodeIdentifier ?
            this._nodeIdFromNodeIdentifier(dataSource.nodeIdentifier) :
            this._nodeIdFromBrowsePath(dataSource.browsePath));
    }

    private _nodeIdFromNodeIdentifier(nodeIdentifier: OpcuaNodeIdentifier): Promise<NodeId> {
        const { namespaceUri, identifierWithType } = nodeIdentifier;
        const nsi = !namespaceUri ? 0 : this._session.getNamespaceIndex(namespaceUri);
        if (nsi === -1) {
            // Ignore items with undefined namespace URI.
            return Promise.reject(new Error(`Ignoring item ${identifierWithType} with undefined OPC UA namespace URI ${namespaceUri}`));
        }
        return Promise.resolve(coerceNodeId(identifierWithType, nsi));
    }

    private _nodeIdFromBrowsePath(browsePath: { rootNode: any, relativePath: string }): Promise<NodeId> {
        let path: BrowsePath;
        try {
            const relPath = this._convertRelativePath(browsePath.relativePath, browsePath.rootNode);
            path = makeBrowsePath(browsePath.rootNode, relPath);
        } catch (error) {
            return Promise.reject(error);
        }
        return this._session.translateBrowsePath(path)
            .then(result => {
                if (result.statusCode.name !== "Good") {
                    // tslint:disable-next-line: max-line-length
                    throw new Error(`BrowsePath invalid: ${result.statusCode.description} ${browsePath.rootNode} ${browsePath.relativePath}`);
                }
                return result.targets[0].targetId;
            });
    }

    private _convertRelativePath(relativePath: string, rootNode: any) {
        // Replace namespace URIs of the form "[<namespace-uri>]:<name>" by
        // namespace indices.
        return relativePath.replace(/(\[.*?\])/g, match => {
            const namespaceUri = match.substring(1, match.length - 1);
            const nsi = this._session.getNamespaceIndex(namespaceUri);
            if (nsi === -1) {
                // Ignore items with undefined namespace URI.
                throw new Error(`Ignoring item ${rootNode} ${relativePath} with undefined OPC UA namespace URI ${namespaceUri}`);
            }
            return nsi.toString();
        });
    }

}
