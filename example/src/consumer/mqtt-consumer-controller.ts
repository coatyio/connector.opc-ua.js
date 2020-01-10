/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import { Controller } from "coaty/controller";
import { NodeUtils } from "coaty/runtime-node";

import { filter } from "rxjs/operators";

/**
 * Consumes raw MQTT messages published by an OPC UA connected producer agent
 * and logs them on the console.
 */
export class MqttConsumerController extends Controller {

    onCommunicationManagerStarting() {
        super.onCommunicationManagerStarting();

        this.communicationManager.observeRaw(this.identity, "opcua/#")
            .pipe(filter(([topic]) => topic.startsWith("opcua/")))
            .subscribe(([topic, payload]) =>
                NodeUtils.logInfo(`Raw MQTT topic ${topic} with payload ${JSON.parse(payload.toString())}`));
    }

}
