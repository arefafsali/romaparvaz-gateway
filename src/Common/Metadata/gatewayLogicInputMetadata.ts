import { gateway } from "./gatewayMetadata";

export class gatewayLogicOutput {
  public body: any;
  public session: gatewaySession;
}

export class gatewaySignitureResult extends gateway {
  public signiture: any;
}

export class gatewaySearchInput {
  public adult: number = 0;
  public child: number = 0;
  public infant: number = 0;
  public citizen: number = 0;
  public student: number = 0;
  public cabin: string = null;
  public itineraries: gatewaySearchInputItinerary[] = [];
}

export class gatewaySearchInputItinerary {
  public origin: string;
  public isOriginLocation: boolean;
  public originCountryCode: string;
  public destination: string;
  public isDestinationLocation: boolean;
  public destinationCountryCode: string;
  public departDate: string;
}

export class gatewayInputOptions {
  public devMode?: boolean = false;
  public gatewayList?: string[] = [];
  public simpleResponse?: boolean = false; // deprecated
  public notApplyMarkup?: boolean = false;
  public disableSignOut?: boolean = false;
  public requestUUID?: string = "";
}

export class gatewaySessionList {
  public amadeus: amadeusSession;
  public mahan: mahanSession;
}

export class gatewaySession {
  sessionId: string = null;
  sessionTime: string = null;
  sessionDeleted?: boolean = false;
}

export class amadeusSession extends gatewaySession { }

export class amadeusGlobalSession extends gatewaySession {
  sequenceNumber: number = null;
  securityToken: string = null;
}

export class caspianSession extends gatewaySession { }

export class mahanSession extends gatewaySession {
  transactionId: string = null;
}

export class gatewayRuleInput {
  public providerType: string = "";
  public sequenceNumber: string;
  public combinationId: string;
  public itineraryFlights: { gatewayCode: any, gatewayData: any, airlineCode: string, resBookDesigCode: string }[] = []
  public gatewayData: any;
}