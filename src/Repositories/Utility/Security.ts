const bcrypt = require("bcrypt");
const saltRounds = 10;

export class Security {
  static hashText(text: string, callback: (error: any, result: any) => void) {
    bcrypt.hash(text, saltRounds, callback);
  }

  static compareHash(
    text: string,
    hash: string,
    callback: (error: any, result: any) => void
  ) {
    bcrypt.compare(text, hash, callback);
  }
}
