import { BaseFlight } from "./BaseFlight";

export class AvailabilityList extends BaseFlight {
    constructor() { super() }

    public Depart: string = "";
    public Arrive: string = "";
    public DepartDate: string = "";
    public DepartTime: string = "";
    public ArriveDate: string = "";
    public ArriveTime: string = "";
    public AC: string = "";
    public FltNo: string = "";
    public ClassType: string = "";
    public ClassName: string = "";
    public Capacity: string = "";
    public Price: string = "";
    public PriceCHD: string = "";
    public PriceINF: string = "";
    public DateFlight: string = "";
}