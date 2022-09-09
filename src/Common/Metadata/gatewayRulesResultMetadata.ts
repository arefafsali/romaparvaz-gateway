export class gatewayRulesResult {
  public cancelingRule: CancelingRule[] = [];
  public cancelingRuleText: string = "";
  public flightRule: any = null;
}

export class CancelingRule {
  public priceRange: { maxPrice: number, minPrice: number };
  public dayBefore: number;
  public hourBefore: number;
  public minutesBefore: number;
  public isExactTime: boolean;
  public penalty: number;
}