import {
  gatewaySession,
  gatewaySessionList
} from "./gatewayLogicInputMetadata";

export class gatewayBookFinalResult {
  public result: gatewayBookData = new gatewayBookData();
  public session: gatewaySessionList = new gatewaySessionList();
}

export class gatewayBookData {
  public bookingId: string = "";
  public totalPrice: number = 0;
  public profileId: number = 0;
  public invoiceNo: string = "";
  public pnr: string[] = [];
  public userId: number = 0;
  public currencyId: string = "";
  // public token: string = "";
  // public merchantId: string = "";
}

export class gatewayBookInternalResult {
  public result: gatewayBookInternalData = new gatewayBookInternalData();
  public session: gatewaySession = new gatewaySession();
}

export class multipleGatewayBookInternalResult {
  public result: gatewayBookInternalData = new gatewayBookInternalData();
  public session: gatewaySessionList = new gatewaySessionList();
}

export class gatewayBookInternalData {
  public ticketTimeLimit: string = "";
  public ticketType: string[] = [];
  public pnr: string[] = [];
  public totalPrice: number = 0;
  public moneyUnit: string = "";
  public bookDate: string = "";
  public rawData: any[] = [];
  // public token: string = "";
  // public merchantId: string = "";
}
