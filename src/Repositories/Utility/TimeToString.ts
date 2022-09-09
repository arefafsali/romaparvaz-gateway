export class TimeToString {
    static generateTimeStirng(time: number) {
        if (time == 0)
            return "00:00";
        time = time / 1000 / 60 / 60;
        let hour: string;
        let minute: string;
        hour = Math.floor(time).toString();
        minute = (Math.round((time - Math.floor(time)) * 60)).toString()
        if (hour.length < 2)
            hour = "0" + hour;
        if (minute.length < 2)
            minute = "0" + minute;
        return hour + ":" + minute;
    }
}