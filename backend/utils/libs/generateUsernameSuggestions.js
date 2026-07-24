function generateUsernameSuggestions(fullName) {
    const clean = fullName.toLowerCase().trim();
    const noSpace = clean.replace(/\s+/g, '');
    const underscore = clean.replace(/\s+/g, '_');
    const dot = clean.replace(/\s+/g, '.');
    const randomNums = () => Math.floor(Math.random() * 1000);
    const year = new Date().getFullYear();

    return [
        noSpace,
        `${noSpace}${randomNums()}`,
        `${underscore}${randomNums()}`,
        `${dot}${randomNums()}`,
        `${noSpace}_${year}`,
        `${noSpace}_official`,
        `${noSpace}.ig`,
        `${underscore}_sip`,
        `the${noSpace}`,
        `real_${noSpace}`,
        `${noSpace}__`,
        `${noSpace}${randomNums()}x`,
    ];
}
export default generateUsernameSuggestions;
