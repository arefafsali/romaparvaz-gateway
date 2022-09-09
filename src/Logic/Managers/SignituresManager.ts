import { BaseRepository } from "../../Repositories/Base/BaseRepository";
import { signiture } from "../../Common/Metadata/signituresMetadata";

export class SignituresManager extends BaseRepository<signiture> {
  constructor() {
    super("signitures");
  }

  getByProfile(profileId: number, callback: (error: any, result: any) => void) {
    this.find({ profileId: profileId }, callback);
  }

  getByProfileAndGateway(profileId: number, gatewayId: string, callback: (error: any, result: any) => void) {
    this.find({ profileId: profileId, gatewayId }, callback);
  }
}
Object.seal(SignituresManager);
