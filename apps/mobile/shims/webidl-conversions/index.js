function makeException(ErrorType, message, options = {}) {
  const context = options.context ? `${options.context} ` : '';
  return new ErrorType(`${context}${message}`);
}

function DOMString(value, options = {}) {
  if (options.treatNullAsEmptyString && value === null) {
    return '';
  }

  if (typeof value === 'symbol') {
    throw makeException(TypeError, 'is a symbol, which cannot be converted to a string', options);
  }

  return String(value);
}

function USVString(value, options = {}) {
  const stringValue = DOMString(value, options);

  if (typeof stringValue.toWellFormed === 'function') {
    return stringValue.toWellFormed();
  }

  return stringValue;
}

module.exports = {
  DOMString,
  USVString,
};

