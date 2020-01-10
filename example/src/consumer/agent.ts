/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import { CoreTypes, Device, DisplayType, IoActor, User } from "coaty/model";
import { Components, Configuration, Container, Runtime } from "coaty/runtime";
import { NodeUtils } from "coaty/runtime-node";

import { agentInfo } from "./agent.info";

import { IoActorConsumerController } from "./io-actor-consumer-controller";
import { MqttConsumerController } from "./mqtt-consumer-controller";
import { SensorThingsConsumerController } from "./sensor-things-consumer-controller";

/* For IO Routing: IO actors, associated device and user */

const ioActors: IoActor[] = [
    {
        name: "S7-1500 PLC 1.Tag1",
        objectId: Runtime.newUuid(),
        objectType: CoreTypes.OBJECT_TYPE_IO_ACTOR,
        coreType: "IoActor",
        valueType: "plc.Tag1[Int32]",
    },
    {
        name: "S7-1500 PLC 1.FreeMemory",
        objectId: Runtime.newUuid(),
        objectType: CoreTypes.OBJECT_TYPE_IO_ACTOR,
        coreType: "IoActor",
        valueType: "plc.FreeMemory[Double.MB]",
    },
    {
        name: "S7-1500 PLC 2.Temperature",
        objectId: Runtime.newUuid(),
        objectType: CoreTypes.OBJECT_TYPE_IO_ACTOR,
        coreType: "IoActor",
        valueType: "plc.Temperature[Double.DEGC]",
    },
];

const user: User = {
    objectId: "d8476053-fa52-4c3f-8a6c-40e4c2512ef1",
    coreType: "User",
    objectType: CoreTypes.OBJECT_TYPE_USER,
    name: "user@coaty.io",
    names: { formatted: "Common User for IO Routing" },
};

const consoleDev: Device = {
    objectId: Runtime.newUuid(),
    objectType: CoreTypes.OBJECT_TYPE_DEVICE,
    coreType: "Device",
    name: "Consumer Device",
    displayType: DisplayType.Monitor,
    ioCapabilities: ioActors,
    assigneeUserId: user.objectId,
};

/* Consumer agent components and configuration */

const components: Components = {
    controllers: {
        IoActorConsumerController,
        MqttConsumerController,
        SensorThingsConsumerController,
    },
};

const configuration: Configuration = {
    common: {
        agentInfo,
        associatedUser: user,
        associatedDevice: consoleDev,
    },
    communication: {
        brokerUrl: "mqtt://localhost:1883",
        identity: { name: "Consumer-Agent" },
        shouldAutoStart: true,
    },
};

/* Consumer agent start up */

const container = Container.resolve(components, configuration);

NodeUtils.logCommunicationState(container);
