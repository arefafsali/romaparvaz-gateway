import { gatewaySession, gatewaySessionList } from "./gatewayLogicInputMetadata";

// Search result in gateway controller
export class gatewaySearchFullResult {
  public result: gatewaySearchResult = new gatewaySearchResult();
  public session: gatewaySessionList = new gatewaySessionList();
}

// Search result returned by conroller
export class gatewaySearchResult {
  public flights: searchFlightResult[] = [];
  public calendar: searchCalendarResult[] = [];
  // Filter objects
  public airlines: searchAirlineResult[][] = [];
  public airports: searchAirportResult[][] = [];
  public gateways: searchGatewayResult[][]= [];
  public stopCount: searchStopCountResult[][] = [];
  public baggages: searchBaggageResult[][] = [];
  public cabins: searchCabinResult[][] = [];
  public charter: searchCharterResult[][] = [];
  public currency: string = "";
}

// Search result returned from each gateway manager to main manager
export class gatewaySearchFlightResult {
  public flights: searchFlightResult[] = [];
  public calendar: searchCalendarResult[] = [];
  public session: gatewaySession = null;
}

// Search result returned from multiple gateway manager to main manager
export class multipleGatewaySearchFlightResult {
  public flights: searchFlightResult[] = [];
  public calendar: searchCalendarResult[] = [];
  public sessionList: gatewaySessionList = new gatewaySessionList();
}

//#region Flight object metadatas
// Flight object in search result
export class searchFlightResult {
  public Currency: string;
  public ProviderType: string;
  public GatewayData: any = null;
  public SequenceNumber: string;
  public CombinationId: string;
  public ValidatingAirlineCode: string; // TODO: move this to itinerary
  public ForceETicket: string;
  public E_TicketEligibility: string;
  public ServiceFeeAmount: string;
  public TotalPrice: number = 0;
  public Derik: number = 0;
  public Commission: number = undefined;
  public FinalPrice:number = 0;
  // public Markup: number = 0;
  // public Basefare: number = 0;
  public AdultPrice: priceObject = new priceObject();
  public ChildPrice: priceObject = new priceObject();
  public InfantPrice: priceObject = new priceObject();
  public Itineraries: searchFlightItinerary[] = [];
}

export class searchFlightItinerary {
  public Gateway: {
    id: string;
    Code: string;
    Data: any;
  } = { id: "", Code: "", Data: null };
  public Price: itineraryPrice = null;
  public OriginalPrice: object = null;
  public RefNumber: string = "";
  public DirectionId: string = "";
  public ElapsedTime: string = "";
  public TotalStopTime: string = "0000";
  public StopCount: number = 0;
  public isCharter: boolean = false;
  public Flights: itineraryFlightSegment[] = [];
}

export class itineraryPrice {
  public TotalPrice: number = 0;
  public Derik: number = 0;
  public Commission: number = undefined;
  // public BaseFare: number = 0;
  // public Tax: number = 0;
  public AdultPrice: priceObject = new priceObject();
  public ChildPrice: priceObject = new priceObject();
  public InfantPrice: priceObject = new priceObject();
}

export class itineraryFlightSegment {
  public GatewayData: any = null;
  public DepartureDateTime: string;
  public ArrivalDateTime: string;
  public FlightNumber: string;
  public ResBookDesigCode: string;
  public FlightDuration: string;
  public DepartureAirport: itineraryFlightSegmentAirport = new itineraryFlightSegmentAirport();
  public ArrivalAirport: itineraryFlightSegmentAirport = new itineraryFlightSegmentAirport();
  public MarketingAirline: itineraryFlightSegmentAirline = new itineraryFlightSegmentAirline();
  public OperatingAirline: itineraryFlightSegmentAirline = new itineraryFlightSegmentAirline();
  public Equipment: {
    Name: nameObject;
    Code: string;
  } = { Code: "", Name: new nameObject() };
  public BookingClassAvails: itineraryFlightSEgmentCabin = new itineraryFlightSEgmentCabin(); // TODO: convert this type to array[];
  public Baggage: {
    Index: string;
    Quantity: string;
    Unit: string;
    Type: string;
  }[] = [];
  public StopLocation: {
    LocationCode: string;
    DepartureDateTime: string;
    ArrivalDateTime: string;
    Name: nameObject;
  }[] = [];
}

export class itineraryFlightSEgmentCabin {
  ResBookDesigCode: string = "";
  ResBookDesigQuantity: string = "";
  RPH: string = "";
  AvailablePTC: string = "";
  ResBookDesigCabinCode: string = "";
  ResBookDesigCabinName: nameObject = new nameObject();
  FareBasis: string = "";
  FareType: string = "";
}

export class itineraryFlightSegmentAirport {
  Code: string = "";
  CityCode: string = "";
  Name: nameObject = new nameObject();
  CityName: nameObject = new nameObject();
  Terminal: string = "";
}

export class itineraryFlightSegmentAirline {
  Code: string = "";
  Name: nameObject = new nameObject();
}
//#endregion

// Calendar object
export class searchCalendarResult {
  public Date: string[] = [];
  public Currency: string;
  public AdultPrice: number;
}

// Airline filter object
export class searchAirlineResult {
  public active: boolean;
  public code: string;
  public countryCode: string;
  public name: nameObject;
  public providerType: string;
  public minPrice: number;
}

// Airport filter object
export class searchAirportResult {
  public countryCode: string;
  public iata: string;
  public locationCode: string;
  public type: string;
  public country: any; // TODO: country object
  public location: any; // TODO: location object
  public name: nameObject;
  public isActive: boolean;
  public isUsedForStop: boolean = false;
  public isDepartureAirport: boolean = false;
  public isArrivalAirport: boolean = false;
}

// Gateway filter object
export class searchGatewayResult {
  public id: string;
  public Code: string;
  public Name: string;
}

// Stop count filter object
export class searchStopCountResult {
  public count: number;
  public minPrice: number;
}

// Baggage filter object
export class searchBaggageResult {
  public Index: string;
  public Quantity: string;
  public Unit: string;
  public Type: string;
  public minPrice: number;
}

// Cabin filter object
export class searchCabinResult {
  public name: nameObject;
  public code: string;
  public minPrice: number;
}
export class searchCharterResult {
  public isCharter: boolean;
  public minPrice: number;
}

export class nameObject {
  public en: string = "";
  public fa: string = "";
}

export class priceObject {
  public TotalPrice: number = 0;
  public BaseFare: number = 0;
  public Tax: number = 0;
  public Commission: number = 0;
  public TicketDesignators: {
    Code: string;
    Extension: string;
  }[] = [];
}
