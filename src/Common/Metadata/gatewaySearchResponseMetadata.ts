export class gatewaySearchResponse {
  constructor() {}
  public Currency: string = "";
  public ProviderType: string = "";
  public SequenceNumber: string = "";
  public TotalPrice: number = 0;
  public AdultPrice: number = 0;
  public ChildPrice: number = 0;
  public InfantPrice: number = 0;
  public RefNumber: string = "";
  public DirectionId: number = 0;
  public ElapsedTime: string = "";
  public Flights: flightResponse[] = [];
}

export class flightResponse {
  public DepartureDateTime: string = "";
  public ArrivalDateTime: string = "";
  public FlightNumber: string = "";
  public IsCharter: boolean = false;
  public DepartureAirport: object = {
    LocationCode: "",
    Terminal: ""
  };
  public ArrivalAirport: object = {
    LocationCode: "",
    Terminal: ""
  };
  public OperatingAirline: object = {
    Code: ""
  };
  public Equipment: object = {
    AirEquipType: ""
  };
  public BookingClassAvails: object = {
    ResBookDesigCode: "",
    ResBookDesigQuantity: 0,
    RPH: "",
    AvailablePTC: "",
    ResBookDesigCabinCode: "",
    FareBasis: "",
    FareType: ""
  };
}
