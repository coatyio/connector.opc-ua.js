/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import { BasicIoRouter } from "coaty/io";
import { CoreTypes, Device, DisplayType, User } from "coaty/model";
import { Components, Configuration, Container, Runtime } from "coaty/runtime";
import { NodeUtils } from "coaty/runtime-node";
import { EncodingTypes, ObservationTypes, Sensor, SensorDefinition, SensorThingsTypes, Thing } from "coaty/sensor-things";

import {
    OpcuaIoActorController,
    OpcuaIoActorOptions,
    OpcuaIoSourceController,
    OpcuaIoSourceOptions,
    OpcuaMqttController,
    OpcuaMqttOptions,
    OpcuaOptions,
    OpcuaRemoteOperationController,
    OpcuaRemoteOperationOptions,
    OpcuaSensorIo,
    OpcuaSensorOptions,
    OpcuaSensorThingsController,
} from "coaty-opcua";

import { agentInfo } from "./agent.info";

/* Options specifying OPC UA data sources */

const producerNamespaceUri = "urn:NodeOPCUA-Server-default";

const opcuaOptions: OpcuaOptions = {
    endpointUrl: "opc.tcp://localhost:4334/UA/Producer",
    connectionOptions: {
        // To enable endpoint matching against localhost, set this option to
        // false.
        endpoint_must_exist: false,

        // Extend session lifetime for unsecured connection to maximum UInt32 to
        // prevent premature session expiration after 40secs.
        defaultSecureTokenLifetime: 4294967295,

        // Only needed for OPC UA clients that do not monitor OPC UA items (see
        // OpcuaIoActorController).
        keepSessionAlive: true,
    },
    dataSources: {
        // Variable Tag1 of Object Node device PLC1.
        "PLC1.Tag1": {
            nodeIdentifier: { namespaceUri: producerNamespaceUri, identifierWithType: "i=2001" },
            shouldMonitorItem: true,
            samplingInterval: 1000,
        },
        // Variable FreeMemory of Object node device PLC1.
        "PLC1.FreeMemory": {
            browsePath: {
                rootNode: "RootFolder",
                relativePath: `/Objects/[${producerNamespaceUri}]:S7-1500 PLC 1.[${producerNamespaceUri}]:FreeMemory`,
            },
            shouldMonitorItem: true,
            samplingInterval: 2000,
            coerceValue: (value: number, timestamp?: Date, forReading?: boolean) =>
                forReading ? value / 1024 / 1024 : value * 1024 * 1024,     // from Bytes to MB and vice versa
        },
        // AnalogItemType Temperature of Object node device PLC2.
        "PLC2.Temperature": {
            nodeIdentifier: { namespaceUri: producerNamespaceUri, identifierWithType: "s=temperature" },
            shouldMonitorItem: true,
            samplingInterval: 1000,
        },
        // Object node for device PLC2 providing the AlertTemperature method.
        "PLC2": {
            browsePath: {
                rootNode: "RootFolder",
                relativePath: `/Objects/[${producerNamespaceUri}]:S7-1500 PLC 2`,
            },
        },
        // Method node for AlertTemperature method of Object node for device PLC2.
        "PLC2.AlertTemperature": {
            browsePath: {
                rootNode: "RootFolder",
                relativePath: `/Objects/[${producerNamespaceUri}]:S7-1500 PLC 2.[${producerNamespaceUri}]:AlertTemperature`,
            },
        },
    },
};

/* Options for OpcuaIoSourceController */

const opcuaIoSourceOptions: OpcuaIoSourceOptions = {
    ...opcuaOptions,
    ioSources: {
        "PLC1.Tag1": {
            name: "S7-1500 PLC 1.Tag1",
            objectId: Runtime.newUuid(),
            objectType: CoreTypes.OBJECT_TYPE_IO_SOURCE,
            coreType: "IoSource",
            valueType: "plc.Tag1[Int32]",
        },
        "PLC1.FreeMemory": {
            name: "S7-1500 PLC 1.FreeMemory",
            objectId: Runtime.newUuid(),
            objectType: CoreTypes.OBJECT_TYPE_IO_SOURCE,
            coreType: "IoSource",
            valueType: "plc.FreeMemory[Double.MB]",
        },
        "PLC2.Temperature": {
            name: "S7-1500 PLC 2.Temperature",
            objectId: Runtime.newUuid(),
            objectType: CoreTypes.OBJECT_TYPE_IO_SOURCE,
            coreType: "IoSource",
            valueType: "plc.Temperature[Double.DEGC]",
        },
    },
};

/* Options for OpcuaIoActorController */

const opcuaIoActorOptions: OpcuaIoActorOptions = {
    ...opcuaOptions,
    // Restrict data sources to one writable source whose written values
    // originate from the IO source/actor "S7-1500 PLC 1.Tag1".
    dataSources: {
        // Variable Tag2 of Object node device PLC2.
        "PLC2.Tag2": {
            nodeIdentifier: { namespaceUri: producerNamespaceUri, identifierWithType: "b=1020FFAA" },
            dataType: "String",
            coerceValue: (value: any, timestamp?: Date, forReading?: boolean) =>
                forReading ? Number.parseFloat(value) : value.toString(),       // from double to string and vice versa
        },
    },
    ioActors: {
        "PLC2.Tag2": {
            name: "S7-1500 PLC 1.Tag1",
            objectId: Runtime.newUuid(),
            objectType: CoreTypes.OBJECT_TYPE_IO_ACTOR,
            coreType: "IoActor",
            valueType: "plc.Tag1[Int32]",
        },
    },
};

const user: User = {
    objectId: "d8476053-fa52-4c3f-8a6c-40e4c2512ef1",
    coreType: "User",
    objectType: CoreTypes.OBJECT_TYPE_USER,
    name: "user@coaty.io",
    names: { formatted: "Common User for IO Routing" },
};

const opcuaDev: Device = {
    objectId: Runtime.newUuid(),
    objectType: CoreTypes.OBJECT_TYPE_DEVICE,
    coreType: "Device",
    name: "Producer Device",
    displayType: DisplayType.None,
    ioCapabilities: Object.values({ ...opcuaIoSourceOptions.ioSources, ...opcuaIoActorOptions.ioActors }),
    assigneeUserId: user.objectId,
};

/* Options for OpcuaMqttController */

const opcuaMqttOptions: OpcuaMqttOptions = {
    ...opcuaOptions,
    topics: {
        "PLC1.Tag1": "opcua/plc1/tag1",
        "PLC1.FreeMemory": "opcua/plc1/freeMemory",
        "PLC2.Temperature": "opcua/plc2/temperature",
    },
};

/* Options for OpcuaSensorThingsController */

const thingPlc1: Thing = {
    name: "PLC1",
    objectId: Runtime.newUuid(),
    objectType: SensorThingsTypes.OBJECT_TYPE_THING,
    coreType: "CoatyObject",
    description: "Thing PLC1",
};

const thingPlc2: Thing = {
    name: "PLC2",
    objectId: Runtime.newUuid(),
    objectType: SensorThingsTypes.OBJECT_TYPE_THING,
    coreType: "CoatyObject",
    description: "Thing PLC2",
};

const sensorPlc1Tag1: Sensor = {
    objectId: Runtime.newUuid(),
    parentObjectId: thingPlc1.objectId,
    coreType: "CoatyObject",
    objectType: SensorThingsTypes.OBJECT_TYPE_SENSOR,
    name: "S7-1500 PLC 1.Tag1",
    description: "S7-1500 PLC 1.Tag1",
    unitOfMeasurement: {
        name: "Unitless",
        symbol: "",
        definition: "http://www.qudt.org/qudt/owl/1.0.0/unit/Instances.html#Unitless",
    },
    observationType: ObservationTypes.MEASUREMENT,
    observedProperty: {
        name: "Tag1",
        description: "OPC UA Variable Tag1",
        definition: "",
    },
    encodingType: EncodingTypes.UNDEFINED,
    metadata: {},
};

const sensorPlc1FreeMemory: Sensor = {
    objectId: Runtime.newUuid(),
    parentObjectId: thingPlc1.objectId,
    coreType: "CoatyObject",
    objectType: SensorThingsTypes.OBJECT_TYPE_SENSOR,
    name: "S7-1500 PLC 1.FreeMemory",
    description: "S7-1500 PLC 1.FreeMemory",
    unitOfMeasurement: {
        name: "Megabyte",
        symbol: "MB",
        definition: "http://www.qudt.org/qudt/owl/1.0.0/unit/Instances.html#Byte",
    },
    observationType: ObservationTypes.MEASUREMENT,
    observedProperty: {
        name: "FreeMemory",
        description: "OPC UA Variable FreeMemory",
        definition: "",
    },
    encodingType: EncodingTypes.UNDEFINED,
    metadata: {},
};

const sensorPlc2Temperature: Sensor = {
    objectId: Runtime.newUuid(),
    parentObjectId: thingPlc2.objectId,
    coreType: "CoatyObject",
    objectType: SensorThingsTypes.OBJECT_TYPE_SENSOR,
    name: "S7-1500 PLC 2.Temperature",
    description: "S7-1500 PLC 2.Temperature",
    unitOfMeasurement: {
        name: "DegreeCelsius",
        symbol: "degC",
        definition: "http://www.qudt.org/qudt/owl/1.0.0/unit/Instances.html#DegreeCelsius",
    },
    observationType: ObservationTypes.MEASUREMENT,
    observedProperty: {
        name: "Temperature",
        description: "OPC UA Analog Item Temperature",
        definition: "",
    },
    encodingType: EncodingTypes.UNDEFINED,
    metadata: {},
};

const sensorDefinitions: SensorDefinition[] = [
    {
        io: OpcuaSensorIo,
        observationPublicationType: "none",
        sensor: sensorPlc1Tag1,
    },
    {
        io: OpcuaSensorIo,
        observationPublicationType: "none",
        sensor: sensorPlc1FreeMemory,
    },
    {
        io: OpcuaSensorIo,
        observationPublicationType: "none",
        sensor: sensorPlc2Temperature,
    },
];

const opcuaSensorOptions: OpcuaSensorOptions = {
    ...opcuaOptions,
    sensorIds: {
        "PLC1.Tag1": sensorPlc1Tag1.objectId,
        "PLC1.FreeMemory": sensorPlc1FreeMemory.objectId,
        "PLC2.Temperature": sensorPlc2Temperature.objectId,
    },
};

/* Options for OpcuaRemoteOperationController */

const opcuaRemoteOperationOptions: OpcuaRemoteOperationOptions = {
    ...opcuaOptions,
    calls: {
        PLC2: {
            "PLC2.AlertTemperature": {
                operation: "com.mydomain.alertTemperature",
                inputArguments: [
                    {
                        parameter: "temp",
                        dataType: "Double",
                    },
                    {
                        parameter: "isTooLow",
                        dataType: "Boolean",
                    },
                ],
            },
        },
    },
};

/* Producer agent components and configuration */

const components: Components = {
    controllers: {
        BasicIoRouter,
        OpcuaIoSourceController,
        OpcuaIoActorController,
        OpcuaMqttController,
        OpcuaSensorThingsController,
        OpcuaRemoteOperationController,
    },
};

const configuration: Configuration = {
    common: {
        agentInfo,
        associatedUser: user,
        associatedDevice: opcuaDev,
    },
    communication: {
        brokerUrl: "mqtt://localhost:1883",
        identity: { name: "Producer-Agent" },
        shouldAutoStart: true,
    },
    controllers: {
        BasicIoRouter: {
        },
        OpcuaIoSourceController: {
            opcuaIoSourceOptions,
        },
        OpcuaIoActorController: {
            opcuaIoActorOptions,
            objectDataSource: {
                browsePath: {
                    rootNode: "RootFolder",
                    relativePath: `/Objects/[${producerNamespaceUri}]:S7-1500 PLC 2`,
                },
            },
            methodDataSource: {
                browsePath: {
                    rootNode: "RootFolder",
                    relativePath: `/Objects/[${producerNamespaceUri}]:S7-1500 PLC 2.[${producerNamespaceUri}]:Beep`,
                },
            },

        },
        OpcuaMqttController: {
            opcuaMqttOptions,
        },
        OpcuaSensorThingsController: {
            things: [thingPlc1, thingPlc2],
            sensors: sensorDefinitions,
            opcuaSensorOptions,
        },
        OpcuaRemoteOperationController: {
            opcuaRemoteOperationOptions,
        },
    },
};

/* Producer agent start up */

const container = Container.resolve(components, configuration);

NodeUtils.logCommunicationState(container);
