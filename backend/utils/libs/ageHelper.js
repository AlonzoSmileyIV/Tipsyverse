import { calculateAgeFromDateOnly } from "./dateTime.js";

const ageHelper = {
    calculateAge: (birthday, todayValue = new Date()) => {
        return calculateAgeFromDateOnly(birthday, todayValue);
    },

    isLegalAge: (age) => {
        return age >= 21;
    }
}

export default ageHelper;
