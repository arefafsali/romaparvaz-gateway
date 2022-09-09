export class searchFlight {
  constructor() {}
  public PricingSourceType: number = 0;
  public RequestOption: number = 3;
  public SessionId: string = "";
  public AdultCount: number = 1;
  public ChildCount: number = 0;
  public InfantCount: number = 0;
  public TravelPreference: object = {
    CabinType: 1,
    MaxStopsQuantity: 0,
    AirTripType: 1
  };
  public OriginDestinationInformations: object[] = [
    {
      DepartureDateTime: "2019-01-08T00:00:00",
      DestinationLocationCode: "AMS",
      DestinationType: 2,
      OriginLocationCode: "LON",
      OriginType: 2
    }
  ];
}
