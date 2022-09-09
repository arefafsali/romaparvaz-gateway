import { BaseFlight } from "./BaseFlight";

export class AvailablitiFlight extends BaseFlight {
    constructor() {
        super();
    }
    public cbSource: string = "";
    public cbTarget: string = "";
    public cbDay1: string = "";
    public cbMonth1: string = "";
    public cbAdultQty: string = "";
    public cbChildQty: string = "";
    public cbInfantQty: string = "";
    public Success: boolean = false;
    public Error: string = "";
}