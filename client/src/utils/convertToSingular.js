export const convertToSingluar = (word) => {
     return word.slice(-3) === "ies"
            ? word.slice(0, -3) + "y"
            : word.slice(-2) === "es"
            ? word.slice(0, -2)
            : word.slice(0, -1)
}