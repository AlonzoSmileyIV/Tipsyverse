const validatePhone = (phone) => {
    const re = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/; // US format
    return re.test(phone.toLowerCase());
}

export default validatePhone;