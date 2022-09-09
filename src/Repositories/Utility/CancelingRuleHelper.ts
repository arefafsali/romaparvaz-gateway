import { CancelingRule } from "../../Common/Metadata/gatewayRulesResultMetadata";
import { ExternalRequest } from "../../Infrastructure/ExternalRequests";

export class CancelingRuleHelper {
  public static getCancelingRule(airlineCode: string, resBookDesigCode: string) {
    return new Promise<CancelingRule[]>((resolve, reject) => {
      let result: CancelingRule[] = [];
      ExternalRequest.syncGetRequest(process.env.MAIN_URL + `canceling_rule/airline_res_book_code/${airlineCode}/${resBookDesigCode ? resBookDesigCode : 'null'}`, undefined)
        .then((cancelingRuleResult: any) => {
          result = cancelingRuleResult.payload.data.map(el => {
            return {
              priceRange: el.priceRange,
              dayBefore: el.dayBefore,
              hourBefore: el.hourBefore,
              minutesBefore: el.minutesBefore,
              isExactTime: el.isExactTime,
              penalty: el.penalty
            }
          })
          resolve(result);
        })
        .catch(err => reject(err))
    })
  }
}