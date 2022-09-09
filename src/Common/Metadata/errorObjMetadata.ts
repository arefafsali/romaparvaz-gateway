export class errorObj {
    public name: string = "";
    public code: string = "";
    public error: string = "";
    public location: string = "";
    public data: any = null;
    constructor(_name: string = "", _code: string = "", _error: string = "", _location: string = "", _data: any = null) {
        this.name = _name;
        this.code = _code;
        this.error = _error;
        this.location = _location;
        this.data = _data;
    }
}