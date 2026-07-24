// utils/validatePassword.js
const validatePassword = {
  checkLength: (password) => password.length >= 6,

  checkUppercase: (password) => /[A-Z]/.test(password),

  checkNumber: (password) => /\d/.test(password),

  checkSpecial: (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
};

export default validatePassword;