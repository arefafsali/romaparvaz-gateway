import { Request, Response, NextFunction } from "express"

export class SendResult {
    static defineResSend(req: Request, res: Response, next: NextFunction) {
        res.locals.send = (value, next) => {
            if (!res.locals.result) {
                res.locals.result = value;
                // console.log(value)
                // console.log(typeof next)
                if (next && typeof next == "function") next();
            }
        }
        next();
    }
    static sendResult(req: Request, res: Response, next: NextFunction) {
        res.send(res.locals.result);
    }
}