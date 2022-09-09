import { timezones } from "./IataCodeTimezones"
import * as moment from "moment-timezone";
export class IataTimezonesHelper {
    private datetime1: any;
    private timezone1: string = "";
    private datetime2: any;
    private timezone2: string = "";
    constructor() {

    }
    public setFromTimezone(iata: string) {
        if (timezones.some(tz => tz.code == iata))
            this.timezone1 = timezones.find(tz => tz.code == iata).timezone;

        return this;
    }
    public setToTimezone(iata: string) {
        if (timezones.some(tz => tz.code == iata))
            this.timezone2 = timezones.find(tz => tz.code == iata).timezone;

        return this;
    }
    public setFromDateTime(datetime: string) {
        this.datetime1 = moment.tz(datetime, this.timezone1);

        return this;
    }
    public setToDateTime(datetime: string) {
        this.datetime2 = moment.tz(datetime, this.timezone2);

        return this;
    }
    public setFromDateTimeWithTimezone(datetime: string, iata: string) {
        if (timezones.some(tz => tz.code == iata))
            this.timezone1 = timezones.find(tz => tz.code == iata).timezone;
        this.datetime1 = moment.tz(datetime, this.timezone1);

        return this;
    }
    public setToDateTimeWithTimezone(datetime: string, iata: string) {
        if (timezones.some(tz => tz.code == iata))
            this.timezone2 = timezones.find(tz => tz.code == iata).timezone;
        this.datetime2 = moment.tz(datetime, this.timezone2);
        return this;
    }
    public calculateTimeDiff() {
        return this.datetime2.diff(this.datetime1);
    }
    public calculateTimeDiffPretty() {
        let diff = this.datetime2.diff(this.datetime1, 'hours', true);
        return parseInt(diff).toString() + ":" + (diff * 60 % 60).toString();
    }
}