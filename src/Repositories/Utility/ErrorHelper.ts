export function RejectHandler(reject: Function, errorMessage, statusCode) {
    reject({
        status: statusCode,
        errorMessage: errorMessage
    })
}

export function ResponseHandler(res: any, statusCode, errorMessage) {
    res.status(statusCode).send({
        status: statusCode,
        errorMessage: errorMessage,
        payload: {
            data: null,
            totalRecords: null,
            itemsPerPage: null,
            PageIndex: null,
        }
    });
}