const savedData = {};

module.exports = {
    savedData,
    writeFileSync(path, content) { savedData[path] = content; },
    readFileSync(path) { return savedData[path]; },
    existsSync(path) { return path in savedData; },
};
