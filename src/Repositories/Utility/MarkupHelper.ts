import { ExternalRequest } from "../../Infrastructure/ExternalRequests";
import { GatewaysManager } from "../../Logic/Managers/GatewaysManager";
import { gateway } from "../../Common/Metadata/gatewayMetadata";
import { gatewaySearchFlightResult, searchCalendarResult } from "../../Common/Metadata/gatewaySearchResultMetadata";
import { gatewaySearchInput, gatewayInputOptions } from "../../Common/Metadata/gatewayLogicInputMetadata";

export class MarkupHelper {
  public static calculateMarkup(loggedInUser: any, gatewayCode: string, item: gatewaySearchInput, result: gatewaySearchFlightResult, options: gatewayInputOptions) {
    // use item only for passenger count
    return new Promise<gatewaySearchFlightResult>((resolve, reject) => {
      const isInternational = item.itineraries.filter(itn => itn.originCountryCode != itn.destinationCountryCode).length > 0 ? true : false;
      new GatewaysManager().getByCode(gatewayCode)
        .then((gwy_result: gateway) => {
          let airlineCodes = [];
          result.flights.forEach(_flg => {
            _flg.Itineraries.forEach(_itin => {
              _itin.Flights.forEach(_itinFlg => {
                airlineCodes.push(_itinFlg.MarketingAirline.Code);
                // airlineCodes.push(_itinFlg.OperatingAirline.Code);
              })
            })
          });
          airlineCodes = [...new Set(airlineCodes)];
          ExternalRequest.syncGetRequest(process.env.MAIN_URL + "profile/id/" + ((loggedInUser && loggedInUser.activeProfileId) ? loggedInUser.activeProfileId.toString() : "0"), undefined)
            .then((profileResult: any) => {
              ExternalRequest.syncPostRequest(
                process.env.MAIN_URL + "markup/get_markup", undefined,
                {
                  "sellerProfileId": 240,
                  "buyerProfileId": (loggedInUser && loggedInUser.activeProfileId) ? loggedInUser.activeProfileId : 0,
                  "gatewayId": gwy_result._id,
                  "airlineCodes": airlineCodes,
                  // "commissionTypeCode": 3,
                  // "currencyId": ""
                }, undefined, 'POST', undefined, undefined, undefined)
                .then((markupResult: any) => {
                  // if(gatewayCode === "mahan")
                  // console.log("MAHANNNNNNN MARK",JSON.stringify(markupResult))
                  result.flights.forEach(_flg => {
                    let markup = markupResult.payload.data.find(_markup => _markup.airlineCode == _flg.Itineraries[0].Flights[0].MarketingAirline.Code).markup;
                    if (markup) markup.value = isInternational ? markup.international : markup.domestic;
                    let counterCommission = markupResult.payload.data.find(_markup => _markup.airlineCode == _flg.Itineraries[0].Flights[0].MarketingAirline.Code).counterCommission;
                    if (counterCommission) counterCommission.value = isInternational ? counterCommission.international : counterCommission.domestic;
                    let commission = markupResult.payload.data.find(_markup => _markup.airlineCode == _flg.Itineraries[0].Flights[0].MarketingAirline.Code).commission;
                    if (commission) commission.value = isInternational ? commission.international : commission.domestic;
                    // if (profileResult.status === 200 && profileResult.payload.data[0] && profileResult.payload.data[0].profileTypeId == 58) {
                    _flg.Derik = this.calculateMarkupOrCommissionValue(_flg.AdultPrice.BaseFare, '', counterCommission, 1) * item.adult;
                    _flg.Derik += this.calculateMarkupOrCommissionValue(_flg.ChildPrice.BaseFare, '', counterCommission, 1) * item.child;
                    _flg.Derik += this.calculateMarkupOrCommissionValue(_flg.InfantPrice.BaseFare, '', counterCommission, 1) * item.infant;
                    _flg.Derik = Math.abs(_flg.Derik) / parseInt(process.env.DERIK_VALUE);
                    if (commission) {
                      _flg.Commission = this.calculateMarkupOrCommissionValue(_flg.AdultPrice.BaseFare, '', commission, 1) * item.adult;
                      _flg.AdultPrice.Commission = this.calculateMarkupOrCommissionValue(_flg.AdultPrice.BaseFare, '', commission, 1);
                      _flg.Commission += this.calculateMarkupOrCommissionValue(_flg.ChildPrice.BaseFare, '', commission, 1) * item.child;
                      _flg.ChildPrice.Commission = this.calculateMarkupOrCommissionValue(_flg.ChildPrice.BaseFare, '', commission, 1);
                      _flg.Commission += this.calculateMarkupOrCommissionValue(_flg.InfantPrice.BaseFare, '', commission, 1) * item.infant;
                      _flg.InfantPrice.Commission = this.calculateMarkupOrCommissionValue(_flg.InfantPrice.BaseFare, '', commission, 1);
                    }
                    else
                      _flg.Commission = 0;
                    // RETURN PRICE WITHOUT AGENCY COMMISSION
                    // }
                    // else if (counterCommission && counterCommission.value) {
                    //   _flg.Derik = this.calculateMarkupOrCommissionValue(_flg.AdultPrice.BaseFare, '', counterCommission, 1) * item.adult;
                    //   _flg.Derik += this.calculateMarkupOrCommissionValue(_flg.ChildPrice.BaseFare, '', counterCommission, 1) * item.child;
                    //   _flg.Derik += this.calculateMarkupOrCommissionValue(_flg.InfantPrice.BaseFare, '', counterCommission, 1) * item.infant;
                    //   _flg.Derik = Math.abs(_flg.Derik) / parseInt(process.env.DERIK_VALUE);
                    // }
                    if (markup && markup.value && !(options.devMode && options.notApplyMarkup)) {
                      this.updatePriceObject(_flg.AdultPrice, '', markup);
                      this.updatePriceObject(_flg.ChildPrice, '', markup);
                      this.updatePriceObject(_flg.InfantPrice, '', markup);
                      _flg.TotalPrice = (item.adult * _flg.AdultPrice.TotalPrice + item.child * _flg.ChildPrice.TotalPrice + item.infant * _flg.InfantPrice.TotalPrice);
                    }
                  })
                  resolve(result);
                })
                .catch(err => reject(err))
            })
            .catch(err => reject(err))
        })
        .catch(err => reject(err))
    });
  }

  public static calculatePaymentTotalPrice(booking: any) {
    return new Promise<number>((resolve, reject) => {
      let pureTotalPrice = booking.totalPrice;
      let totalPassengerCount = booking.flights.adultCount + booking.flights.childCount + booking.flights.infantCount;
      if (booking.flights.providerType == "MultipleProviders") {
        let resultCount = 0;
        booking.flights.itineraries.forEach(el => {
          let airlineCodes = [];
          el.flights.forEach(flg => airlineCodes.push(flg.marketingAirline.code));
          airlineCodes = [...new Set(airlineCodes)];
          ExternalRequest.syncPostRequest(
            process.env.MAIN_URL + "markup/get_markup", undefined,
            {
              "sellerProfileId": 240,
              "buyerProfileId": (booking.onBehalfProfile && booking.onBehalfProfile.id) ? booking.onBehalfProfile.id : booking.individualProfile.id,
              "gatewayId": el.gateway.id,
              "airlineCodes": airlineCodes,
              // "commissionTypeCode": 3,
              // "currencyId": ""
            }, undefined, 'POST', undefined, undefined, undefined)
            .then((markupResult: any) => {
              let markup = markupResult.payload.data.find(_markup => _markup.airlineCode == el.flights[0].marketingAirline.code).markup;
              if (markup) markup.value = booking.flights.isInternational ? markup.international : markup.domestic;
              let counterCommission = markupResult.payload.data.find(_markup => _markup.airlineCode == el.flights[0].marketingAirline.code).counterCommission;
              if (counterCommission) counterCommission.value = booking.flights.isInternational ? counterCommission.international : counterCommission.domestic;
              let commission = markupResult.payload.data.find(_markup => _markup.airlineCode == el.flights[0].marketingAirline.code).commission;
              if (commission) commission.value = booking.flights.isInternational ? commission.international : commission.domestic;
              let totalBaseFare = el.price.adultPrice.baseFare * booking.flights.adultCount
                + el.price.childPrice.baseFare * booking.flights.childCount
                + el.price.infantPrice.baseFare * booking.flights.infantCount;
              let markupFreeBaseFare = this.calculateMarkupFreePrice(totalBaseFare, '', markup, totalPassengerCount);
              if (booking.onBehalfProfile && booking.onBehalfProfile.profileTypeId == 58) {
                pureTotalPrice -= this.calculateMarkupOrCommissionValue(markupFreeBaseFare, '', commission, totalPassengerCount);
              }
              if (++resultCount == booking.flights.itineraries.length) {
                resolve(pureTotalPrice);
              }
            })
            .catch(err => reject(err))
        })
      }
      else {
        let airlineCodes = [];
        booking.flights.itineraries.forEach(itin => itin.flights.forEach(flg => airlineCodes.push(flg.marketingAirline.code)));
        airlineCodes = [...new Set(airlineCodes)];
        ExternalRequest.syncPostRequest(
          process.env.MAIN_URL + "markup/get_markup", undefined,
          {
            "sellerProfileId": 240,
            "buyerProfileId": (booking.onBehalfProfile && booking.onBehalfProfile.id) ? booking.onBehalfProfile.id : booking.individualProfile.id,
            "gatewayId": booking.gateways[0].id,
            "airlineCodes": airlineCodes,
            // "commissionTypeCode": 3,
            // "currencyId": ""
          }, undefined, 'POST', undefined, undefined, undefined)
          .then((markupResult: any) => {
            let markup = markupResult.payload.data.find(_markup => _markup.airlineCode == booking.flights.itineraries[0].flights[0].marketingAirline.code).markup;
            if (markup) markup.value = booking.flights.isInternational ? markup.international : markup.domestic;
            let counterCommission = markupResult.payload.data.find(_markup => _markup.airlineCode == booking.flights.itineraries[0].flights[0].marketingAirline.code).counterCommission;
            if (counterCommission) counterCommission.value = booking.flights.isInternational ? counterCommission.international : counterCommission.domestic;
            let commission = markupResult.payload.data.find(_markup => _markup.airlineCode == booking.flights.itineraries[0].flights[0].marketingAirline.code).commission;
            if (commission) commission.value = booking.flights.isInternational ? commission.international : commission.domestic;
            let totalBaseFare = (booking.flights.adultCount > 0 ? booking.passengers.find(el => el.type == "adult").price.baseFare * booking.flights.adultCount : 0)
              + (booking.flights.childCount > 0 ? booking.passengers.find(el => el.type == "child").price.baseFare * booking.flights.childCount : 0)
              + (booking.flights.infantCount > 0 ? booking.passengers.find(el => el.type == "infant").price.baseFare * booking.flights.infantCount : 0);
            let markupFreeBaseFare = this.calculateMarkupFreePrice(totalBaseFare, '', markup, totalPassengerCount);
            if (booking.onBehalfProfile && booking.onBehalfProfile.profileTypeId == 58) {
              pureTotalPrice -= this.calculateMarkupOrCommissionValue(markupFreeBaseFare, '', commission, totalPassengerCount);
            }
            resolve(pureTotalPrice);
          })
          .catch(err => reject(err))
      }
    })
  }

  public static calculateMSPS(booking: any) {
    return new Promise((resolve, reject) => {
      let mspsResult = [];
      let totalPassengerCount = booking.flights.adultCount + booking.flights.childCount + booking.flights.infantCount;
      if (booking.flights.providerType == "MultipleProviders") {
        let cumulativeCommissionValue = 0;
        let cumulativeCounterCommissionValue = 0;
        let cumulativeOwnerCommissionValue = 0;
        let resultCount = 0;
        booking.flights.itineraries.forEach((el, ind) => {
          let airlineCodes = [];
          el.flights.forEach(flg => airlineCodes.push(flg.marketingAirline.code));
          airlineCodes = [...new Set(airlineCodes)];
          ExternalRequest.syncPostRequest(
            process.env.MAIN_URL + "markup/get_markup", undefined,
            {
              "sellerProfileId": 240,
              "buyerProfileId": (booking.onBehalfProfile && booking.onBehalfProfile.id) ? booking.onBehalfProfile.id : booking.individualProfile.id,
              "gatewayId": el.gateway.id,
              "airlineCodes": airlineCodes,
              // "commissionTypeCode": 3,
              // "currencyId": ""
            }, undefined, 'POST', undefined, undefined, undefined)
            .then((markupResult: any) => {
              let markup = markupResult.payload.data.find(_markup => _markup.airlineCode == el.flights[0].marketingAirline.code).markup;
              if (markup) markup.value = booking.flights.isInternational ? markup.international : markup.domestic;
              let commission = markupResult.payload.data.find(_markup => _markup.airlineCode == el.flights[0].marketingAirline.code).commission;
              if (commission) commission.value = booking.flights.isInternational ? commission.international : commission.domestic;
              let donyaroCommission = markupResult.payload.data.find(_markup => _markup.airlineCode == el.flights[0].marketingAirline.code).donyaroCommission;
              if (donyaroCommission) donyaroCommission.value = booking.flights.isInternational ? donyaroCommission.international : donyaroCommission.domestic;
              let ownerCommission = markupResult.payload.data.find(_markup => _markup.airlineCode == el.flights[0].marketingAirline.code).ownerCommission;
              if (ownerCommission) ownerCommission.value = booking.flights.isInternational ? ownerCommission.international : ownerCommission.domestic;
              let counterCommission = markupResult.payload.data.find(_markup => _markup.airlineCode == el.flights[0].marketingAirline.code).counterCommission;
              if (counterCommission) counterCommission.value = booking.flights.isInternational ? counterCommission.international : counterCommission.domestic;
              let totalBaseFare = el.price.adultPrice.baseFare * booking.flights.adultCount
                + el.price.childPrice.baseFare * booking.flights.childCount
                + el.price.infantPrice.baseFare * booking.flights.infantCount;
              let markupFreeBaseFare = this.calculateMarkupFreePrice(totalBaseFare, '', markup, totalPassengerCount);
              let markupFreeTotalPrice = el.price.totalPrice - (totalBaseFare - markupFreeBaseFare);
              mspsResult.push({
                gateway: el.gateway,
                profileId: null,
                moneyUnit: booking.moneyUnit,
                value: markupFreeTotalPrice - this.calculateMarkupOrCommissionValue(markupFreeBaseFare, '', donyaroCommission, totalPassengerCount),
                isPoint: false
              })
              cumulativeCommissionValue += this.calculateMarkupOrCommissionValue(markupFreeBaseFare, '', commission, totalPassengerCount)
              cumulativeCounterCommissionValue += this.calculateMarkupOrCommissionValue(markupFreeBaseFare, '', counterCommission, totalPassengerCount)
              cumulativeOwnerCommissionValue += this.calculateMarkupOrCommissionValue(markupFreeBaseFare, '', ownerCommission, totalPassengerCount)
              if (++resultCount == booking.flights.itineraries.length) {
                if (booking.onBehalfProfile && booking.onBehalfProfile.profileTypeId == 58) {
                  mspsResult.push({
                    gateway: null,
                    profileId: booking.individualProfile.id,
                    moneyUnit: booking.moneyUnit,
                    value: cumulativeCounterCommissionValue,
                    isPoint: true
                  })
                  mspsResult.push({
                    gateway: null,
                    profileId: booking.onBehalfProfile.creator.individualProfileId,
                    moneyUnit: booking.moneyUnit,
                    value: cumulativeOwnerCommissionValue,
                    isPoint: true
                  });
                }
                else {
                  mspsResult.push({
                    gateway: null,
                    profileId: booking.individualProfile.id,
                    moneyUnit: booking.moneyUnit,
                    value: cumulativeCommissionValue,
                    isPoint: true
                  });
                }
                // Donyaro share
                mspsResult.push({
                  gateway: null,
                  profileId: 240,
                  moneyUnit: booking.moneyUnit,
                  value: booking.totalPriceToPayment - mspsResult.reduce((pval, el) => pval + el.value, 0),
                  isPoint: false
                })
                resolve(mspsResult.filter(el => el.value != 0))
              }
            })
            .catch(err => reject(err))
        })
      }
      else {
        let airlineCodes = [];
        booking.flights.itineraries.forEach(itin => itin.flights.forEach(flg => airlineCodes.push(flg.marketingAirline.code)));
        airlineCodes = [...new Set(airlineCodes)];
        ExternalRequest.syncPostRequest(
          process.env.MAIN_URL + "markup/get_markup", undefined,
          {
            "sellerProfileId": 240,
            "buyerProfileId": (booking.onBehalfProfile && booking.onBehalfProfile.id) ? booking.onBehalfProfile.id : booking.individualProfile.id,
            "gatewayId": booking.gateways[0].id,
            "airlineCodes": airlineCodes,
            // "commissionTypeCode": 3,
            // "currencyId": ""
          }, undefined, 'POST', undefined, undefined, undefined)
          .then((markupResult: any) => {
            let markup = markupResult.payload.data.find(_markup => _markup.airlineCode == booking.flights.itineraries[0].flights[0].marketingAirline.code).markup;
            if (markup) markup.value = booking.flights.isInternational ? markup.international : markup.domestic;
            let commission = markupResult.payload.data.find(_markup => _markup.airlineCode == booking.flights.itineraries[0].flights[0].marketingAirline.code).commission;
            if (commission) commission.value = booking.flights.isInternational ? commission.international : commission.domestic;
            let donyaroCommission = markupResult.payload.data.find(_markup => _markup.airlineCode == booking.flights.itineraries[0].flights[0].marketingAirline.code).donyaroCommission;
            if (donyaroCommission) donyaroCommission.value = booking.flights.isInternational ? donyaroCommission.international : donyaroCommission.domestic;
            let ownerCommission = markupResult.payload.data.find(_markup => _markup.airlineCode == booking.flights.itineraries[0].flights[0].marketingAirline.code).ownerCommission;
            if (ownerCommission) ownerCommission.value = booking.flights.isInternational ? ownerCommission.international : ownerCommission.domestic;
            let counterCommission = markupResult.payload.data.find(_markup => _markup.airlineCode == booking.flights.itineraries[0].flights[0].marketingAirline.code).counterCommission;
            if (counterCommission) counterCommission.value = booking.flights.isInternational ? counterCommission.international : counterCommission.domestic;
            let totalBaseFare = (booking.flights.adultCount > 0 ? booking.passengers.find(el => el.type == "adult").price.baseFare * booking.flights.adultCount : 0)
              + (booking.flights.childCount > 0 ? booking.passengers.find(el => el.type == "child").price.baseFare * booking.flights.childCount : 0)
              + (booking.flights.infantCount > 0 ? booking.passengers.find(el => el.type == "infant").price.baseFare * booking.flights.infantCount : 0);
            let markupFreeBaseFare = this.calculateMarkupFreePrice(totalBaseFare, '', markup, totalPassengerCount);
            let markupFreeTotalPrice = booking.totalPrice - (totalBaseFare - markupFreeBaseFare);
            mspsResult.push({
              gateway: booking.gateways[0],
              profileId: null,
              moneyUnit: booking.moneyUnit,
              value: markupFreeTotalPrice - this.calculateMarkupOrCommissionValue(markupFreeBaseFare, '', donyaroCommission, totalPassengerCount),
              isPoint: false
            })
            if (booking.onBehalfProfile && booking.onBehalfProfile.profileTypeId == 58) {
              mspsResult.push({
                gateway: null,
                profileId: booking.individualProfile.id,
                moneyUnit: booking.moneyUnit,
                value: this.calculateMarkupOrCommissionValue(markupFreeBaseFare, '', counterCommission, totalPassengerCount),
                isPoint: true
              })
              mspsResult.push({
                gateway: null,
                profileId: booking.onBehalfProfile.creator.individualProfileId,
                moneyUnit: booking.moneyUnit,
                value: this.calculateMarkupOrCommissionValue(markupFreeBaseFare, '', ownerCommission, totalPassengerCount),
                isPoint: true
              });
            }
            else {
              mspsResult.push({
                gateway: null,
                profileId: booking.individualProfile.id,
                moneyUnit: booking.moneyUnit,
                value: this.calculateMarkupOrCommissionValue(markupFreeBaseFare, '', commission, totalPassengerCount),
                isPoint: true
              });
            }
            // Donyaro share
            mspsResult.push({
              gateway: null,
              profileId: 240,
              moneyUnit: booking.moneyUnit,
              value: booking.totalPriceToPayment - mspsResult.reduce((pval, el) => pval + el.value, 0),
              isPoint: false
            })
            resolve(mspsResult.filter(el => el.value != 0));
          })
          .catch(err => reject(err))
      }
    })
  }

  // public static calculateCalendarMarkup(loggedInUser: any, gatewayCode: string, item: gatewaySearchInput, result: searchCalendarResult[], options: gatewaySearchOptions) {
  //   return new Promise<gatewaySearchFlightResult>((resolve, reject) => {
  //     new GatewaysManager().getByCode(gatewayCode)
  //       .then((gwy_result: gateway) => {
  //         let airlineCodes = [];
  //         result.forEach(_flg => {
  //           _flg.Itineraries.forEach(_itin => {
  //             _itin.Flights.forEach(_itinFlg => {
  //               airlineCodes.push(_itinFlg.MarketingAirline.Code);
  //               // airlineCodes.push(_itinFlg.OperatingAirline.Code);
  //             })
  //           })
  //         });
  //         airlineCodes = [...new Set(airlineCodes)];
  //         ExternalRequest.syncPostRequest(
  //           process.env.MAIN_URL + "markup/get_markup", undefined,
  //           {
  //             "sellerProfileId": 240,
  //             "buyerProfileId": (loggedInUser && loggedInUser.activeProfileId) ? loggedInUser.activeProfileId : 0,
  //             "gatewayId": gwy_result._id,
  //             "airlineCodes": airlineCodes,
  //             // "commissionTypeCode": 3,
  //             // "currencyId": ""
  //           }, undefined, 'POST', undefined, undefined, undefined)
  //           .then((markupResult: any) => {
  //             result.flights.forEach(_flg => {
  //               let markup = markupResult.find(_markup => _markup.airlineCode == _flg.Itineraries[0].Flights[0].MarketingAirline.Code).markup;
  //               let counterCommission = markupResult.find(_markup => _markup.airlineCode == _flg.Itineraries[0].Flights[0].MarketingAirline.Code).counterCommission;
  //               let commission = markupResult.find(_markup => _markup.airlineCode == _flg.Itineraries[0].Flights[0].MarketingAirline.Code).commission;
  //               if (counterCommission) {
  //                 _flg.Derik = this.calculateMarkupOrCommissionValue(_flg.TotalPrice, '', counterCommission,(item.adult + item.child + item.infant));
  //                 // RETURN PRICE WITHOUT AGENCY COMMISSION
  //               }
  //               else if (commission) {
  //                 _flg.Derik = this.calculateMarkupOrCommissionValue(_flg.TotalPrice, '', commission,(item.adult + item.child + item.infant));
  //               }
  //               if (markup != null && !(options.devMode && options.notApplyMarkup)) {
  //                 this.updatePriceObject(_flg.AdultPrice, '', markup);
  //                 this.updatePriceObject(_flg.ChildPrice, '', markup);
  //                 this.updatePriceObject(_flg.InfantPrice, '', markup);
  //                 _flg.TotalPrice += (item.adult * _flg.AdultPrice.TotalPrice + item.child * _flg.ChildPrice.TotalPrice + item.infant * _flg.InfantPrice.TotalPrice);
  //               }
  //             })
  //             resolve(result);
  //           })
  //           .catch(err => reject(err))

  //       })
  //       .catch(err => reject(err))
  //   });
  // }

  private static calculateMarkupOrCommissionValue(price: number, moneyUnit: string, markupOrCommission: any, PassengerCount: number): number {
    if (markupOrCommission && markupOrCommission.value)
      if (markupOrCommission.currencyId == '') {
        return price * markupOrCommission.value / 100;
      }
      else {
        return markupOrCommission.value * PassengerCount;
      }
    else
      return 0;
  }

  private static calculateMarkupFreePrice(price: number, moneyUnit: string, markup: any, totalPassengerCount: number): number {
    if (markup && markup.value)
      if (markup.currencyId == '') {
        return price * (100 / (100 + markup.value));
      }
      else {
        return price - (markup.value * totalPassengerCount);
      }
    else
      return price;
  }

  private static updatePriceObject(priceObj: any, moneyUnit: string, markup: any) {
    if (priceObj.TotalPrice != 0) {
      let markupValue = this.calculateMarkupOrCommissionValue(priceObj.BaseFare, moneyUnit, markup, 1);
      priceObj.BaseFare += markupValue;
      priceObj.TotalPrice += markupValue;
    }
  }
}