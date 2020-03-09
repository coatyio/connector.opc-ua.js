/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import { Components, Configuration, Container, CoreTypes, IoActor, Runtime } from "@coaty/core";
import { NodeUtils } from "@coaty/core/runtime-node";

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
        agentIdentity: { name: "Consumer-Agent" },
        ioContextNodes: {
            "Producer-Consumer-Context": {
                ioActors: ioActors,
            },
        },
    },
    communication: {
        brokerUrl: "mqtt://localhost:1883",
        shouldAutoStart: true,
    },
};

/* Consumer agent start up */

const container = Container.resolve(components, configuration);

NodeUtils.logCommunicationState(container);
