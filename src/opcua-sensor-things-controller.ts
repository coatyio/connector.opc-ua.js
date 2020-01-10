/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import { Subscription } from "rxjs";

import { AdvertiseEvent, ResolveEvent } from "coaty/com";
import { Uuid } from "coaty/model";
import { NodeUtils } from "coaty/runtime-node";
import {
    MockSensorIo,
    Observation,
    ObservationPublicationType,
    Sensor,
    SensorContainer,
    SensorIo,
    SensorSourceController,
    SensorThingsTypes,
    Thing,
} from "coaty/sensor-things";
import { TimeInterval } from "coaty/util";

import { OpcuaConnector, OpcuaDataSource, OpcuaOptions } from "./opcua-connector";

/**
 * Configuration options for the `OpcuaSensorThingsController` to be defined on
 * the `opcuaSensorOptions` property.
 *
 * Defines sensor mappings for an `OpcuaSensorThingsController`. The sensors
 * given by their object ID are associated with monitored OPC UA items as
 * defined by the `OpcuaOptions.dataSources` property of this interface.
 *
 * Example:
 * ```ts
 * const opcuaSensorOptions: OpcuaSensorOptions = {
 *     endpointUrl: "opc.tcp://139.23.56.3:4334/UA/Producer",
 *     connectionOptions: { ... },
 *     dataSources: {
 *         "PLC1.Tag1": {
 *             nodeIdentifier: { namespaceUri: "urn:NodeOPCUA-Server-default", identifierWithType: "i=2001" },
 *             shouldMonitorItem: true,
 *             samplingInterval: 1000,
 *         },
 *     },
 *     sensorIds: {
 *         "PLC1.Tag1": "6ffcca86-dfe4-46d7-a4a1-f7fdb5e54510",  // sensor's objectId
 *     },
 * };
 * ```
 */
export interface OpcuaSensorOptions extends OpcuaOptions {

    /**
     * An object hash of Sensor object Ids to be associated with monitored OPC
     * UA items as defined by the `OpcuaOptions.dataSources` property of this
     * interface.
     */
    sensorIds: { [dataSourceIdentifier: string]: Uuid };
}

/**
 * Defines the sensor io interface for an OPC UA item.
 */
export class OpcuaSensorIo extends MockSensorIo {
}

/**
 * Creates and manages Sensor and Thing objects for monitored OPC UA items.
 *
 * Acts as a sensor source for OPC UA items (e.g. analog data items), i.e.
 * advertises sensor objects, makes them discoverable, and publishes
 * observations for its sensors associated with OPC UA items.
 *
 * Mappings from OPC UA data sources to sensor object ids are configured on a
 * controller option named `opcuaSensorOptions` which must implement the
 * `opcuaSensorOptions` interface.
 *
 * The sensor used for mapping OPC UA data sources can be defined either
 * programmatically by calling `registerSensor` method or by specifying them in
 * the controller's `sensors` option (see documentation of base class
 * `SensorSourceController`). In both cases, specify a sensor's io interface to
 * be of type `OpcuaSensorIo` and specify the `observationPublicationType`
 * property either as
 * - `"none"`: an observation is published on a Channel event synchronously with
 *   each received OPC UA data value (default),
 * - `"advertise"`: an observation is published on an Advertise event at regular
 *   intervals specified by `samplingInterval`, or
 * - `"channel"`: an observation is published on a Channel event at regular
 *   intervals specified by `samplingInterval`.
 *
 * Thing objects for the registered sensors can be registered either
 * programmatically by calling `registerThing` method or by specifying them in
 * the controller's `things` option as an array of `Thing` objects. Registered
 * Thing objects are advertised (unless `ignoreThingAdvertise` option is set)
 * and made discoverable (unless `skipThingDiscoverEvents` option is set) either
 * by their Thing object type or by their Thing object type *and* their external
 * ID.
 *
 * By default, monitored OPC UA data values are passed unchanged as observation
 * results. You can implement a specific data value coercion by defining a
 * `coerceValue` function in the associated `OpcuaDataSource`.
 *
 * @remarks This controller only runs in a Node.js runtime, not in a browser.
 */
export class OpcuaSensorThingsController extends SensorSourceController {

    private _things = new Map<Uuid, Thing>();
    private _sensorObservationTypes = new Map<Uuid, ObservationPublicationType>();
    private _discoverThingSubscription: Subscription;
    private _opcuaConnector: OpcuaConnector;

    onInit() {
        super.onInit();
        const opcuaOpts = this.options.opcuaSensorOptions as OpcuaSensorOptions;
        if (!opcuaOpts) {
            NodeUtils.logError("OpcuaSensorOptions must be specified for OpcuaSensorThingsController.");
            return;
        }

        if (Array.isArray(this.options.things)) {
            this.options.things.forEach(thing => this.registerThing(thing));
        }

        this._opcuaConnector = new OpcuaConnector(opcuaOpts);
        this._opcuaConnector
            .on("error", error => this.traceOpcuaError(error))
            .on("dataValueChange", (
                dataSourceIdentifier: string,
                dataSource: OpcuaDataSource,
                dataValue: any,
                sourceTimestamp?: Date) => {
                const sensorId = opcuaOpts.sensorIds[dataSourceIdentifier];
                if (sensorId === undefined) {
                    return;
                }
                const sensorIo = this.getSensorIo(sensorId);
                if (sensorIo === undefined) {
                    return;
                }
                const timestamp = sourceTimestamp instanceof Date ? sourceTimestamp.valueOf() : Date.now();
                sensorIo.write({ resultTime: timestamp, result: dataValue });

                if (this._sensorObservationTypes.get(sensorId) === "none") {
                    this.publishChanneledObservation(sensorId);
                }
            });
    }

    onCommunicationManagerStarting() {
        super.onCommunicationManagerStarting();

        if (!this.options.skipThingDiscoverEvents) {
            this._discoverThingSubscription = this._observeDiscoverThing();
        }

        this._opcuaConnector && this._opcuaConnector.connect();
    }

    onCommunicationManagerStopping() {
        super.onCommunicationManagerStopping();
        this._opcuaConnector && this._opcuaConnector.disconnect();
        this._discoverThingSubscription && this._discoverThingSubscription.unsubscribe();
    }

    /**
     * Registers a Thing to this controller.
     *
     * You can call this function at runtime or register things automatically at
     * the beginning by passing them in the controller options under 'things' as
     * an array of Thing objects.
     *
     * If a Thing with the given objectId already exists, this method is simply
     * ignored.
     *
     * Whenever a thing is registered, it is advertised to notify other
     * listeners (unless `ignoreThingAdvertise` option is set). The controller
     * class also starts to listen on Discover events for Things (unless
     * `skipThingDiscoverEvents` option is set). Registered things are
     * discoverable either by their Thing object type or by their Thing object
     * type *and* their external ID.
     *
     * @param thing Thing to register to the controller.
     */
    registerThing(thing: Thing) {
        if (this._things.has(thing.objectId)) {
            return;
        }
        if (thing.parentObjectId === undefined) {
            // Enables clean up of thing and its sensors by last-will Deadvertise identity event.
            thing.parentObjectId = this.communicationManager.identity.objectId;
        }
        this._things.set(thing.objectId, thing);

        if (!this.options.ignoreThingAdvertise) {
            this.communicationManager.publishAdvertise(AdvertiseEvent.withObject(this.identity, thing));
        }
    }

    /**
     * Register a Sensor to this controller.
     *
     * You can call this function at runtime or register sensors automatically
     * at the beginning by passing them in the controller options under
     * 'sensors' objects (see documentation of base class
     * `SensorSourceController`). In both cases, specify a sensor's io interface
     * to be of type `OpcuaSensorIo` and specify the
     * `observationPublicationType` property either as
     * - `"none"`: an observation is published on a Channel event synchronously
     *   with each received OPC UA data value (default),
     * - `"advertise"`: an observation is published on an Advertise event at
     *   regular intervals specified by `samplingInterval`, or
     * - `"channel"`: an observation is published on a Channel event at regular
     *   intervals specified by `samplingInterval`.
     *
     * @param sensor a Sensor object
     * @param io the sensor's io interface
     * @param observationPublicationType how to publish sensor observations, one
     * of "none", "advertise", "channel" (optional)
     * @param samplingInterval regular publication interval in milliseconds
     * (optional)
     */
    registerSensor(
        sensor: Sensor,
        io: SensorIo,
        observationPublicationType: ObservationPublicationType = "none",
        samplingInterval?: number) {
        super.registerSensor(sensor, io, observationPublicationType, samplingInterval);
        this._sensorObservationTypes.set(sensor.objectId, observationPublicationType);
    }

    /**
     * Overwrite this method to define how Observation object should be created.
     *
     * Do not call this method in your application code, it is called by this
     * controller internally.
     *
     * @param container Sensor container creating this observation
     * @param value value of the observation
     * @param resultQuality the quality of the result
     * @param validTime the validity time of the observation (optional)
     * @param parameters extra parameters for the observation (optional)
     */
    protected createObservation(
        container: SensorContainer,
        value: any,
        resultQuality?: string[],
        validTime?: TimeInterval,
        parameters?: { [key: string]: any; }): Observation {
        const obs = super.createObservation(
            container,
            value.result,
            resultQuality,
            validTime,
            parameters);
        // Use the timestamp provided with the OPC UA value (see publishOpcuaObservation).
        obs.resultTime = obs.phenomenonTime = value.resultTime;
        return obs;
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

    private _observeDiscoverThing() {
        return this.communicationManager.observeDiscover(this.identity)
            .subscribe(event => {
                if (event.eventData.isObjectTypeCompatible(SensorThingsTypes.OBJECT_TYPE_THING)) {
                    this._things.forEach(thing => {
                        if (event.eventData.isDiscoveringExternalId && thing.externalId !== event.eventData.externalId) {
                            return;
                        }

                        if (event.eventData.isObjectTypeCompatible(SensorThingsTypes.OBJECT_TYPE_SENSOR)) {
                            // Resolve Thing object with associated sensors as related objects.
                            event.resolve(ResolveEvent.withObject(
                                this.identity,
                                thing,
                                this.registeredSensors.filter(s => s.parentObjectId === thing.objectId)),
                            );
                        } else {
                            // Resolve Thing without associated sensors.
                            event.resolve(ResolveEvent.withObject(this.identity, thing));
                        }
                    });
                }
            });
    }

}
