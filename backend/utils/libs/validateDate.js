import { isValidDateOnly } from "./dateTime.js";

const validateDate = (dateString) => {
    return isValidDateOnly(dateString);
}

export default validateDate;
