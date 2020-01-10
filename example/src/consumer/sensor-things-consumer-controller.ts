/*! Copyright (c) 2020 Siemens AG. Licensed under the MIT License. */

import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { CallEvent } from "coaty/com";
import { NodeUtils } from "coaty/runtime-node";
import { ThingSensorObservationObserverController } from "coaty/sensor-things";

/**
 * Consumes SensorThings observations published by an OPC UA connected producer
 * agent and logs them on the console. if a temperature observation is out of
 * normal operating range, publishes an "alertTemperature" remote operation call
 * and logs its result on the console.
 */
export class SensorThingsConsumerController extends ThingSensorObservationObserverController {

    private _stopped$ = new Subject();

    onCommunicationManagerStarting() {
        super.onCommunicationManagerStarting();

        // Observe incoming sensor measurements.
        this.observeObservations();
    }

    onCommunicationManagerStopping() {
        super.onCommunicationManagerStopping();
        this._stopped$.next();
        this._stopped$.complete();
    }

    observeObservations() {
        // Monitor incoming sensor observations.
        this.sensorObservation$
            .pipe(
                takeUntil(this._stopped$),
            )
            .subscribe(({ obs, sensor }) => {
                NodeUtils.logInfo(`Sensor observation for ${sensor.name}: result=${obs.result} time=${obs.phenomenonTime}`);

                // Publish an "alertTemperature" remote operation call if a
                // temperature observation is out of normal operating range.
                if (sensor.name === "S7-1500 PLC 2.Temperature") {
                    const isTooLow = obs.result < 35.5;
                    const isTooHigh = obs.result > 38.5;
                    if (isTooLow || isTooHigh) {
                        this.communicationManager.publishCall(
                            CallEvent.with(
                                this.identity,
                                "com.mydomain.alertTemperature",
                                { temp: obs.result, isTooLow }))
                            .pipe(
                                takeUntil(this._stopped$),
                            )
                            .subscribe(returnEvent => {
                                if (returnEvent.eventData.isError) {
                                    // tslint:disable-next-line: max-line-length
                                    NodeUtils.logInfo(`Remote operation "alertTemperature" returned error: ${returnEvent.eventData.error.message}`);
                                } else {
                                    // tslint:disable-next-line: max-line-length
                                    NodeUtils.logInfo(`Remote operation "alertTemperature" returned confirmation: ${returnEvent.eventData.result}`);
                                }
                            });
                    }
                }
            });
    }

}
