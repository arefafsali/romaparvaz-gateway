export class RandomNumberGenerator {
    static generate(min, max) {
        let number = Math.floor(Math.random() * (max - min + 1) + min).toString();
        let length = max.toString().length;
        let pad = '';
        for (let index = 0; index < length - number.length; index++) {
            pad += "0";
        }
        return pad + number;
    }
}