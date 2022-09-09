import { gatewaySearchInput, gatewaySession, gatewayInputOptions, gatewayRuleInput } from "./gatewayLogicInputMetadata";
import { gatewaySearchFlightResult, searchCalendarResult } from "./gatewaySearchResultMetadata";
import { gatewayBookInternalResult } from "./gatewayBookResultMetadata";
import { gatewayRulesResult } from "./gatewayRulesResultMetadata";
import { gatewayTicketInternalResult } from "./gatewayTicketResultMetadata";
import { logHelper } from "../../Repositories/Utility/logHelper";
import { ExternalRequest } from "../../Infrastructure/ExternalRequests";

export class gatewayMethods {
  public search: (sign: any, searchObj: gatewaySearchInput, session: gatewaySession, loggedInUser: any, options: gatewayInputOptions, exchangeRate: number) => Promise<gatewaySearchFlightResult>;
  public searchCalendar: (sign: any, searchObj: gatewaySearchInput, loggedInUser: any, options: gatewayInputOptions, exchangeRate: number) => Promise<searchCalendarResult[]>;
  public getRules: (sign: any, flightInfo: gatewayRuleInput, session: gatewaySession, options: gatewayInputOptions, exchangeRate: number) => Promise<gatewayRulesResult[]>;
  public book: (sign: any, flightBooking: any, session: gatewaySession, options: gatewayInputOptions, exchangeRate: number) => Promise<gatewayBookInternalResult>;
  public createTicket: (sign: any, flightBooking: any, session: gatewaySession, options: gatewayInputOptions, exchangeRate: number) => Promise<gatewayTicketInternalResult>;
  public importPNR: (sign: any, pnr: string, pnrFields: any, options: gatewayInputOptions, exchangeRate: number) => Promise<any>;
}
export const generateDynamicGatewayFunctions = (manager: any, gatewayCode: string, searchTimeout: number): gatewayMethods => {
  return {
    search: (signitureData: any, searchObj: gatewaySearchInput, session: gatewaySession, loggedInUser: any, options: gatewayInputOptions, exchangeRate: number) => {
      return new Promise((resolve, reject) => {
        // console.log("Seach: ", gatewayCode)
        let t = setTimeout(() => {
          logHelper.logGatewayTimeout(gatewayCode, options.requestUUID)
          console.log("gatewayCode Timeout", gatewayCode)
          resolve(new gatewaySearchFlightResult());
        }, searchTimeout);
        let _manager = new manager(signitureData, gatewayCode);
        _manager.getSearch(searchObj, session, true, loggedInUser, options)
          .then(result => {
            // console.log("Resolve Seach: ", gatewayCode)
        
            clearTimeout(t);
            resolve(result);
          })
          .catch(err => {
            // console.log("Catch Seach: ", gatewayCode)
            logHelper.logGatewayError(gatewayCode, options.requestUUID, err)
            clearTimeout(t);
            reject(err);
          });
      })
    },
    searchCalendar: (signitureData: any, searchObj: gatewaySearchInput, loggedInUser: any, options: gatewayInputOptions, exchangeRate: number) => {
      return new Promise((resolve, reject) => {
        let t = setTimeout(() => {
          logHelper.logGatewayTimeout(gatewayCode, options.requestUUID)
          resolve([]);
        }, searchTimeout);
        let _manager = new manager(signitureData, gatewayCode);
        _manager.getSearchCalendar(searchObj, loggedInUser, options)
          .then(result => {
            clearTimeout(t);
            resolve(result);
          })
          .catch(err => {
            logHelper.logGatewayError(gatewayCode, options.requestUUID, err)
            clearTimeout(t);
            reject(err);
          });
      })
    },
    getRules: (signitureData: any, flightInfo: gatewayRuleInput, session: gatewaySession, options: gatewayInputOptions, exchangeRate: number) => {
      return new Promise<gatewayRulesResult[]>((resolve, reject) => {
        let _manager = new manager(signitureData, gatewayCode);
        _manager.getFlightRules(flightInfo, session, options)
          .then(result => resolve(result))
          .catch(err => {
            logHelper.logGatewayError(gatewayCode, options.requestUUID, err)
            reject(err);
          })
      })
    },
    book: (signitureData: any, flightBooking: any, amadeusSession: gatewaySession, options: gatewayInputOptions, exchangeRate: number) => {
      return new Promise<gatewayBookInternalResult>((resolve, reject) => {
        let _manager = new manager(signitureData, gatewayCode);
        _manager.book(flightBooking, amadeusSession, options)
          .then(result => resolve(result))
          .catch(err => {
            logHelper.logGatewayError(gatewayCode, options.requestUUID, err)
            reject(err);
          })
      });
    },
    createTicket: (signitureData: any, flightBooking: any, amadeusSession: gatewaySession, options: gatewayInputOptions, exchangeRate: number) => {
      return new Promise<gatewayTicketInternalResult>((resolve, reject) => {
        let _manager = new manager(signitureData, gatewayCode);
        _manager.createTicket(flightBooking, amadeusSession, options)
          .then(result => resolve(result))
          .catch(err => {
            logHelper.logGatewayError(gatewayCode, options.requestUUID, err)
            reject(err);
          })
      });
    },
    importPNR: (signitureData: any, pnr: string, pnrFields: any, options: gatewayInputOptions, exchangeRate: number) => {
      return new Promise<any>((resolve, reject) => {
        let _manager = new manager(signitureData, gatewayCode);
        _manager.importPNR(pnr, pnrFields, options)
          .then(result => resolve(result))
          .catch(err => {
            logHelper.logGatewayError(gatewayCode, options.requestUUID, err)
            reject(err);
          })
      });
    }
  }
}

export const generateDynamicGatewayFunctionsRemote = (URL: string, gatewayCode: string, searchTimeout: number): gatewayMethods => {
  return {
    search: (signitureData: any, searchObj: gatewaySearchInput, session: gatewaySession, loggedInUser: any, options: gatewayInputOptions, exchangeRate: number) => {
      return new Promise((resolve, reject) => {
        let t = setTimeout(() => {
          logHelper.logGatewayTimeout(gatewayCode, options.requestUUID)
          resolve(new gatewaySearchFlightResult());
        }, searchTimeout);
        ExternalRequest.syncPostRequest(URL + "search", undefined, {
          signitureData,
          gatewayCode,
          searchObj,
          session,
          loggedInUser,
          options,
          exchangeRate
        }, undefined, 'POST', undefined, undefined, { "internalauth": process.env.INTERNAL_SECRET })
          .then((result: any) => {
            clearTimeout(t);
            resolve(result);
          })
          .catch(err => {
            clearTimeout(t);
            reject(err);
          })
      })
    },
    searchCalendar: (signitureData: any, searchObj: gatewaySearchInput, loggedInUser: any, options: gatewayInputOptions, exchangeRate: number) => {
      return new Promise((resolve, reject) => {
        let t = setTimeout(() => {
          logHelper.logGatewayTimeout(gatewayCode, options.requestUUID)
          resolve([]);
        }, searchTimeout);
        ExternalRequest.syncPostRequest(URL + "search_calendar", undefined, {
          signitureData,
          gatewayCode,
          searchObj,
          loggedInUser,
          options,
          exchangeRate
        }, undefined, 'POST', undefined, undefined, { "internalauth": process.env.INTERNAL_SECRET })
          .then((result: any) => {
            clearTimeout(t);
            resolve(result);
          })
          .catch(err => {
            clearTimeout(t);
            reject(err);
          })
      })
    },
    getRules: (signitureData: any, flightInfo: gatewayRuleInput, session: gatewaySession, options: gatewayInputOptions, exchangeRate: number) => {
      return new Promise<gatewayRulesResult[]>((resolve, reject) => {
        ExternalRequest.syncPostRequest(URL + "rules", undefined, {
          signitureData,
          gatewayCode,
          flightInfo,
          session,
          options,
          exchangeRate
        }, undefined, 'POST', undefined, undefined, { "internalauth": process.env.INTERNAL_SECRET })
          .then((result: any) => resolve(result))
          .catch(err => reject(err))
      })
    },
    book: (signitureData: any, flightBooking: any, session: gatewaySession, options: gatewayInputOptions, exchangeRate: number) => {
      return new Promise<gatewayBookInternalResult>((resolve, reject) => {
        ExternalRequest.syncPostRequest(URL + "book", undefined, {
          signitureData,
          gatewayCode,
          flightBooking,
          session,
          options,
          exchangeRate
        }, undefined, 'POST', undefined, undefined, { "internalauth": process.env.INTERNAL_SECRET })
          .then((result: any) => resolve(result))
          .catch(err => reject(err))
      });
    },
    createTicket: (signitureData: any, flightBooking: any, session: gatewaySession, options: gatewayInputOptions, exchangeRate: number) => {
      return new Promise<gatewayTicketInternalResult>((resolve, reject) => {
        ExternalRequest.syncPostRequest(URL + "ticket", undefined, {
          signitureData,
          gatewayCode,
          flightBooking,
          session,
          options,
          exchangeRate
        }, undefined, 'POST', undefined, undefined, { "internalauth": process.env.INTERNAL_SECRET })
          .then((result: any) => resolve(result))
          .catch(err => reject(err))
      });
    },
    importPNR: (signitureData: any, pnr: string, pnrFields: any, options: gatewayInputOptions, exchangeRate: number) => {
      return new Promise<any>((resolve, reject) => {
        ExternalRequest.syncPostRequest(URL + "import_pnr", undefined, {
          signitureData,
          gatewayCode,
          pnr,
          pnrFields,
          options,
          exchangeRate
        }, undefined, 'POST', undefined, undefined, { "internalauth": process.env.INTERNAL_SECRET })
          .then((result: any) => resolve(result))
          .catch(err => reject(err))
      });
    }
  }
}