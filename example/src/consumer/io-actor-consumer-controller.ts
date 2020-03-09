/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import { filter } from "rxjs/operators";

import { IoActorController } from "@coaty/core/io-routing";
import { NodeUtils } from "@coaty/core/runtime-node";

/**
 * Consumes IO values published by an OPC UA connected producer agent and logs
 * them on the console.
 */
export class IoActorConsumerController extends IoActorController {

    onCommunicationManagerStarting() {
        super.onCommunicationManagerStarting();

        this.communicationManager.getIoNodeByContext("Producer-Consumer-Context").ioActors.forEach(actor => {
            this.observeIoValue<any>(actor)
                .pipe(filter(dataValue => dataValue !== undefined))
                .subscribe(dataValue => NodeUtils.logInfo(`IoActor ${actor.name} with value ${dataValue}`));
        });
    }

}
