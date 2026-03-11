export function maskSensitiveFields(obj, sensitiveFields, mask = '****') {
  const maskedObj = { ...obj };

  for (const field of sensitiveFields) {
    if (maskedObj.hasOwnProperty(field)) {
      maskedObj[field] = mask;
    }
  }
  return maskedObj;
}
