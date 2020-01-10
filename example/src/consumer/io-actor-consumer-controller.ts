/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import { filter } from "rxjs/operators";

import { IoActorController } from "coaty/io";
import { CoreTypes, IoActor } from "coaty/model";
import { NodeUtils } from "coaty/runtime-node";

/**
 * Consumes IO values published by an OPC UA connected producer agent and logs
 * them on the console.
 */
export class IoActorConsumerController extends IoActorController {

    onCommunicationManagerStarting() {
        super.onCommunicationManagerStarting();

        this.runtime.options.associatedDevice.ioCapabilities.forEach(io => {
            if (io.objectType === CoreTypes.OBJECT_TYPE_IO_ACTOR) {
                this.observeIoValue<any>(io as IoActor)
                    .pipe(filter(dataValue => dataValue !== undefined))
                    .subscribe(dataValue => NodeUtils.logInfo(`IoActor ${io.name} with value ${dataValue}`));
            }
        });
    }

}
