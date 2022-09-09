import {
  gatewaySession,
  gatewaySessionList
} from "./gatewayLogicInputMetadata";

export class gatewayTicketFinalResult {
  public result: gatewayTicketData = new gatewayTicketData();
  public session: gatewaySessionList = new gatewaySessionList();
}

export class gatewayTicketData {
  public callSupport: boolean = false;
  public bookingId: string = "";
  public moneyUnit: object = null;
  public invoiceNo: string = "";
  public pnr: string = "";
}

export class gatewayTicketInternalResult {
  public result: gatewayTicketInternalData = new gatewayTicketInternalData();
  public session: gatewaySession = new gatewaySession();
}

export class multipleGatewayTicketInternalResult {
  public result: gatewayTicketInternalData = new gatewayTicketInternalData();
  public session: gatewaySessionList = new gatewaySessionList();
}

export class gatewayTicketInternalData {
  public callSupport: boolean = false;
  public tickets: gatewayTicket[] = [];
  public data: any = null;
}

export class gatewayTicket {
  public passengerIndex: number = 0;
  public flightIndex: number = 0;
  public refrenceId: string = "";
  public ticketNumber: string = "";
  public status: any[] = [];
  public pnr: string = "";
  public cancelReason: string = "";
  public showTicketType: object = null;
  public callSupport: boolean = false;
}