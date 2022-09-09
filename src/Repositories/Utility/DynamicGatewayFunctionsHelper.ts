import { AsemanManager } from './../../Logic/Managers/AsemanManager';
import { KishAirManager } from './../../Logic/Managers/KishAirManager';
import { VareshManager } from './../../Logic/Managers/VareshManager';
import { TabanManager } from './../../Logic/Managers/TabanManager';
import { SahaManager } from './../../Logic/Managers/SahaManager';
import { AmadeusManager } from "../../Logic/Managers/AmadeusManager";
import { gatewaySearchInput, amadeusSession, gatewaySession, gatewaySignitureResult, gatewaySessionList, caspianSession, gatewayInputOptions, mahanSession, gatewayRuleInput } from "../../Common/Metadata/gatewayLogicInputMetadata";
import { gatewayMethods, generateDynamicGatewayFunctions, generateDynamicGatewayFunctionsRemote } from "../../Common/Metadata/gatewayMethodsMetadata";
import { gatewaySearchFlightResult, multipleGatewaySearchFlightResult, searchCalendarResult } from "../../Common/Metadata/gatewaySearchResultMetadata";
import { ZagrosManager } from "../../Logic/Managers/ZagrosManager";
import { MultipleGatewayManager } from "../../Logic/Managers/MultipleGatewayManager";
import { CaspianManager } from "../../Logic/Managers/CaspianManager";
import { gatewayBookData, multipleGatewayBookInternalResult, gatewayBookInternalResult } from "../../Common/Metadata/gatewayBookResultMetadata";
import { MahanManager } from '../../Logic/Managers/MahanManager';
import { gatewayRulesResult } from '../../Common/Metadata/gatewayRulesResultMetadata';
import { gatewayTicketInternalResult, multipleGatewayTicketInternalResult } from '../../Common/Metadata/gatewayTicketResultMetadata';
import { QeshmAirManager } from '../../Logic/Managers/QeshmAirManager';
import { KaroonManager } from '../../Logic/Managers/KaroonManager';
import { ParsAirManager } from '../../Logic/Managers/ParsAirManager';
import { FlyPersiaManager } from '../../Logic/Managers/FlyPersiaManager';
import { AtaManager } from '../../Logic/Managers/AtaManager';
import { TravelportGalileoManager } from '../../Logic/Managers/TravelportGalileoManager';
import { TravelportApolloManager } from '../../Logic/Managers/TravelportApolloManager';
import { TravelportWorldspanManager } from '../../Logic/Managers/TravelportWorldspanManager';
import { MerajManager } from '../../Logic/Managers/MerajManager';
import { AmadeusGlobalManager } from '../../Logic/Managers/AmadeusGlobalManager';
import { Sepehr360Manager } from '../../Logic/Managers/Sepehr360Manager';
import { IranAirManager } from '../../Logic/Managers/IranAirManager';
import { IranAirTourManager } from '../../Logic/Managers/IranAirTourManager';
import { SepehranManager } from '../../Logic/Managers/SepehranManager';
import { SalamAirManager } from '../../Logic/Managers/SalamAirManager';
const _ = require("lodash");
const gatewaySearchTimeout = parseInt(process.env.GATEWAY_SEARCH_TIMEOUT);
const internationalGatewaySearchTimeout = parseInt(process.env.INTERNATIONAL_GATEWAY_SEARCH_TIMEOUT);

export class DynamicGatewayFunctionsHelper {
  static multiGateway = {
    search(gateways: gatewaySignitureResult[], searchObj: gatewaySearchInput, session: gatewaySessionList, loggedInUser: any, options: gatewayInputOptions, exchangeRate: number) {
      return new Promise((resolve: (result: multipleGatewaySearchFlightResult) => void, reject) => {
        let _multiGatewayManager = new MultipleGatewayManager();
        _multiGatewayManager.search(gateways, searchObj, session, loggedInUser, options, exchangeRate)
          .then(result => resolve(result))
          .catch(err => reject(err));
      })
    },

    searchCalendar(gateways: gatewaySignitureResult[], searchObj: gatewaySearchInput, loggedInUser: any, options: gatewayInputOptions, exchangeRate: number) {
      return new Promise((resolve: (result: searchCalendarResult[]) => void, reject) => {
        let _multiGatewayManager = new MultipleGatewayManager();
        _multiGatewayManager.searchCalendar(gateways, searchObj, loggedInUser, options, exchangeRate)
          .then(result => resolve(result))
          .catch(err => reject(err));
      })
    },

    getRules(gateways: gatewaySignitureResult[], flightInfo: gatewayRuleInput, session: gatewaySessionList, options: gatewayInputOptions, exchangeRate: number) {
      return new Promise<gatewayRulesResult[]>((resolve, reject) => {
        let _multiGatewayManager = new MultipleGatewayManager();
        _multiGatewayManager.getFlightRules(gateways, flightInfo, session, options, exchangeRate)
          .then(result => resolve(result))
          .catch(err => reject(err))
      })
    },

    book(gateways: gatewaySignitureResult[], flightBooking: any, session: gatewaySessionList, options: gatewayInputOptions, exchangeRate: number) {
      return new Promise((resolve: (result: multipleGatewayBookInternalResult) => void, reject) => {
        let _multiGatewayManager = new MultipleGatewayManager();
        _multiGatewayManager.book(gateways, flightBooking, session, options, exchangeRate)
          .then(result => resolve(result))
          .catch(err => reject(err))
      })
    },

    createTicket(gateways: gatewaySignitureResult[], flightBooking: any, session: gatewaySessionList, options: gatewayInputOptions, exchangeRate: number) {
      return new Promise((resolve: (result: multipleGatewayTicketInternalResult) => void, reject) => {
        let _multiGatewayManager = new MultipleGatewayManager();
        _multiGatewayManager.createTicket(gateways, flightBooking, session, options, exchangeRate)
          .then(result => resolve(result))
          .catch(err => reject(err))
      })
    }

  }

  ////////////////////
  static init() {

    // if (this.salamair == null)
    // this.salamair = generateDynamicGatewayFunctions(SalamAirManager, "salamair", gatewaySearchTimeout)


    if (this.amadeus == null)
      this.amadeus = generateDynamicGatewayFunctions(AmadeusManager, "amadeus", internationalGatewaySearchTimeout)

    if (this.aseman == null)
      this.aseman = generateDynamicGatewayFunctions(AsemanManager, "aseman", gatewaySearchTimeout)

    if (this.ata == null)
      this.ata = generateDynamicGatewayFunctions(AtaManager, "ata", gatewaySearchTimeout)

    if (this.caspian == null)
      this.caspian = generateDynamicGatewayFunctions(CaspianManager, "caspian", gatewaySearchTimeout)

    if (this.flypersia == null)
      this.flypersia = generateDynamicGatewayFunctions(FlyPersiaManager, "flypersia", gatewaySearchTimeout)

    if (this.karoon == null)
      this.karoon = generateDynamicGatewayFunctions(KaroonManager, "karoon", gatewaySearchTimeout)

    if (this.parsair == null)
      this.parsair = generateDynamicGatewayFunctions(ParsAirManager, "parsair", gatewaySearchTimeout)

    if (this.kishair == null)
      this.kishair = generateDynamicGatewayFunctions(KishAirManager, "kishair", gatewaySearchTimeout)

    if (this.meraj == null)
      this.meraj = generateDynamicGatewayFunctions(MerajManager, "meraj", gatewaySearchTimeout)

    if (this.qeshmair == null)
      this.qeshmair = generateDynamicGatewayFunctions(QeshmAirManager, "qeshmair", gatewaySearchTimeout)

    if (this.saha == null)
      this.saha = generateDynamicGatewayFunctions(SepehranManager, "saha", gatewaySearchTimeout);

    if (this.taban == null)
      this.taban = generateDynamicGatewayFunctions(TabanManager, "taban", gatewaySearchTimeout)

    if (this.varesh == null)
      this.varesh = generateDynamicGatewayFunctions(VareshManager, "varesh", gatewaySearchTimeout)

    if (this.zagros == null)
      this.zagros = generateDynamicGatewayFunctions(ZagrosManager, "zagros", gatewaySearchTimeout)

    if (this.mahan == null)
      this.mahan = generateDynamicGatewayFunctions(MahanManager, "mahan", gatewaySearchTimeout)

    // if (this.travelport_1g == null)
    //   this.travelport_1g = generateDynamicGatewayFunctions(TravelportGalileoManager, "travelport_1g", internationalGatewaySearchTimeout)

    // if (this.travelport_1v == null)
    //   this.travelport_1v = generateDynamicGatewayFunctions(TravelportApolloManager, "travelport_1v", internationalGatewaySearchTimeout)

    // if (this.travelport_1p == null)
    //   this.travelport_1p = generateDynamicGatewayFunctions(TravelportWorldspanManager, "travelport_1p", internationalGatewaySearchTimeout)

    if (this.amadeus_global == null)
      this.amadeus_global = generateDynamicGatewayFunctionsRemote(process.env.AMADEUS_GLOBAL_SERVICE_URL, "amadeus_global", internationalGatewaySearchTimeout)

    if (this.mehrabseir == null)
      this.mehrabseir = generateDynamicGatewayFunctions(Sepehr360Manager, "mehrabseir", gatewaySearchTimeout)

    if (this.kiaparvazomidieh == null)
      this.kiaparvazomidieh = generateDynamicGatewayFunctions(Sepehr360Manager, "kiaparvazomidieh", gatewaySearchTimeout)

    if (this.rahbal == null)
      this.rahbal = generateDynamicGatewayFunctions(Sepehr360Manager, "rahbal", gatewaySearchTimeout)

    if (this.toptours == null)
      this.toptours = generateDynamicGatewayFunctions(Sepehr360Manager, "toptours", gatewaySearchTimeout)

    if (this.taksetare == null)
      this.taksetare = generateDynamicGatewayFunctions(Sepehr360Manager, "taksetare", gatewaySearchTimeout)

    if (this.iranianbastan == null)
      this.iranianbastan = generateDynamicGatewayFunctions(Sepehr360Manager, "iranianbastan", gatewaySearchTimeout)

    if (this.rahetamadon == null)
      this.rahetamadon = generateDynamicGatewayFunctions(Sepehr360Manager, "rahetamadon", gatewaySearchTimeout)

    if (this.persiankavir == null)
      this.persiankavir = generateDynamicGatewayFunctions(Sepehr360Manager, "persiankavir", gatewaySearchTimeout)

    if (this.zoraq == null)
      this.zoraq = generateDynamicGatewayFunctions(Sepehr360Manager, "zoraq", gatewaySearchTimeout)

    if (this.sepehrsayahan == null)
      this.sepehrsayahan = generateDynamicGatewayFunctions(Sepehr360Manager, "sepehrsayahan", gatewaySearchTimeout)

    if (this.sabahoma == null)
      this.sabahoma = generateDynamicGatewayFunctions(Sepehr360Manager, "sabahoma", gatewaySearchTimeout)

    if (this.sabzgasht == null)
      this.sabzgasht = generateDynamicGatewayFunctions(Sepehr360Manager, "sabzgasht", gatewaySearchTimeout)

    if (this.setaregan == null)
      this.setaregan = generateDynamicGatewayFunctions(Sepehr360Manager, "setaregan", gatewaySearchTimeout)

    if (this.darioush == null)
      this.darioush = generateDynamicGatewayFunctions(Sepehr360Manager, "darioush", gatewaySearchTimeout)

    if (this.sepidtous == null)
      this.sepidtous = generateDynamicGatewayFunctions(Sepehr360Manager, "sepidtous", gatewaySearchTimeout)

    if (this.behtazgasht == null)
      this.behtazgasht = generateDynamicGatewayFunctions(Sepehr360Manager, "behtazgasht", gatewaySearchTimeout)

    if (this.ariaparvaz == null)
      this.ariaparvaz = generateDynamicGatewayFunctions(Sepehr360Manager, "ariaparvaz", gatewaySearchTimeout)

    if (this.farhadgasht == null)
      this.farhadgasht = generateDynamicGatewayFunctions(Sepehr360Manager, "farhadgasht", gatewaySearchTimeout)

    if (this.sepideparvaz == null)
      this.sepideparvaz = generateDynamicGatewayFunctions(Sepehr360Manager, "sepideparvaz", gatewaySearchTimeout)

    if (this.sahlangasht == null)
      this.sahlangasht = generateDynamicGatewayFunctions(Sepehr360Manager, "sahlangasht", gatewaySearchTimeout)

    if (this.sanamparvaz == null)
      this.sanamparvaz = generateDynamicGatewayFunctions(Sepehr360Manager, "sanamparvaz", gatewaySearchTimeout)
     
    if (this.artimankish == null)
      this.artimankish = generateDynamicGatewayFunctions(Sepehr360Manager, "artimankish", gatewaySearchTimeout)
   
    if (this.forouzangasht == null)
      this.forouzangasht = generateDynamicGatewayFunctions(Sepehr360Manager, "forouzangasht", gatewaySearchTimeout)
     
    if (this.besatseir == null)
      this.besatseir = generateDynamicGatewayFunctions(Sepehr360Manager, "besatseir", gatewaySearchTimeout)
   
    if (this.alefbaiesafar == null)
      this.alefbaiesafar = generateDynamicGatewayFunctions(Sepehr360Manager, "alefbaiesafar", gatewaySearchTimeout)
     
    if (this.iranair == null)
      this.iranair = generateDynamicGatewayFunctions(IranAirManager, "iranair", gatewaySearchTimeout)

    if (this.iranairtour == null)
      this.iranairtour = generateDynamicGatewayFunctions(IranAirTourManager, "iranairtour", gatewaySearchTimeout)

    if (this.sepehran == null)
      this.sepehran = generateDynamicGatewayFunctions(SepehranManager, "sepehran", gatewaySearchTimeout);
  }

  static amadeus: gatewayMethods = null;

  static aseman: gatewayMethods = null;

  static ata: gatewayMethods = null;

  static caspian: gatewayMethods = null;

  static flypersia: gatewayMethods = null;

  static karoon: gatewayMethods = null;

  static parsair: gatewayMethods = null;

  static meraj: gatewayMethods = null;

  static qeshmair: gatewayMethods = null;

  static saha: gatewayMethods = null;

  static taban: gatewayMethods = null;

  static varesh: gatewayMethods = null;

  static zagros: gatewayMethods = null;

  static kishair: gatewayMethods = null;

  static mahan: gatewayMethods = null;

  static travelport_1g: gatewayMethods = null;

  static travelport_1p: gatewayMethods = null;

  static travelport_1v: gatewayMethods = null;

  static amadeus_global: gatewayMethods = null;

  static kiaparvazomidieh: gatewayMethods = null;

  static mehrabseir: gatewayMethods = null;

  static rahbal: gatewayMethods = null;

  static toptours: gatewayMethods = null;

  static taksetare: gatewayMethods = null;

  static iranianbastan: gatewayMethods = null;

  static rahetamadon: gatewayMethods = null;

  static persiankavir: gatewayMethods = null;

  static zoraq: gatewayMethods = null;

  static sepehrsayahan: gatewayMethods = null;

  static sabahoma: gatewayMethods = null;

  static sabzgasht: gatewayMethods = null;

  static setaregan: gatewayMethods = null;

  static darioush: gatewayMethods = null;

  static sepidtous: gatewayMethods = null;

  static behtazgasht: gatewayMethods = null;

  static ariaparvaz: gatewayMethods = null;

  static farhadgasht: gatewayMethods = null;

  static sepideparvaz: gatewayMethods = null;

  static sahlangasht: gatewayMethods = null;

  static sanamparvaz: gatewayMethods = null;

  static artimankish: gatewayMethods = null;

  static forouzangasht: gatewayMethods = null;

  static besatseir: gatewayMethods = null;

  static alefbaiesafar: gatewayMethods = null;

  static iranair: gatewayMethods = null;

  static iranairtour: gatewayMethods = null;

  static sepehran: gatewayMethods = null;
  
  static salamair: gatewayMethods = null;
}