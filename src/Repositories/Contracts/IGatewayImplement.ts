import { gatewaySearchInput, gatewaySession, gatewayInputOptions, gatewayRuleInput } from "../../Common/Metadata/gatewayLogicInputMetadata";
import { gatewaySearchFlightResult, searchCalendarResult } from "../../Common/Metadata/gatewaySearchResultMetadata";
import { gatewayBookInternalResult } from "../../Common/Metadata/gatewayBookResultMetadata";
import { gatewayTicketInternalResult } from "../../Common/Metadata/gatewayTicketResultMetadata";
import { gatewayRulesResult } from "../../Common/Metadata/gatewayRulesResultMetadata";

export interface IGatewayImplement {
  getSearch: (item: gatewaySearchInput, session?: gatewaySession, calendarResultNotRequired?: boolean, loggedInUser?: any, options?: gatewayInputOptions) => Promise<gatewaySearchFlightResult>;
  getSearchCalendar: (item: any, loggedInUser: any, options: gatewayInputOptions) => Promise<searchCalendarResult[]>;
  // getPing: () => Promise<string>;
  getFlightRules: (item: gatewayRuleInput, session?: gatewaySession, options?: gatewayInputOptions) => Promise<gatewayRulesResult[]>
  book: (booking: any, session?: gatewaySession, options?: gatewayInputOptions) => Promise<gatewayBookInternalResult>
  createTicket: (booking: any, session?: gatewaySession, options?: gatewayInputOptions) => Promise<gatewayTicketInternalResult>
  // importPNR: (pnr: string) => Promise<any> TODO
}
